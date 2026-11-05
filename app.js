/* ============================================================
   LISTA DOS VEACOS — app.js
   Toda a lógica: Supabase, auth, CRUD, filtros, animações.

   ⚠️  CONFIGURE ANTES DE USAR:
   Substitua SUPABASE_URL e SUPABASE_ANON_KEY pelos valores
   do seu projeto em https://app.supabase.com → Settings → API
   ============================================================ */

const SUPABASE_URL      = 'https://iojcvagjmldgprlnhrbk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlvamN2YWdqbWxkZ3BybG5ocmJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM4OTY0OTEsImV4cCI6MjEwOTQ3MjQ5MX0.g2WdX2VHuZKKPw1mD9yNGV9rryWHj9Wn3p1eKIkeiNw';

/* ── inicializa cliente ────────────────────────────────────── */
const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ============================================================
   ESTADO GLOBAL
   ============================================================ */
let todosDevedores = [];   // cache completo do banco
let devedoresFiltrados = []; // após filtros/busca/ordem
let usuarioAtual = null;
let modoVisao = 'cards';   // 'cards' | 'tabela'
let confirmCallback = null; // função chamada ao confirmar exclusão
let toastTimer = null;

/* ============================================================
   SUBTÍTULOS ALEATÓRIOS
   ============================================================ */
const subtitulos = [
  'Aqui o calote tem nome, sobrenome e valor.',
  'Pagar é de graça, ser veaco sai caro.',
  'Quem deve, teme. Quem não paga, aparece aqui.',
  'A lista que ninguém quer estar, mas muitos merecem.',
  'Honre suas dívidas — ou honre seu lugar nessa lista.',
];

/* ============================================================
   SELOS DE VEAQUICE
   ============================================================ */
const selos = [
  { min: 0,  max: 7,   emoji: '🐣', nome: 'Veaquinho',      frase: 'Ainda dá tempo, hein?',       cls: 'selo-0'    },
  { min: 8,  max: 30,  emoji: '🐮', nome: 'Veaco Júnior',   frase: 'Já tá pegando fama.',          cls: 'selo-1'    },
  { min: 31, max: 90,  emoji: '🐂', nome: 'Veaco Sênior',   frase: 'O calote tem tradição.',       cls: 'selo-2'    },
  { min: 91, max: Infinity, emoji: '👑', nome: 'Veaco Lendário', frase: 'Entrou pra história.',    cls: 'selo-3'    },
];
const seloRedimido = { emoji: '😇', nome: 'Redimido', frase: 'Voltou pro caminho do bem.', cls: 'selo-pago' };

function getSelo(diasAtraso, pago) {
  if (pago) return seloRedimido;
  return selos.find(s => diasAtraso >= s.min && diasAtraso <= s.max) || selos[3];
}

/* ============================================================
   META DA CHÁCARA
   ============================================================ */
const META_TOTAL = 350;

function atualizarMeta() {
  const devendo    = todosDevedores.filter(d => !d.pago);
  const pagaram    = todosDevedores.filter(d => d.pago);
  const qtdTotal   = todosDevedores.length;
  const qtdPagaram = pagaram.length;
  const qtdDevendo = devendo.length;

  // Parcela = meta dividida pelo total de pessoas cadastradas
  const parcela    = qtdTotal > 0 ? META_TOTAL / qtdTotal : 0;

  // Arrecadado = quantos pagaram × parcela de cada um
  const arrecadado = qtdPagaram * parcela;
  const faltando   = Math.max(0, META_TOTAL - arrecadado);
  const pct        = qtdTotal > 0 ? Math.min(100, Math.round((arrecadado / META_TOTAL) * 100)) : 0;

  document.getElementById('meta-total').textContent      = formatarMoeda(META_TOTAL);
  document.getElementById('meta-parcela').textContent    = qtdTotal > 0
    ? formatarMoeda(parcela)
    : '—';
  document.getElementById('meta-arrecadado').textContent = formatarMoeda(arrecadado);
  document.getElementById('meta-restantes').textContent  = `${qtdDevendo} pessoa${qtdDevendo !== 1 ? 's' : ''}`;
  document.getElementById('progress-fill').style.width   = `${pct}%`;
  document.getElementById('progress-pct').textContent    = `${pct}%`;

  const faltandoEl = document.getElementById('meta-faltando');
  if (pct >= 100) {
    faltandoEl.textContent = '🎉 Meta batida! Chácara confirmada!';
    faltandoEl.style.color = '#5BFF6A';
  } else if (qtdTotal === 0) {
    faltandoEl.textContent = 'Ninguém cadastrado ainda. Adiciona os veacos! 🐮';
    faltandoEl.style.color = '';
  } else {
    faltandoEl.textContent = `Faltam ${formatarMoeda(faltando)} para a chácara! 🏡`;
    faltandoEl.style.color = '';
  }
}


