# FinanceControl

Controle do cartão de crédito compartilhado: quem deve quanto, o que já foi recebido e o que falta receber.
Substitui a aba GASTOS da planilha antiga. Um único usuário, no celular e no computador.

## Stack

Next.js 16 (App Router, TypeScript) · Neon Postgres + Drizzle ORM · Tailwind CSS + shadcn/ui · Zod · Vitest + PGlite · Vercel

## Rodando no seu computador

Pré-requisitos: Node.js 24 e um projeto no [Neon](https://console.neon.tech) com a branch `dev`.

1. Instale as dependências: `npm install`
2. Gere o hash da senha e o segredo da sessão: `npm run credenciais`
3. Copie `.env.example` para `.env.local` e preencha as quatro variáveis
4. Crie as tabelas no banco `dev`: `npm run db:migrate`
5. Suba o servidor com `npm run dev` e abra http://localhost:3000

## Variáveis de ambiente

| Variável | O que é |
|---|---|
| `DATABASE_URL` | conexão do Neon (branch `dev` no PC, `main` em produção) |
| `AUTH_USUARIO` | usuário do login |
| `AUTH_SENHA_HASH` | hash da senha, gerado por `npm run credenciais` |
| `AUTH_SEGREDO` | chave que assina o cookie de sessão (32 caracteres ou mais) |

O `.env.local` nunca vai para o git.

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | servidor local |
| `npm run build` | build de produção |
| `npm run lint` | ESLint |
| `npm run typecheck` | checagem de tipos |
| `npm test` | testes (Vitest, com banco em memória PGlite) |
| `npm run db:generate -- --name <nome>` | gera uma migração a partir de `src/db/schema.ts` |
| `npm run db:migrate` | aplica as migrações no banco do `DATABASE_URL` |
| `npm run credenciais` | gera `AUTH_SENHA_HASH` e `AUTH_SEGREDO` |

## Estrutura

| Pasta | Conteúdo |
|---|---|
| `src/domain/` | regras puras (dinheiro, datas, situação, restante), sem banco nem tela |
| `src/db/` | schema, conexão e consultas |
| `src/auth/` | senha, sessão e bloqueio de tentativas |
| `src/app/` | páginas e Server Actions |
| `src/components/` | componentes de interface |
| `scripts/` | utilitários de linha de comando |
| `tests/` | apoio de testes (banco PGlite) |
| `docs/` | spec, planos e referências |

## Deploy

Produção na Vercel, com banco Neon (branch `main`). O passo a passo está na Tarefa 11 de
`docs/superpowers/plans/2026-09-14-nucleo-plano-1.md`.

## Privacidade

- Repositório privado.
- Nunca commitar `.env*`, planilhas ou faturas: o `.gitignore` bloqueia `*.xlsx`, `*.csv` e `*.pdf`.
- Testes usam apenas dados fictícios.
