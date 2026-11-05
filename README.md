# 🐮💸 Lista dos Veacos

Uma landing page bem-humorada para registrar (e expor publicamente) quem está devendo.  
Qualquer pessoa pode ver a lista. Só o dono, logado, pode adicionar, editar e remover devedores.

---

## Estrutura de arquivos

```
lista-dos-veacos/
├── index.html      # Página principal (lista pública + painel admin)
├── login.html      # Página de login do administrador
├── app.js          # Lógica principal (Supabase, CRUD, filtros, animações)
├── login.js        # Lógica exclusiva do login
├── styles.css      # Todo o estilo (neo-brutalismo, cores, fontes)
└── README.md       # Este arquivo
```

---

## Passo 1 — Criar o projeto no Supabase

1. Acesse [supabase.com](https://supabase.com) e crie uma conta gratuita.
2. Clique em **New project** e preencha nome, senha do banco e região.
3. Aguarde o projeto inicializar (leva ~1 minuto).

---

## Passo 2 — Criar a tabela e as políticas de segurança

No painel do Supabase, vá em **SQL Editor → New query** e execute o bloco abaixo:

```sql
-- Tabela principal
create table public.devedores (
  id              uuid primary key default gen_random_uuid(),
  nome            text not null check (char_length(nome) between 1 and 60),
  valor           numeric(12,2) not null check (valor > 0),
  motivo          text check (char_length(motivo) <= 140),
  avatar          text default '🐮',
  data_divida     date not null default current_date,
  pago            boolean not null default false,
  data_pagamento  date,
  criado_em       timestamptz not null default now()
);

-- Habilitar Row Level Security
alter table public.devedores enable row level security;

-- Qualquer pessoa (anônima ou logada) pode LER
create policy "leitura publica"
  on public.devedores for select
  to anon, authenticated
  using (true);

-- Só o admin pode INSERIR
-- (substitua o UUID abaixo pelo UUID do seu usuário admin — veja Passo 3)
create policy "admin insere"
  on public.devedores for insert
  to authenticated
  with check (auth.uid() = 'COLE-AQUI-O-UUID-DO-ADMIN'::uuid);

-- Só o admin pode ATUALIZAR
create policy "admin atualiza"
  on public.devedores for update
  to authenticated
  using (auth.uid() = 'COLE-AQUI-O-UUID-DO-ADMIN'::uuid)
  with check (auth.uid() = 'COLE-AQUI-O-UUID-DO-ADMIN'::uuid);

-- Só o admin pode EXCLUIR
create policy "admin exclui"
  on public.devedores for delete
  to authenticated
  using (auth.uid() = 'COLE-AQUI-O-UUID-DO-ADMIN'::uuid);
```

---

## Passo 3 — Criar o usuário administrador

1. No Supabase, vá em **Authentication → Providers → Email**.
2. Desative a opção **"Allow new users to sign up"** — isso impede qualquer pessoa de criar conta.
3. Vá em **Authentication → Users → Add user → Create new user**.
4. Preencha e-mail e senha do dono da lista e clique em **Create user**.
5. Copie o **UUID** do usuário criado (coluna "UID" na listagem).
6. Volte ao SQL Editor e execute as 3 políticas de escrita do Passo 2, substituindo `COLE-AQUI-O-UUID-DO-ADMIN` pelo UUID copiado.

---

## Passo 4 — Pegar as chaves da API

1. No Supabase, vá em **Settings → API**.
2. Copie:
   - **Project URL** → valor de `SUPABASE_URL`
   - **anon / public key** → valor de `SUPABASE_ANON_KEY`

> ⚠️ Nunca use a chave `service_role` nos arquivos do site — ela dá acesso total ao banco.

---

## Passo 5 — Configurar as chaves nos arquivos JS

Abra **`app.js`** e **`login.js`** e substitua as duas constantes no topo de cada arquivo:

```js
const SUPABASE_URL      = 'https://SEU-PROJETO.supabase.co';
const SUPABASE_ANON_KEY = 'sua-chave-anon-publica';
```

Faça isso nos **dois arquivos** (`app.js` e `login.js`).

---

## Passo 6 — Publicar no GitHub Pages

### 6.1 — Criar o repositório

```bash
# Dentro da pasta do projeto
git init
git add .
git commit -m "feat: lista dos veacos inicial"
```

### 6.2 — Criar o repo no GitHub e subir

```bash
# Crie um repositório público em github.com, depois:
git remote add origin https://github.com/SEU-USUARIO/lista-dos-veacos.git
git branch -M main
git push -u origin main
```

### 6.3 — Ativar o GitHub Pages

1. No repositório, vá em **Settings → Pages**.
2. Em **Source**, selecione **Deploy from a branch**.
3. Branch: `main` · Pasta: `/ (root)`.
4. Clique em **Save**.
5. Aguarde ~1 minuto. A URL ficará disponível em:
   ```
   https://SEU-USUARIO.github.io/lista-dos-veacos/
   ```

---

## Passo 7 — Configurar o CORS no Supabase

Para que o site no GitHub Pages consiga acessar o Supabase:

1. Vá em **Authentication → URL Configuration**.
2. Em **Site URL**, coloque sua URL do GitHub Pages:
   ```
   https://SEU-USUARIO.github.io
   ```
3. Em **Redirect URLs**, adicione:
   ```
   https://SEU-USUARIO.github.io/lista-dos-veacos/
   https://SEU-USUARIO.github.io/lista-dos-veacos/login.html
   ```
4. Clique em **Save**.

---

## Testando localmente

Como são arquivos estáticos, você precisa de um servidor HTTP local (abrir o HTML direto no navegador não funciona com módulos e o Supabase SDK):

```bash
# Opção 1 — Python (já vem instalado na maioria dos sistemas)
python3 -m http.server 8080

# Opção 2 — Node.js
npx serve .

# Opção 3 — extensão Live Server no VS Code / Kiro
# Clique com o botão direito em index.html → "Open with Live Server"
```

Acesse `http://localhost:8080` no navegador.

---

## Checklist rápido antes de publicar

- [ ] `SUPABASE_URL` e `SUPABASE_ANON_KEY` preenchidos em `app.js` **e** `login.js`
- [ ] UUID do admin substituído nas 3 políticas RLS no Supabase
- [ ] Cadastro público desativado (Authentication → Providers → Email)
- [ ] Site URL e Redirect URLs configurados no Supabase
- [ ] GitHub Pages ativado no repositório
- [ ] Testou o fluxo completo: ver lista sem login, fazer login, adicionar/editar/excluir, fazer logout

---

## Funcionalidades implementadas

| Funcionalidade | Visitante | Admin |
|---|:---:|:---:|
| Ver a lista completa | ✅ | ✅ |
| Buscar por nome | ✅ | ✅ |
| Filtrar (devendo / pagaram) | ✅ | ✅ |
| Ordenar (valor, data, atraso, nome) | ✅ | ✅ |
| Ver estatísticas (total, maiores, etc.) | ✅ | ✅ |
| Alternar entre cards e tabela | ✅ | ✅ |
| Adicionar devedor | ❌ | ✅ |
| Editar devedor | ❌ | ✅ |
| Marcar como "pagou" (+ confetti 🎉) | ❌ | ✅ |
| Excluir devedor | ❌ | ✅ |
| Sessão persistente ao recarregar | — | ✅ |

---

## ⚠️ Aviso importante

Este site é uma **brincadeira entre amigos**.  
Use apenas apelidos ou primeiros nomes — nunca dados pessoais completos.  
Combine com as pessoas antes de colocá-las na lista.  
Exposição pública de dívidas pode causar constrangimento e, dependendo do contexto, problemas legais.  
Mantenha o tom de brincadeira, nunca de cobrança abusiva.