function diasDeAtraso(dataStr) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const divida = new Date(dataStr + 'T00:00:00');
  const diff = hoje - divida;
  return Math.max(0, Math.floor(diff / 86400000));
}

function formatarMoeda(valor) {
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarData(dataStr) {
  if (!dataStr) return '—';
  const [y, m, d] = dataStr.split('-');
  return `${d}/${m}/${y}`;
}

function dataHoje() {
  return new Date().toISOString().split('T')[0];
}

/* ============================================================
   FUNDO DE BOLINHAS (canvas)
   ============================================================ */
function iniciarFundo() {
  const canvas = document.getElementById('bg-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = document.body.scrollHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  const bolinhas = Array.from({ length: 60 }, () => ({
    x: Math.random() * window.innerWidth,
    y: Math.random() * window.innerHeight * 3,
    r: 4 + Math.random() * 14,
    cor: ['#FF3CAC','#FF7A00','#2B1055','#7CFF4F'][Math.floor(Math.random()*4)],
  }));

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    bolinhas.forEach(b => {
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fillStyle = b.cor;
      ctx.fill();
    });
  }
  draw();
}

/* ============================================================
   CONFETTI 🎉
   ============================================================ */
function dispararConfetti() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (typeof confetti === 'undefined') return;

  const opts = {
    particleCount: 120,
    spread: 80,
    origin: { y: 0.6 },
    colors: ['#FFE45E', '#FF3CAC', '#FF7A00', '#2B1055', '#7CFF4F'],
  };
  confetti(opts);
  setTimeout(() => confetti({ ...opts, origin: { y: 0.4 }, particleCount: 60 }), 300);
}

/* ============================================================
   TOAST
   ============================================================ */
function mostrarToast(msg, duracao = 3000) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.remove('hidden');

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add('hidden'), duracao);
}

/* ============================================================
   AUTENTICAÇÃO
   ============================================================ */
async function iniciarAuth() {
  // Sessão atual
  const { data: { session } } = await sb.auth.getSession();
  usuarioAtual = session?.user ?? null;
  atualizarUI();

  // Escuta mudanças de sessão
  sb.auth.onAuthStateChange((_event, session) => {
    usuarioAtual = session?.user ?? null;
    atualizarUI();
    carregarDevedores();
  });
}

function atualizarUI() {
  const btnLogin     = document.getElementById('btn-login');
  const btnLogout    = document.getElementById('btn-logout');
  const greeting     = document.getElementById('admin-greeting');
  const fab          = document.getElementById('btn-add-fab');
  const colAcoes     = document.getElementById('col-acoes');

  if (usuarioAtual) {
    btnLogin.classList.add('hidden');
    btnLogout.classList.remove('hidden');
    greeting.classList.remove('hidden');
    fab.classList.remove('hidden');
    colAcoes?.classList.remove('hidden');
  } else {
    btnLogin.classList.remove('hidden');
    btnLogout.classList.add('hidden');
    greeting.classList.add('hidden');
    fab.classList.add('hidden');
    colAcoes?.classList.add('hidden');
  }
}

async function fazerLogout() {
  await sb.auth.signOut();
  mostrarToast('Até logo, chefe! 👋');
}

/* ============================================================
   CARREGAR DEVEDORES
   ============================================================ */
