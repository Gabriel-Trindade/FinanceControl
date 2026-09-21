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

## Importação da planilha

A rota `/importar` permite enviar o arquivo `USO_CARTÃO.xlsx` para migrar o histórico de gastos para o app.
O arquivo é lido **no seu aparelho** — nunca sobe para o servidor.

### Como importar

1. Abra `/importar`
2. Clique em "Escolher arquivo .xlsx" e selecione o `USO_CARTÃO.xlsx`
3. O sistema lê o arquivo e confere quantas linhas já foram importadas — você vê um resumo antes de gravar
4. Revise problemas e avisos (se houver), depois clique "Gravar"
5. Veja o progresso enquanto os lançamentos entram — não feche a página
6. Ao terminar, confira o relatório com o que entrou e o que foi ignorado

### As quatro etapas

**Etapa 1: Escolher** — onde você seleciona o arquivo e vê a opção de desfazer (se houver uma importação anterior).

**Etapa 2: Conferir** — o sistema conta:
- Linhas lidas na aba GASTOS
- Quantas são novas (nunca viram antes)
- Quantas já foram importadas em outro dia
- Quantas têm problema (data errada, valor faltando, etc.)

Se houver problemas, a lista mostra o número da linha e por que não vai entrar. Avisos (como valores com muitas casas decimais) não bloqueiam a importação — a linha entra mesmo assim, com observação no relatório final.

**Etapa 3: Gravar** — mostra o progresso com uma barra. Os lançamentos entram em lotes de 500 de cada vez. Não feche nem saia da página.

**Etapa 4: Relatório** — resume tudo: quantos entraram, qual foi arredondado, qual foi ignorado. Há um atalho para voltar à lista de lançamentos.

### Desfazer uma importação

Na tela inicial e no relatório final há um botão "Desfazer importação", recolhido por padrão, no rodapé. Clique nele para expandir:

1. Digite `APAGAR` em maiúsculas para liberar o botão
2. Clique "Apagar os lançamentos importados"

Isso **apaga só** os lançamentos que vieram da planilha — lançamentos digitados à mão, de fatura ou de virada de mês não são afetados.

Depois de desfazer, você pode importar a planilha de novo quando quiser.

### Testar no celular (sem subir para produção)

Se quer testar o app no seu telefone enquanto desenvolve localmente:

```bash
npm run dev -- --hostname 0.0.0.0
```

Depois, no navegador do celular, acesse o IP do seu computador (ex.: `http://192.168.1.10:3000`), na mesma rede Wi-Fi.

## Privacidade

- Repositório privado.
- Nunca commitar `.env*`, planilhas ou faturas: o `.gitignore` bloqueia `*.xlsx`, `*.csv` e `*.pdf`.
- Testes usam apenas dados fictícios.
