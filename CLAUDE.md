# FinanceControl

Site que substitui a aba **GASTOS** da planilha `USO_CARTÃO.xlsx`: controla o que cada pessoa deve do
cartão compartilhado, o que já foi recebido e o que falta receber. Um único usuário (o dono do sistema),
no celular e no computador.

## 🎓 Modo Professor (vale para TODAS as sessões)
Você é meu professor e eu sou o aluno. Em todo código que escrever ou alterar:
1. Antes: diga em poucas frases o que vai fazer e por quê.
2. Depois: explique o código por partes — o que cada trecho faz e por que foi feito assim.
3. Termos novos: defina na primeira vez que aparecerem, com analogia quando ajudar.
4. Como verificar: mostre como eu confiro sozinho (comando + o que devo ver).
5. Armadilhas: aponte erros comuns e boas práticas relacionadas.
6. Ao concluir cada tarefa: resumo curto do que eu aprendi.

Português do Brasil, linguagem clara, exemplos do próprio projeto. Nunca pule a explicação:
em mudança pequena ela é curta, mas existe. Comentários no código explicam o *porquê* dos
trechos não óbvios; a aula completa fica na conversa.

Ao criar ou atualizar qualquer CLAUDE.md de projeto (inclusive via /init), copie esta seção inteira.

## Onde está cada coisa
- **Spec do Núcleo (fonte da verdade das regras):** `docs/superpowers/specs/2026-09-14-nucleo-design.md`
- **Planos de implementação:** `docs/superpowers/plans/`
- **Referências sem dados pessoais:** `docs/referencias/planilha-gastos.md` e `docs/referencias/fatura-santander.md`

## Stack
Next.js 16 (App Router, TypeScript) · Neon Postgres + Drizzle ORM · Tailwind CSS + shadcn/ui · Zod ·
Vitest (com PGlite, um Postgres em memória, nos testes) · Vercel Hobby.

## Comandos
Detalhes no README.md.
- `npm run dev`: servidor local
- `npm run build`: build de produção
- `npm run lint`: ESLint
- `npm run typecheck`: checagem de tipos (`tsc --noEmit`)
- `npm test`: testes (Vitest)
- `npm run db:generate` / `npm run db:migrate`: gerar e aplicar migrações do banco
- `npm run credenciais`: gerar o hash da senha e o segredo da sessão para o `.env.local`

## Arquitetura (resumo)
- `src/domain/`: regras puras, sem banco nem tela. Toda regra de negócio mora aqui, com teste.
- `src/db/`: schema Drizzle, cliente do banco e consultas.
- `src/auth/`: senha, sessão e bloqueio de tentativas.
- `src/app/`: páginas e Server Actions. As actions são finas: checam a sessão, validam com Zod e chamam `db`/`domain`.
- `src/components/`: componentes de interface.
- `scripts/`: utilitários de linha de comando.
- `tests/`: apoio de testes (banco PGlite).

## Regras que não podem ser quebradas
- Dinheiro sempre em **centavos inteiros** (`valor_centavos`). Vírgula e "R$" só na tela.
- Mês da fatura guardado como data no **dia 1**. Nada de "dia 5" ou "dia 16".
- SUBTOTAL, SITUAÇÃO e RESTANTE são **calculados** em `src/domain`, nunca salvos.
- "Hoje" é sempre calculado no fuso `America/Sao_Paulo`, nunca no UTC do servidor.
- Toda Server Action e todo Route Handler protegido chama `exigirSessao()` antes de qualquer coisa.
- Nunca commitar `.env*`, planilhas, faturas ou qualquer dado real. Testes usam dados fictícios.

## Fluxo de trabalho (SDD)
Superpowers + papéis definidos em `~/.claude/CLAUDE.md`: **Opus** (Cérebro) planeja e revisa,
**Sonnet** (`construtor`) implementa com TDD, **Haiku** (`ajudante`) documenta e comenta.

## Roteiro
1. **Núcleo**: Plano 1 (fundação, login, lançar, deploy) → Plano 2 (telas completas, preparar mês, CSV, PWA)
2. **Migração** das 4.805 linhas da planilha
3. **Importação da fatura PDF**

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