async function carregarDevedores() {
  mostrarLoading(true);

  const { data, error } = await sb
    .from('devedores')
    .select('*')
    .order('criado_em', { ascending: false });

  mostrarLoading(false);

  if (error) {
    console.error('Erro ao carregar:', error);
    mostrarToast('Erro ao carregar a lista. Tente novamente. 😬');
    return;
  }

  todosDevedores = data ?? [];
  aplicarFiltros();
  atualizarStats();
  atualizarMeta();
}

function mostrarLoading(ativo) {
  document.getElementById('loading-state').classList.toggle('hidden', !ativo);
  document.getElementById('lista-cards').classList.toggle('hidden', ativo);
  document.getElementById('lista-tabela-wrap').classList.toggle('hidden', true);
}

/* ============================================================
   ESTATÍSTICAS
   ============================================================ */
function atualizarStats() {
  const ativos  = todosDevedores.filter(d => !d.pago);
  const pagaram = todosDevedores.filter(d => d.pago);
  const qtdTotal = todosDevedores.length;
  const parcela  = qtdTotal > 0 ? META_TOTAL / qtdTotal : 0;
  const total    = ativos.length * parcela;
  const maior    = ativos.length > 0 ? ativos[0] : null; // já ordenado por criado_em

  document.getElementById('stat-total').textContent    = formatarMoeda(total);
  document.getElementById('stat-ativos').textContent   = ativos.length;
  document.getElementById('stat-pagaram').textContent  = pagaram.length;

  if (maior) {
    document.getElementById('stat-maior').textContent       = maior.nome;
    document.getElementById('stat-maior-valor').textContent = formatarMoeda(parcela);
  } else {
    document.getElementById('stat-maior').textContent       = '—';
    document.getElementById('stat-maior-valor').textContent = '';
  }

  const mascote = document.getElementById('mascote-hero');
  if (mascote) mascote.textContent = total > 5000 ? '😭' : '🐮';
}

/* ============================================================
   FILTROS, BUSCA E ORDENAÇÃO
   ============================================================ */
function aplicarFiltros() {
  const busca   = document.getElementById('busca').value.toLowerCase().trim();
  const filtro  = document.getElementById('filtro-status').value;
  const ordem   = document.getElementById('ordenar').value;

  let lista = [...todosDevedores];

  // Filtro de status
  if (filtro === 'devendo') lista = lista.filter(d => !d.pago);
  if (filtro === 'pagou')   lista = lista.filter(d =>  d.pago);

  // Busca por nome
  if (busca) lista = lista.filter(d => d.nome.toLowerCase().includes(busca));

  // Ordenação
  lista.sort((a, b) => {
    switch (ordem) {
      case 'valor_desc':  return b.valor - a.valor;
      case 'data_asc':    return new Date(a.data_divida) - new Date(b.data_divida);
      case 'atraso_desc': return diasDeAtraso(a.data_divida) < diasDeAtraso(b.data_divida) ? 1 : -1;
      case 'nome_asc':    return a.nome.localeCompare(b.nome, 'pt-BR');
      default:            return 0;
    }
  });

  devedoresFiltrados = lista;
  renderizarLista();
}

/* ============================================================
   RENDERIZAÇÃO
   ============================================================ */
function renderizarLista() {
  const emptyState = document.getElementById('empty-state');
  const cardsEl    = document.getElementById('lista-cards');
  const tabelaWrap = document.getElementById('lista-tabela-wrap');
  const tabelaBody = document.getElementById('lista-tabela-body');

  const vazio = devedoresFiltrados.length === 0;
  emptyState.classList.toggle('hidden', !vazio);
  cardsEl.classList.toggle('hidden', vazio || modoVisao !== 'cards');
  tabelaWrap.classList.toggle('hidden', vazio || modoVisao !== 'tabela');

  if (vazio) return;

  if (modoVisao === 'cards') {
    cardsEl.innerHTML = '';
    devedoresFiltrados.forEach((d, i) => {
      const card = criarCard(d, i);
      cardsEl.appendChild(card);
    });
  } else {
    tabelaBody.innerHTML = '';
    devedoresFiltrados.forEach(d => {
      const tr = criarLinhaTabela(d);
      tabelaBody.appendChild(tr);
    });
  }
}

