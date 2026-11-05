/* ============================================================
   LISTA DOS VEACOS — login.js
   Lógica exclusiva da página de login.

   ⚠️  Use os mesmos valores de SUPABASE_URL e SUPABASE_ANON_KEY
   do app.js. Idealmente extraia para um config.js compartilhado
   depois de configurar.
   ============================================================ */

const SUPABASE_URL      = 'https://iojcvagjmldgprlnhrbk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlvamN2YWdqbWxkZ3BybG5ocmJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM4OTY0OTEsImV4cCI6MjEwOTQ3MjQ5MX0.g2WdX2VHuZKKPw1mD9yNGV9rryWHj9Wn3p1eKIkeiNw';

const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ── Fundo de bolinhas (reutilizado do app.js) ──────────────── */
function iniciarFundo() {
  const canvas = document.getElementById('bg-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  window.addEventListener('resize', () => {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    draw();
  });

  const bolinhas = Array.from({ length: 40 }, () => ({
    x: Math.random() * window.innerWidth,
    y: Math.random() * window.innerHeight,
    r: 4 + Math.random() * 14,
    cor: ['#FF3CAC','#FF7A00','#2B1055','#7CFF4F'][Math.floor(Math.random() * 4)],
  }));

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    bolinhas.forEach(b => {
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fillStyle = b.cor;
      ctx.globalAlpha = 0.25;
      ctx.fill();
      ctx.globalAlpha = 1;
    });
  }
  draw();
}

/* ── Verificar configuração ─────────────────────────────────── */
function verificarConfig() {
  if (SUPABASE_URL === 'COLE_SUA_URL_AQUI' || SUPABASE_ANON_KEY === 'COLE_SUA_ANON_KEY_AQUI') {
    const aviso = document.createElement('div');
    aviso.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; z-index: 9999;
      background: #FF2E2E; color: #fff; text-align: center;
      padding: 1rem; font-family: 'Fredoka', sans-serif; font-size: 1rem;
      font-weight: 600; border-bottom: 4px solid #2B1055;
    `;
    aviso.textContent = '⚠️ Configure o Supabase em login.js (SUPABASE_URL e SUPABASE_ANON_KEY) antes de usar!';
    document.body.prepend(aviso);
    return false;
  }
  return true;
}

/* ── Mensagens de erro bem-humoradas ────────────────────────── */
const errosHumorados = [
  'Opa! Essa senha não é a do chefe. 🚫🐮',
  'Hmm… o veaco não te reconheceu. Tenta de novo! 🐮',
  'Negativo, capitão! Credenciais erradas. 🙅',
  'Esse e-mail ou senha não batem, chefe. 🔐',
];

function erroAleatorio() {
  return errosHumorados[Math.floor(Math.random() * errosHumorados.length)];
}

/* ── Mostrar / ocultar senha ────────────────────────────────── */
function registrarMostrarSenha() {
  const btn   = document.getElementById('btn-show-pass');
  const input = document.getElementById('login-senha');
  if (!btn || !input) return;

  btn.addEventListener('click', () => {
    const visivel = input.type === 'text';
    input.type       = visivel ? 'password' : 'text';
    btn.textContent  = visivel ? '👁️' : '🙈';
    btn.setAttribute('aria-label', visivel ? 'Mostrar senha' : 'Ocultar senha');
  });
}

/* ── Submissão do formulário ────────────────────────────────── */
async function handleLogin(e) {
  e.preventDefault();

  const email = document.getElementById('login-email').value.trim();
  const senha = document.getElementById('login-senha').value;
  const errEl = document.getElementById('login-error');
  const btn   = document.getElementById('btn-entrar');
  const txt   = document.getElementById('btn-entrar-text');

  // Limpar erro anterior
  errEl.classList.add('hidden');
  errEl.textContent = '';

  // Validação simples
  if (!email || !senha) {
    errEl.textContent = 'Preenche e-mail e senha, chefe! 📋';
    errEl.classList.remove('hidden');
    return;
  }

  // Estado de carregamento
  btn.disabled = true;
  txt.textContent = 'Verificando se você é o chefe… 🔍';

  const { error } = await sb.auth.signInWithPassword({ email, password: senha });

  btn.disabled = false;
  txt.textContent = 'Entrar 👑';

  if (error) {
    errEl.textContent = erroAleatorio();
    errEl.classList.remove('hidden');
    // Sacudir o formulário
    const box = document.querySelector('.login-box');
    if (box && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      box.style.animation = 'mascote-shake 0.4s ease-in-out';
      box.addEventListener('animationend', () => { box.style.animation = ''; }, { once: true });
    }
    return;
  }

  // Login bem-sucedido — redireciona para a página principal
  window.location.href = 'index.html';
}

/* ── Redirecionar se já logado ──────────────────────────────── */
async function verificarSessao() {
  const { data: { session } } = await sb.auth.getSession();
  if (session) window.location.href = 'index.html';
}

/* ── Inicialização ──────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  iniciarFundo();
  registrarMostrarSenha();

  if (!verificarConfig()) return;

  await verificarSessao();

  document.getElementById('form-login')
    ?.addEventListener('submit', handleLogin);
});