/* ── Card individual ──────────────────────────────────────── */
function criarCard(d, idx) {
  const dias    = diasDeAtraso(d.data_divida);
  const selo    = getSelo(dias, d.pago);
  const rot     = idx % 2 === 0 ? '-1.5deg' : '1.5deg';
  const parcela = todosDevedores.length > 0 ? META_TOTAL / todosDevedores.length : 0;

  const article = document.createElement('article');
  article.className = `devedor-card card-veaco${d.pago ? ' pago' : ''}`;
  article.style.setProperty('--rot', rot);
  article.style.animationDelay = `${idx * 0.07}s`;
  article.setAttribute('role', 'listitem');
  article.setAttribute('aria-label', `${d.nome}, parcela ${formatarMoeda(parcela)}`);

  article.innerHTML = `
    <div class="card-top">
      <span class="card-avatar" aria-hidden="true">${d.avatar || '🐮'}</span>
      <div>
        <div class="card-nome">${escaparHTML(d.nome)}</div>
        <div class="card-valor">${formatarMoeda(parcela)}</div>
      </div>
    </div>

    ${d.motivo ? `<div class="card-motivo" title="Motivo">"${escaparHTML(d.motivo)}"</div>` : ''}

    <div class="card-meta">
      <span>📅 Desde ${formatarData(d.data_divida)}</span>
      <span class="card-atraso">
        ${d.pago
          ? `✅ Pago em ${formatarData(d.data_pagamento)}`
          : `⏳ ${dias} dia${dias !== 1 ? 's' : ''} de atraso`}
      </span>
    </div>

    <div class="card-footer">
      <span class="selo ${selo.cls}" title="${escaparHTML(selo.frase)}">
        ${selo.emoji} ${escaparHTML(selo.nome)}
      </span>
      <span class="status-badge ${d.pago ? 'status-pago' : 'status-devendo'}">
        ${d.pago ? '✅ Pagou' : '🔴 Devendo'}
      </span>
    </div>

    ${usuarioAtual ? `
    <div class="card-actions" aria-label="Ações de administrador">
      <button class="btn-action btn-edit"
        aria-label="Editar ${escaparHTML(d.nome)}"
        onclick="abrirModalEditar('${d.id}')">✏️ Editar</button>
      ${!d.pago ? `
      <button class="btn-action btn-pay"
        aria-label="Marcar ${escaparHTML(d.nome)} como pago"
        onclick="marcarComoPago('${d.id}')">✅ Pagou</button>
      ` : ''}
      <button class="btn-action btn-del"
        aria-label="Excluir ${escaparHTML(d.nome)}"
        onclick="confirmarExclusao('${d.id}', '${escaparHTML(d.nome)}')">🗑️ Excluir</button>
    </div>
    ` : ''}
  `;

  return article;
}

/* ── Linha de tabela ──────────────────────────────────────── */
function criarLinhaTabela(d) {
  const dias    = diasDeAtraso(d.data_divida);
  const selo    = getSelo(dias, d.pago);
  const parcela = todosDevedores.length > 0 ? META_TOTAL / todosDevedores.length : 0;
  const tr      = document.createElement('tr');
  if (d.pago) tr.style.opacity = '0.7';

  tr.innerHTML = `
    <td class="td-avatar" aria-hidden="true">${d.avatar || '🐮'}</td>
    <td>${escaparHTML(d.nome)}</td>
    <td class="td-valor">${formatarMoeda(parcela)}</td>
    <td>${d.motivo ? escaparHTML(d.motivo) : '—'}</td>
    <td>${d.pago ? `Pago em ${formatarData(d.data_pagamento)}` : `${dias}d`}</td>
    <td>
      <span class="selo ${selo.cls}" title="${escaparHTML(selo.frase)}">
        ${selo.emoji} ${escaparHTML(selo.nome)}
      </span>
    </td>
    <td>
      <span class="status-badge ${d.pago ? 'status-pago' : 'status-devendo'}">
        ${d.pago ? '✅ Pagou' : '🔴 Devendo'}
      </span>
    </td>
    ${usuarioAtual ? `
    <td class="td-acoes">
      <button class="btn-action btn-edit"
        aria-label="Editar ${escaparHTML(d.nome)}"
        onclick="abrirModalEditar('${d.id}')">✏️</button>
      ${!d.pago ? `
      <button class="btn-action btn-pay"
        aria-label="Marcar como pago"
        onclick="marcarComoPago('${d.id}')">✅</button>
      ` : ''}
      <button class="btn-action btn-del"
        aria-label="Excluir"
        onclick="confirmarExclusao('${d.id}', '${escaparHTML(d.nome)}')">🗑️</button>
    </td>
    ` : '<td></td>'}
  `;

  return tr;
}

/* ============================================================
   MODAL — ADICIONAR / EDITAR
   ============================================================ */
function abrirModalAdicionar() {
  document.getElementById('modal-titulo').textContent = 'Adicionar Veaco 🐮';
  document.getElementById('form-id').value      = '';
  document.getElementById('form-nome').value    = '';
  document.getElementById('form-motivo').value  = '';
  document.getElementById('form-data').value    = dataHoje();
  document.getElementById('form-avatar').value  = '🐮';
  document.getElementById('btn-salvar-text').textContent = 'Salvar Veaco 🐮';

  document.querySelectorAll('.emoji-opt').forEach(b => {
    const isDefault = b.dataset.emoji === '🐮';
    b.classList.toggle('selected', isDefault);
    b.setAttribute('aria-pressed', String(isDefault));
  });

  esconderErroForm();
  abrirModal('modal-form');
}

function abrirModalEditar(id) {
  const d = todosDevedores.find(x => x.id === id);
  if (!d) return;

  document.getElementById('modal-titulo').textContent = 'Editar Veaco ✏️';
  document.getElementById('form-id').value      = d.id;
  document.getElementById('form-nome').value    = d.nome;
  document.getElementById('form-motivo').value  = d.motivo ?? '';
  document.getElementById('form-data').value    = d.data_divida;
  document.getElementById('form-avatar').value  = d.avatar ?? '🐮';
  document.getElementById('btn-salvar-text').textContent = 'Salvar alterações ✏️';

  document.querySelectorAll('.emoji-opt').forEach(b => {
    const sel = b.dataset.emoji === (d.avatar ?? '🐮');
    b.classList.toggle('selected', sel);
    b.setAttribute('aria-pressed', String(sel));
  });

  esconderErroForm();
  abrirModal('modal-form');
}

function abrirModal(id) {
  const overlay = document.getElementById(id);
  overlay.classList.remove('hidden');
  // Foco no primeiro campo focável
  const primeiro = overlay.querySelector('button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
  if (primeiro) setTimeout(() => primeiro.focus(), 50);

  // Fechar com Esc
  overlay._escHandler = (e) => { if (e.key === 'Escape') fecharModal(id); };
  document.addEventListener('keydown', overlay._escHandler);
}

function fecharModal(id) {
  const overlay = document.getElementById(id);
  overlay.classList.add('hidden');
  if (overlay._escHandler) document.removeEventListener('keydown', overlay._escHandler);
}

function mostrarErroForm(msg) {
  const el = document.getElementById('form-error');
  el.textContent = msg;
  el.classList.remove('hidden');
}
function esconderErroForm() {
  document.getElementById('form-error').classList.add('hidden');
}

/* ── Submissão do formulário ──────────────────────────────── */
async function salvarDevedor(e) {
  e.preventDefault();
  esconderErroForm();

  const id     = document.getElementById('form-id').value;
  const nome   = document.getElementById('form-nome').value.trim();
  const motivo = document.getElementById('form-motivo').value.trim();
  const data   = document.getElementById('form-data').value;
  const avatar = document.getElementById('form-avatar').value;

  // Validações
  if (!nome)               return mostrarErroForm('Coloca o nome do veaco! 🐮');
  if (nome.length > 60)    return mostrarErroForm('Nome muito longo! Máx. 60 caracteres.');
  if (!data)               return mostrarErroForm('Informe a data! 📅');
  if (motivo.length > 140) return mostrarErroForm('Motivo muito longo! Máx. 140 caracteres.');

  // valor = 1 como placeholder (o valor real é calculado dinamicamente pela meta)
  const payload = { nome, valor: 1, motivo: motivo || null, data_divida: data, avatar };

  const btnSalvar = document.getElementById('btn-salvar');
  btnSalvar.disabled = true;
  document.getElementById('btn-salvar-text').textContent = 'Salvando…';

  let error;
  if (id) {
    ({ error } = await sb.from('devedores').update(payload).eq('id', id));
  } else {
    ({ error } = await sb.from('devedores').insert(payload));
  }

  btnSalvar.disabled = false;
  document.getElementById('btn-salvar-text').textContent = id ? 'Salvar alterações ✏️' : 'Salvar Veaco 🐮';

  if (error) {
    console.error('Erro ao salvar:', error);
    mostrarErroForm('Erro ao salvar. Tente novamente. 😬');
    return;
  }

  fecharModal('modal-form');
  mostrarToast(id ? 'Veaco atualizado! ✏️🐮' : 'Veaco adicionado à lista! 🐮💸');
  await carregarDevedores();
}

/* ============================================================
   MARCAR COMO PAGO
   ============================================================ */
async function marcarComoPago(id) {
  const { error } = await sb
    .from('devedores')
    .update({ pago: true, data_pagamento: dataHoje() })
    .eq('id', id);

  if (error) {
    console.error('Erro ao marcar como pago:', error);
    mostrarToast('Erro ao marcar como pago. 😬');
    return;
  }

  dispararConfetti();
  mostrarToast('Uhuuu! Mais um redimido! 😇✅');
  await carregarDevedores();
}

/* ============================================================
   EXCLUIR
   ============================================================ */
function confirmarExclusao(id, nome) {
  document.getElementById('confirm-msg').textContent =
    `Vai apagar "${nome}" da lista pra sempre. Tem certeza, chefe?`;

  confirmCallback = async () => {
    fecharModal('modal-confirm');
    const { error } = await sb.from('devedores').delete().eq('id', id);
    if (error) {
      console.error('Erro ao excluir:', error);
      mostrarToast('Erro ao excluir o veaco. 😬');
      return;
    }
    mostrarToast('Veaco removido da lista! 🗑️');
    await carregarDevedores();
  };

  abrirModal('modal-confirm');
}

/* ============================================================
   ALTERNÂNCIA DE VISÃO (cards / tabela)
   ============================================================ */
function alternarVisao(modo) {
  modoVisao = modo;

  const btnCards  = document.getElementById('btn-cards');
  const btnTabela = document.getElementById('btn-tabela');

  btnCards.classList.toggle('active', modo === 'cards');
  btnTabela.classList.toggle('active', modo === 'tabela');
  btnCards.setAttribute('aria-pressed', String(modo === 'cards'));
  btnTabela.setAttribute('aria-pressed', String(modo === 'tabela'));

  renderizarLista();
}

/* ============================================================
   SUBTÍTULO ALEATÓRIO
   ============================================================ */
function definirSubtitulo() {
  const el = document.getElementById('subtitulo');
  if (el) el.textContent = subtitulos[Math.floor(Math.random() * subtitulos.length)];
}

/* ============================================================
   ESCAPE DE HTML (segurança)
   ============================================================ */
function escaparHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ============================================================
   MASCOTE — interações
   ============================================================ */
function iniciarMascote() {
  const hero = document.getElementById('mascote-hero');
  const mini = document.querySelector('.mascote-mini');

  // Piscar de vez em quando
  setInterval(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const alvo = Math.random() > 0.5 ? hero : mini;
    if (!alvo) return;
    alvo.style.transform = 'scaleY(0.1)';
    setTimeout(() => alvo.style.transform = '', 120);
  }, 4000 + Math.random() * 3000);

  // Balançar ao passar o mouse
  [hero, mini].forEach(el => {
    if (!el) return;
    el.addEventListener('mouseenter', () => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      el.style.animation = 'mascote-shake 0.5s ease-in-out';
    });
    el.addEventListener('animationend', () => {
      el.style.animation = '';
    });
  });
}

/* ============================================================
   REGISTRO DE EVENTOS
   ============================================================ */
function registrarEventos() {
  /* Header */
  document.getElementById('btn-login')
    ?.addEventListener('click', () => { window.location.href = 'login.html'; });
  document.getElementById('btn-logout')
    ?.addEventListener('click', fazerLogout);

  /* FAB */
  document.getElementById('btn-add-fab')
    ?.addEventListener('click', abrirModalAdicionar);

  /* Modal form */
  document.getElementById('form-devedor')
    ?.addEventListener('submit', salvarDevedor);
  document.getElementById('modal-close')
    ?.addEventListener('click', () => fecharModal('modal-form'));
  document.getElementById('btn-cancelar')
    ?.addEventListener('click', () => fecharModal('modal-form'));

  // Fechar clicando no overlay
  document.getElementById('modal-form')
    ?.addEventListener('click', (e) => { if (e.target.id === 'modal-form') fecharModal('modal-form'); });
  document.getElementById('modal-confirm')
    ?.addEventListener('click', (e) => { if (e.target.id === 'modal-confirm') fecharModal('modal-confirm'); });

  /* Modal confirmação */
  document.getElementById('btn-confirm-nao')
    ?.addEventListener('click', () => fecharModal('modal-confirm'));
  document.getElementById('btn-confirm-sim')
    ?.addEventListener('click', () => confirmCallback && confirmCallback());

  /* Filtros / busca / ordenação */
  document.getElementById('busca')
    ?.addEventListener('input', aplicarFiltros);
  document.getElementById('filtro-status')
    ?.addEventListener('change', aplicarFiltros);
  document.getElementById('ordenar')
    ?.addEventListener('change', aplicarFiltros);

  /* Alternância de visão */
  document.getElementById('btn-cards')
    ?.addEventListener('click', () => alternarVisao('cards'));
  document.getElementById('btn-tabela')
    ?.addEventListener('click', () => alternarVisao('tabela'));

  /* Emoji picker */
  document.querySelectorAll('.emoji-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.emoji-opt').forEach(b => {
        b.classList.remove('selected');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('selected');
      btn.setAttribute('aria-pressed', 'true');
      document.getElementById('form-avatar').value = btn.dataset.emoji;
    });
  });

  /* Responsividade: tabela no desktop por padrão */
  const mqDesktop = window.matchMedia('(min-width: 768px)');
  if (mqDesktop.matches) alternarVisao('tabela');
  mqDesktop.addEventListener('change', e => {
    alternarVisao(e.matches ? 'tabela' : 'cards');
  });
}

/* ============================================================
   VERIFICAR CONFIGURAÇÃO
   ============================================================ */
function verificarConfig() {
  if (SUPABASE_URL === 'COLE_SUA_URL_AQUI' || SUPABASE_ANON_KEY === 'COLE_SUA_ANON_KEY_AQUI') {
    const aviso = document.createElement('div');
    aviso.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; z-index: 9999;
      background: #FF2E2E; color: #fff; text-align: center;
      padding: 1rem; font-family: 'Fredoka', sans-serif; font-size: 1rem;
      font-weight: 600; border-bottom: 4px solid #2B1055;
    `;
    aviso.innerHTML = '⚠️ Configure o Supabase em <code>app.js</code> (SUPABASE_URL e SUPABASE_ANON_KEY) antes de usar!';
    document.body.prepend(aviso);
    return false;
  }
  return true;
}

/* ============================================================
   INICIALIZAÇÃO
   ============================================================ */
document.addEventListener('DOMContentLoaded', async () => {
  iniciarFundo();
  definirSubtitulo();
  iniciarMascote();
  registrarEventos();

  if (!verificarConfig()) return;

  await iniciarAuth();
  await carregarDevedores();
});
