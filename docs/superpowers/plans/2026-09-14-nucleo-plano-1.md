# FinanceControl — Plano 1: Primeiro lançamento no ar

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Colocar o FinanceControl no ar com login, lançamento pelo celular e lista do mês com "marcar recebido", sobre a base de regras e banco do Núcleo.

**Architecture:** Next.js 16 (App Router) com regras puras em `src/domain`, consultas Drizzle em `src/db` e autenticação própria em `src/auth`. Server Actions finas chamam essas camadas. Testes com Vitest, banco de teste em memória com PGlite e produção na Vercel com Neon.

**Tech Stack:** Next.js 16.3.5 · React 19 · TypeScript · Tailwind CSS 4 · shadcn/ui · Drizzle ORM 0.45 + drizzle-kit 0.31 · @neondatabase/serverless 1.1 · @electric-sql/pglite 0.5 · Zod 4 · jose 6 · Vitest 5 · tsx

**Spec:** `docs/superpowers/specs/2026-09-14-nucleo-design.md` (Plano 1 da §15)

## Global Constraints

- Interface, mensagens de erro, commits e documentação em português do Brasil. Identificadores de código sem acento (`mesFatura`, `valorCentavos`).
- Dinheiro sempre em centavos inteiros: `number` inteiro no TypeScript, `integer` no banco. Nunca ponto flutuante para dinheiro.
- Datas de calendário são strings `AAAA-MM-DD`; mês da fatura é sempre `AAAA-MM-01`. "Hoje" vem de `hojeEmSaoPaulo()` (fuso `America/Sao_Paulo`).
- `DIA_FECHAMENTO = 9`.
- Enum `pagamento`: `NAO | SIM | PERDOADO`. Enum `fonte`: `manual | planilha | fatura | virada`.
- Situação: `A_RECEBER | RECEBIDO | A_ABATER | ABATIDO | PERDOADO`, com rótulos `A RECEBER`, `RECEBIDO`, `A ABATER`, `ABATIDO`, `PERDOADO`.
- Regras R0 a R6 da spec sem alteração, inclusive PERDOADO zerando o RESTANTE.
- Hash de senha no formato `scrypt:N:r:p:sal:hash` (base64url), sem o caractere `$`.
- Sessão: cookie `fc_sessao`, JWT HS256, validade de 30 dias, `HttpOnly`, `Secure` em produção, `SameSite=Lax`, `Path=/`.
- Bloqueio de login: 5 falhas do mesmo IP em 15 minutos.
- Toda Server Action e todo Route Handler protegido chama `exigirSessao()` antes de qualquer outra coisa. As únicas exceções são `entrar` e `sair`, do login.
- Nunca commitar `.env*` (exceto `.env.example`) nem dados reais. Testes usam só dados fictícios.
- next, react, typescript e eslint ficam nas versões que o `create-next-app@16.3.5` instalar. Os demais pacotes seguem as versões maiores do Tech Stack.
- Cada tarefa traz `**Papel:**`. Despachar conforme `~/.claude/CLAUDE.md`: `construtor` (Sonnet), `ajudante` (Haiku) ou `você (manual)`, que é uma parada para o humano.
- Comandos pensados para o PowerShell do Windows; `npm`, `npx` e `git` funcionam igual no Git Bash.

## Mapa de arquivos

| Arquivo | Responsabilidade | Tarefa |
|---|---|---|
| `package.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `postcss.config.mjs`, `src/app/layout.tsx`, `src/app/globals.css`, `public/` | projeto Next.js gerado | 1 |
| `vitest.config.ts` | configuração dos testes | 1 |
| `.github/workflows/ci.yml` | CI: lint, typecheck e testes | 1 |
| `src/domain/dinheiro.ts` | R1: texto ↔ centavos | 1 |
| `src/domain/datas.ts` | R0, R2, R3: hoje, mês da fatura e sugestão | 2 |
| `src/domain/lancamento.ts` | R4, R5, R6: subtotal, situação e restante | 2 |
| `src/db/schema.ts` | tabelas, enums e restrições | 3 |
| `src/db/tipos.ts` | tipo `Db`, comum a Neon e PGlite | 3 |
| `drizzle.config.ts`, `drizzle/` | geração e aplicação de migrações | 3 |
| `tests/banco-de-teste.ts` | banco PGlite já migrado para cada teste | 3 |
| `src/db/cadastros.ts` | pessoas e categorias: listar ativas, obter ou criar | 4 |
| `src/db/lancamentos.ts` | criar, listar do mês e marcar recebidos | 4 |
| `src/auth/senha.ts` | hash e verificação scrypt | 5 |
| `src/auth/token.ts` | JWT da sessão | 5 |
| `src/auth/bloqueio.ts` | controle de tentativas de login | 5 |
| `scripts/gerar-credenciais.ts` | gera `AUTH_SENHA_HASH` e `AUTH_SEGREDO` | 5 |
| `.env.local` (fora do git) | variáveis do ambiente local | 6 |
| `.env.example`, `src/env.ts` | modelo e validação das variáveis de ambiente | 7 |
| `src/db/cliente.ts` | conexão com o Neon | 7 |
| `src/auth/http.ts`, `src/auth/login.ts`, `src/auth/cookie.ts` | IP da requisição, destino seguro, regra do login e nome do cookie | 7 |
| `src/auth/sessao.ts` | cookie de sessão e `exigirSessao()` | 7 |
| `src/proxy.ts` | porteiro das rotas | 7 |
| `src/app/login/*` | tela e ações de login | 7 |
| `src/app/page.tsx` | redireciona para `/lancamentos` (até o Plano 2) | 7 |
| `src/components/ui/*` | componentes shadcn | 8 |
| `src/app/(app)/layout.tsx`, `src/components/navegacao.tsx` | casca com navegação | 8 |
| `src/app/(app)/lancamentos/novo/*` | tela e ação de Lançar | 8 |
| `src/app/(app)/lancamentos/page.tsx`, `src/app/(app)/lancamentos/lista-do-mes.tsx`, `src/app/(app)/lancamentos/actions.ts` | lista do mês e marcar recebidos | 9 |
| `README.md` | como rodar, variáveis e deploy | 10 |
| — | produção: GitHub, Vercel e Neon | 11 |

## Paradas para o humano

A execução contínua para só nestes pontos:
- **Tarefa 6** (inteira): criar o banco Neon, escolher a senha e montar o `.env.local`.
- **Tarefa 9, Step 9**: conferir o fluxo no navegador.
- **Tarefa 11** (inteira): GitHub, Vercel e variáveis de produção, depois do merge na `main`.

## Fora deste plano (vai para o Plano 2)

Tela "Quem me deve" e extrato com cobrança (R7, R8) · Preparar próximo mês (R9) · filtros, edição, exclusão e
ações em massa além de "marcar recebido" · Cadastros · Exportar CSV · aviso "sem internet" · manifest do PWA.

---

### Task 1: Fundação do projeto e conversão de dinheiro (R1)

**Papel:** construtor

**Files:**
- Create (gerados pelo create-next-app): `package.json`, `package-lock.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `postcss.config.mjs`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`, `public/*`
- Create: `vitest.config.ts`, `.github/workflows/ci.yml`, `src/domain/dinheiro.ts`
- Modify: `.gitignore`, `package.json` (scripts)
- Test: `src/domain/dinheiro.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `paraCentavos(texto: string): number | null`: `"1.234,56"` → `123456`; texto inválido → `null`.
  - `formatarReais(centavos: number): string`: `123456` → `"R$ 1.234,56"` (espaço comum, sem NBSP).
  - Scripts npm: `dev`, `build`, `start`, `lint`, `typecheck`, `test`, `test:watch`.

- [ ] **Step 1: Gerar o projeto numa pasta temporária**

O repositório já tem `CLAUDE.md` e `docs/`, e o create-next-app se recusa a gerar numa pasta com arquivos desconhecidos. Por isso, gere fora e copie.

```powershell
$tmp = Join-Path $env:TEMP "fc-scaffold"
Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
npx --yes create-next-app@16.3.5 "$tmp\app" --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --skip-install --disable-git --yes
```

Expected: pasta `$tmp\app` com `package.json` e `src\app\page.tsx`. Se algum flag for recusado, rode `npx create-next-app@16.3.5 --help` e use o equivalente, mantendo: TypeScript, Tailwind, ESLint, App Router, `src/`, alias `@/*`, npm, sem instalar e sem git.

- [ ] **Step 2: Copiar o projeto gerado para a raiz do repositório**

```powershell
$repo = git rev-parse --show-toplevel
Get-ChildItem -Force "$tmp\app" | Where-Object { $_.Name -notin @('.gitignore', 'README.md', 'node_modules', '.git') } | Copy-Item -Destination $repo -Recurse -Force
Remove-Item -Recurse -Force $tmp
```

Acrescente ao final do `.gitignore` do repositório (não substitua o que já existe):

```gitignore

# Certificados e gerenciadores alternativos (vindos do template do Next)
*.pem
.pnp
.pnp.*
.yarn/*
yarn-debug.log*
yarn-error.log*
.pnpm-debug.log*
```

- [ ] **Step 3: Instalar dependências e ferramentas de teste**

```powershell
npm install
npm install -D vitest@5 tsx
```

Expected: instalação sem erros (avisos de `deprecated` em dependências indiretas são aceitáveis).

- [ ] **Step 4: Adicionar scripts ao `package.json`**

Dentro de `"scripts"`, mantenha `dev`, `build`, `start` e `lint` como vieram e acrescente:

```json
"typecheck": "tsc --noEmit",
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 5: Configurar o Vitest**

Crie `vitest.config.ts`:

```ts
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    // Mesmo atalho "@/..." do tsconfig, para os testes importarem igual ao app.
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
  },
})
```

- [ ] **Step 6: Escrever o teste que falha**

Crie `src/domain/dinheiro.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { formatarReais, paraCentavos } from './dinheiro'

describe('paraCentavos', () => {
  it.each([
    ['1.234,56', 123456],
    ['1234,56', 123456],
    ['1.234', 123400],
    ['1234', 123400],
    ['0,5', 50],
    ['  12,3 ', 1230],
    ['R$ 99,90', 9990],
    ['-10,00', -1000],
    ['-0,00', 0],
  ])('converte "%s" em %i centavos', (texto, esperado) => {
    expect(paraCentavos(texto)).toBe(esperado)
  })

  it.each(['', 'abc', '12,345', '1.2.3,4', '12,', ',5', '1234.56', '12.5'])(
    'recusa "%s"',
    (texto) => {
      expect(paraCentavos(texto)).toBeNull()
    },
  )
})

describe('formatarReais', () => {
  it.each([
    [123456, 'R$ 1.234,56'],
    [5, 'R$ 0,05'],
    [0, 'R$ 0,00'],
    [-1000, '-R$ 10,00'],
  ])('formata %i centavos como "%s"', (centavos, esperado) => {
    expect(formatarReais(centavos)).toBe(esperado)
  })
})
```

- [ ] **Step 7: Rodar o teste e ver falhar**

Run: `npx vitest run src/domain/dinheiro.test.ts`
Expected: FAIL com erro de import (`Failed to resolve import "./dinheiro"` ou equivalente).

- [ ] **Step 8: Implementar**

Crie `src/domain/dinheiro.ts`:

```ts
// Parte inteira: "1.234.567" (milhares com ponto) ou "1234567" (sem ponto).
// Parte decimal opcional: vírgula + 1 ou 2 dígitos.
// "1234.56" é recusado de propósito: no Brasil o ponto separa milhar, não centavos.
const PADRAO = /^(-)?(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?$/

export function paraCentavos(texto: string): number | null {
  const limpo = texto.replace(/R\$/g, '').replace(/\s/g, '')
  const partes = PADRAO.exec(limpo)
  if (!partes) return null

  const [, sinal, inteiro, decimal = ''] = partes
  const centavos = Number(inteiro.replaceAll('.', '')) * 100 + Number(decimal.padEnd(2, '0'))
  // Evita devolver -0 para "-0,00".
  return sinal && centavos !== 0 ? -centavos : centavos
}

const FORMATO_BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export function formatarReais(centavos: number): string {
  // O Intl usa espaço não separável (U+00A0) depois de "R$"; trocamos por espaço comum
  // para o texto sair igual em testes, CSV e mensagens copiadas.
  return FORMATO_BRL.format(centavos / 100).replace(/ /g, ' ')
}
```

- [ ] **Step 9: Rodar o teste e ver passar**

Run: `npx vitest run src/domain/dinheiro.test.ts`
Expected: PASS, todos os casos.

- [ ] **Step 10: Criar o CI**

Crie `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
  pull_request:

jobs:
  verificar:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test
```

- [ ] **Step 11: Verificação completa**

Run: `npm run lint; npm run typecheck; npm test; npm run build`
Expected: lint sem erros, typecheck sem erros, testes passando e build do Next concluído.

- [ ] **Step 12: Commit**

```powershell
git add -A
git commit -m "chore: projeto Next.js, Vitest, CI e conversão de dinheiro (R1)"
```

### Task 2: Regras de datas e do lançamento (R0, R2–R6)

**Papel:** construtor

**Files:**
- Create: `src/domain/datas.ts`, `src/domain/lancamento.ts`
- Test: `src/domain/datas.test.ts`, `src/domain/lancamento.test.ts`

**Interfaces:**
- Consumes: nada (funções puras).
- Produces, em `src/domain/datas.ts`:
  - `FUSO_HORARIO = 'America/Sao_Paulo'`, `DIA_FECHAMENTO = 9`
  - `hojeEmSaoPaulo(agora?: Date): string` → `"AAAA-MM-DD"`
  - `inicioDoMes(data: string): string` → `"AAAA-MM-01"`
  - `somarMeses(mesFatura: string, quantidade: number): string`
  - `mesmoMes(a: string, b: string): boolean`
  - `sugerirMesFatura(dataCompra: string, diaFechamento?: number): string`
  - `formatarMesFatura(mesFatura: string): string` → `"set/2026"`
  - `lerMes(texto: string): string | null`: `"2026-09"` → `"2026-09-01"`
  - `mesParaTexto(mesFatura: string): string`: `"2026-09-01"` → `"2026-09"`
  - `ehDataValida(texto: string): boolean`
- Produces, em `src/domain/lancamento.ts`:
  - `type Pagamento = 'NAO' | 'SIM' | 'PERDOADO'`
  - `type Situacao = 'A_RECEBER' | 'RECEBIDO' | 'A_ABATER' | 'ABATIDO' | 'PERDOADO'`
  - `ROTULO_SITUACAO: Record<Situacao, string>`
  - `type DadosDaRegra = { mesFatura: string; valorCentavos: number; parcelaAtual: number; qtdParcelas: number | null; recorrente: boolean; pagamento: Pagamento }`
  - `calcularSubtotal(l: Pick<DadosDaRegra, 'valorCentavos' | 'qtdParcelas' | 'recorrente'>): number`
  - `calcularSituacao(l: Pick<DadosDaRegra, 'valorCentavos' | 'pagamento'>): Situacao`
  - `calcularRestante(l: DadosDaRegra, hoje: string): number`

- [ ] **Step 1: Escrever os testes de datas**

Crie `src/domain/datas.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  ehDataValida,
  formatarMesFatura,
  hojeEmSaoPaulo,
  inicioDoMes,
  lerMes,
  mesmoMes,
  mesParaTexto,
  somarMeses,
  sugerirMesFatura,
} from './datas'

describe('hojeEmSaoPaulo (R0)', () => {
  it('usa o fuso de São Paulo, não o UTC do servidor', () => {
    // 01:30 de 01/10 em UTC ainda é 22:30 de 30/09 em São Paulo (UTC-3).
    expect(hojeEmSaoPaulo(new Date('2026-10-01T01:30:00Z'))).toBe('2026-09-30')
  })

  it('vira o dia à meia-noite de São Paulo', () => {
    expect(hojeEmSaoPaulo(new Date('2026-10-01T03:00:00Z'))).toBe('2026-10-01')
  })
})

describe('inicioDoMes, somarMeses e mesmoMes', () => {
  it('leva a data ao dia 1', () => {
    expect(inicioDoMes('2026-09-14')).toBe('2026-09-01')
  })

  it('soma e subtrai meses virando o ano', () => {
    expect(somarMeses('2026-12-01', 1)).toBe('2027-01-01')
    expect(somarMeses('2026-01-01', -1)).toBe('2025-12-01')
    expect(somarMeses('2026-09-01', 14)).toBe('2027-11-01')
  })

  it('compara mês e ano', () => {
    expect(mesmoMes('2026-09-01', '2026-09-30')).toBe(true)
    expect(mesmoMes('2026-09-01', '2025-09-01')).toBe(false)
  })
})

describe('sugerirMesFatura (R3)', () => {
  it.each([
    ['2026-09-09', '2026-09-01'], // no dia do fechamento: fatura do mês
    ['2026-09-10', '2026-10-01'], // depois do fechamento: mês seguinte
    ['2026-08-20', '2026-09-01'], // igual à fatura real de set/2026
    ['2026-12-15', '2027-01-01'], // virada de ano
    ['2026-01-01', '2026-01-01'],
  ])('compra em %s cai na fatura %s', (compra, fatura) => {
    expect(sugerirMesFatura(compra)).toBe(fatura)
  })

  it('aceita outro dia de fechamento', () => {
    expect(sugerirMesFatura('2026-09-10', 10)).toBe('2026-09-01')
  })
})

describe('formatarMesFatura, lerMes e mesParaTexto (R2)', () => {
  it('formata abreviado em português', () => {
    expect(formatarMesFatura('2026-09-01')).toBe('set/2026')
    expect(formatarMesFatura('2027-01-01')).toBe('jan/2027')
  })

  it('lê o valor de um <input type="month">', () => {
    expect(lerMes('2026-09')).toBe('2026-09-01')
    expect(lerMes('2026-13')).toBeNull()
    expect(lerMes('setembro')).toBeNull()
  })

  it('converte o mês da fatura de volta para o input', () => {
    expect(mesParaTexto('2026-09-01')).toBe('2026-09')
  })
})

describe('ehDataValida', () => {
  it.each(['2026-09-14', '2024-02-29'])('aceita %s', (data) => {
    expect(ehDataValida(data)).toBe(true)
  })

  it.each(['2026-02-30', '2026-13-01', '14/09/2026', ''])('recusa "%s"', (data) => {
    expect(ehDataValida(data)).toBe(false)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/domain/datas.test.ts`
Expected: FAIL com erro de import de `./datas`.

- [ ] **Step 3: Implementar `src/domain/datas.ts`**

```ts
export const FUSO_HORARIO = 'America/Sao_Paulo'
export const DIA_FECHAMENTO = 9

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const PADRAO_DATA = /^(\d{4})-(\d{2})-(\d{2})$/
const PADRAO_MES = /^(\d{4})-(\d{2})$/

function separar(data: string): { ano: number; mes: number; dia: number } {
  const partes = PADRAO_DATA.exec(data)
  if (!partes) throw new Error(`Data inválida: "${data}" (esperado AAAA-MM-DD)`)
  return { ano: Number(partes[1]), mes: Number(partes[2]), dia: Number(partes[3]) }
}

function montar(ano: number, mes: number, dia: number): string {
  return `${String(ano).padStart(4, '0')}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

/** R0: a data de hoje no fuso de São Paulo. O servidor roda em UTC e erraria o dia à noite. */
export function hojeEmSaoPaulo(agora: Date = new Date()): string {
  const partes = new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO_HORARIO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(agora)
  const pegar = (tipo: 'year' | 'month' | 'day') => partes.find((p) => p.type === tipo)?.value ?? ''
  return `${pegar('year')}-${pegar('month')}-${pegar('day')}`
}

export function inicioDoMes(data: string): string {
  const { ano, mes } = separar(data)
  return montar(ano, mes, 1)
}

export function somarMeses(mesFatura: string, quantidade: number): string {
  const { ano, mes } = separar(mesFatura)
  // Conta tudo em "meses desde o ano zero" para a virada de ano sair de graça.
  const total = ano * 12 + (mes - 1) + quantidade
  return montar(Math.floor(total / 12), (((total % 12) + 12) % 12) + 1, 1)
}

export function mesmoMes(a: string, b: string): boolean {
  return inicioDoMes(a) === inicioDoMes(b)
}

/** R3: compra até o dia do fechamento cai na fatura do mês; depois dele, na do mês seguinte. */
export function sugerirMesFatura(dataCompra: string, diaFechamento: number = DIA_FECHAMENTO): string {
  const { dia } = separar(dataCompra)
  const mes = inicioDoMes(dataCompra)
  return dia <= diaFechamento ? mes : somarMeses(mes, 1)
}

/** R2: "2026-09-01" → "set/2026". */
export function formatarMesFatura(mesFatura: string): string {
  const { ano, mes } = separar(mesFatura)
  return `${MESES[mes - 1]}/${ano}`
}

export function lerMes(texto: string): string | null {
  const partes = PADRAO_MES.exec(texto)
  if (!partes) return null
  const mes = Number(partes[2])
  if (mes < 1 || mes > 12) return null
  return `${partes[1]}-${partes[2]}-01`
}

export function mesParaTexto(mesFatura: string): string {
  return mesFatura.slice(0, 7)
}

export function ehDataValida(texto: string): boolean {
  const partes = PADRAO_DATA.exec(texto)
  if (!partes) return false
  const [ano, mes, dia] = [Number(partes[1]), Number(partes[2]), Number(partes[3])]
  // O Date "conserta" datas impossíveis (30/02 vira 02/03); se mudou, era inválida.
  const data = new Date(Date.UTC(ano, mes - 1, dia))
  return data.getUTCFullYear() === ano && data.getUTCMonth() === mes - 1 && data.getUTCDate() === dia
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/domain/datas.test.ts`
Expected: PASS.

- [ ] **Step 5: Escrever os testes das regras do lançamento**

Crie `src/domain/lancamento.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  calcularRestante,
  calcularSituacao,
  calcularSubtotal,
  ROTULO_SITUACAO,
  type DadosDaRegra,
} from './lancamento'

const base: DadosDaRegra = {
  mesFatura: '2026-09-01',
  valorCentavos: 10000,
  parcelaAtual: 3,
  qtdParcelas: 10,
  recorrente: false,
  pagamento: 'NAO',
}

describe('calcularSubtotal (R4)', () => {
  it('multiplica a quantidade de parcelas pelo valor', () => {
    expect(calcularSubtotal(base)).toBe(100000)
  })

  it('recorrente vale o próprio valor', () => {
    expect(calcularSubtotal({ ...base, recorrente: true, qtdParcelas: null })).toBe(10000)
  })

  it('crédito parcelado fica negativo', () => {
    expect(calcularSubtotal({ ...base, valorCentavos: -500, qtdParcelas: 2 })).toBe(-1000)
  })
})

describe('calcularSituacao (R5)', () => {
  it.each([
    ['PERDOADO', 10000, 'PERDOADO'],
    ['PERDOADO', -10000, 'PERDOADO'],
    ['SIM', -10000, 'ABATIDO'],
    ['NAO', -10000, 'A_ABATER'],
    ['SIM', 10000, 'RECEBIDO'],
    ['NAO', 10000, 'A_RECEBER'],
    ['NAO', 0, 'A_RECEBER'],
  ] as const)('pagamento %s com valor %i → %s', (pagamento, valorCentavos, esperado) => {
    expect(calcularSituacao({ pagamento, valorCentavos })).toBe(esperado)
  })

  it('tem rótulo para cada uma das 5 situações', () => {
    expect(ROTULO_SITUACAO).toEqual({
      A_RECEBER: 'A RECEBER',
      RECEBIDO: 'RECEBIDO',
      A_ABATER: 'A ABATER',
      ABATIDO: 'ABATIDO',
      PERDOADO: 'PERDOADO',
    })
  })
})

describe('calcularRestante (R6)', () => {
  const hoje = '2026-09-14'

  it('conta as parcelas que faltam quando a fatura é do mês de hoje', () => {
    expect(calcularRestante(base, hoje)).toBe(70000) // (10 − 3) × R$ 100,00
  })

  it('é zero fora do mês de hoje', () => {
    expect(calcularRestante({ ...base, mesFatura: '2026-08-01' }, hoje)).toBe(0)
    expect(calcularRestante({ ...base, mesFatura: '2025-09-01' }, hoje)).toBe(0)
  })

  it.each(['SIM', 'PERDOADO'] as const)('é zero quando o pagamento é %s', (pagamento) => {
    expect(calcularRestante({ ...base, pagamento }, hoje)).toBe(0)
  })

  it('é zero para recorrente', () => {
    expect(calcularRestante({ ...base, recorrente: true, qtdParcelas: null }, hoje)).toBe(0)
  })

  it('é zero na última parcela', () => {
    expect(calcularRestante({ ...base, parcelaAtual: 10 }, hoje)).toBe(0)
  })
})
```

- [ ] **Step 6: Rodar e ver falhar**

Run: `npx vitest run src/domain/lancamento.test.ts`
Expected: FAIL com erro de import de `./lancamento`.

- [ ] **Step 7: Implementar `src/domain/lancamento.ts`**

```ts
import { mesmoMes } from './datas'

export type Pagamento = 'NAO' | 'SIM' | 'PERDOADO'
export type Situacao = 'A_RECEBER' | 'RECEBIDO' | 'A_ABATER' | 'ABATIDO' | 'PERDOADO'

export const ROTULO_SITUACAO: Record<Situacao, string> = {
  A_RECEBER: 'A RECEBER',
  RECEBIDO: 'RECEBIDO',
  A_ABATER: 'A ABATER',
  ABATIDO: 'ABATIDO',
  PERDOADO: 'PERDOADO',
}

/** Os campos de um lançamento de que as regras precisam. */
export type DadosDaRegra = {
  mesFatura: string
  valorCentavos: number
  parcelaAtual: number
  qtdParcelas: number | null
  recorrente: boolean
  pagamento: Pagamento
}

/** R4 */
export function calcularSubtotal(
  l: Pick<DadosDaRegra, 'valorCentavos' | 'qtdParcelas' | 'recorrente'>,
): number {
  if (l.recorrente || l.qtdParcelas === null) return l.valorCentavos
  return l.qtdParcelas * l.valorCentavos
}

/** R5 */
export function calcularSituacao(l: Pick<DadosDaRegra, 'valorCentavos' | 'pagamento'>): Situacao {
  if (l.pagamento === 'PERDOADO') return 'PERDOADO'
  const pago = l.pagamento === 'SIM'
  if (l.valorCentavos < 0) return pago ? 'ABATIDO' : 'A_ABATER'
  return pago ? 'RECEBIDO' : 'A_RECEBER'
}

/**
 * R6: quanto ainda vai ser cobrado desta compra depois da parcela atual.
 * Só conta na linha do mês de hoje, para a mesma compra não somar várias vezes
 * (cada parcela é uma linha nova por mês). Diferente da planilha, PERDOADO também zera.
 */
export function calcularRestante(l: DadosDaRegra, hoje: string): number {
  if (l.pagamento !== 'NAO' || l.recorrente || l.qtdParcelas === null) return 0
  if (!mesmoMes(l.mesFatura, hoje)) return 0
  return (l.qtdParcelas - l.parcelaAtual) * l.valorCentavos
}
```

- [ ] **Step 8: Rodar e ver passar**

Run: `npx vitest run src/domain`
Expected: PASS em `dinheiro`, `datas` e `lancamento`.

- [ ] **Step 9: Verificar e fazer commit**

Run: `npm run typecheck; npm run lint`
Expected: sem erros.

```powershell
git add src/domain
git commit -m "feat: regras de datas e do lançamento (R0, R2–R6)"
```

### Task 3: Banco de dados — schema, migração e banco de teste

**Papel:** construtor

**Files:**
- Create: `src/db/schema.ts`, `src/db/tipos.ts`, `drizzle.config.ts`, `tests/banco-de-teste.ts`, `drizzle/0000_inicial.sql` (gerado), `drizzle/meta/*` (gerado)
- Modify: `package.json` (scripts e dependências)
- Test: `src/db/schema.test.ts`

**Interfaces:**
- Consumes: nada das tarefas anteriores.
- Produces:
  - Em `src/db/schema.ts`: `pagamentoEnum`, `fonteEnum`, tabelas `pessoas`, `categorias`, `lancamentos` e `tentativasLogin`. Campos em camelCase no TypeScript, snake_case no banco: `mesFatura`, `dataCompra`, `pessoaId`, `categoriaId`, `item`, `valorCentavos`, `parcelaAtual`, `qtdParcelas`, `recorrente`, `pagamento`, `pagoEm`, `fonte`, `criadoEm`, `atualizadoEm`; `tentativasLogin`: `id`, `ip`, `criadoEm`. Datas com `mode: 'string'`.
  - `type Db` (em `src/db/tipos.ts`): conexão Drizzle aceita tanto pelo Neon quanto pelo PGlite.
  - `criarBancoDeTeste(): Promise<{ db: Db; fechar: () => Promise<void> }>` (em `tests/banco-de-teste.ts`): Postgres em memória com as migrações reais aplicadas.
  - Scripts npm `db:generate` e `db:migrate`.

- [ ] **Step 1: Instalar as dependências do banco**

```powershell
npm install drizzle-orm@0.45
npm install -D drizzle-kit@0.31 @electric-sql/pglite@0.5 pg
```

`pg` fica só como dependência de desenvolvimento: é o driver que o `drizzle-kit migrate` usa para aplicar migrações no Neon pela linha de comando.

- [ ] **Step 2: Criar o banco de teste**

Crie `tests/banco-de-teste.ts`:

```ts
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import * as schema from '@/db/schema'
import type { Db } from '@/db/tipos'

/**
 * Cria um Postgres de verdade, só que em memória (PGlite), e aplica as mesmas migrações
 * que vão para produção. Cada teste ganha um banco limpo e nada vai para a internet.
 */
export async function criarBancoDeTeste(): Promise<{ db: Db; fechar: () => Promise<void> }> {
  const cliente = new PGlite()
  const db = drizzle({ client: cliente, schema })
  await migrate(db, { migrationsFolder: 'drizzle' })
  return { db, fechar: () => cliente.close() }
}
```

- [ ] **Step 3: Escrever os testes das restrições**

Crie `src/db/schema.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { criarBancoDeTeste } from '../../tests/banco-de-teste'
import { categorias, lancamentos, pessoas } from './schema'
import type { Db } from './tipos'

let db: Db
let fechar: () => Promise<void>
let pessoaId: number
let categoriaId: number

beforeEach(async () => {
  ;({ db, fechar } = await criarBancoDeTeste())
  ;[{ id: pessoaId }] = await db.insert(pessoas).values({ nome: 'Pessoa Teste' }).returning({ id: pessoas.id })
  ;[{ id: categoriaId }] = await db
    .insert(categorias)
    .values({ nome: 'Categoria Teste' })
    .returning({ id: categorias.id })
})

afterEach(async () => {
  await fechar()
})

function lancamentoValido() {
  return {
    mesFatura: '2026-09-01',
    pessoaId,
    categoriaId,
    item: 'Compra de teste',
    valorCentavos: 10000,
    parcelaAtual: 1,
    qtdParcelas: 3,
  }
}

describe('schema: restrições do banco', () => {
  it('aceita um lançamento válido com os padrões da spec', async () => {
    const [criado] = await db.insert(lancamentos).values(lancamentoValido()).returning()
    expect(criado.pagamento).toBe('NAO')
    expect(criado.fonte).toBe('manual')
    expect(criado.recorrente).toBe(false)
    expect(criado.pagoEm).toBeNull()
  })

  it('aceita recorrente sem quantidade de parcelas', async () => {
    const [criado] = await db
      .insert(lancamentos)
      .values({ ...lancamentoValido(), recorrente: true, qtdParcelas: null })
      .returning()
    expect(criado.recorrente).toBe(true)
  })

  it.each([
    ['mês da fatura fora do dia 1', { mesFatura: '2026-09-05' }],
    ['parcela maior que a quantidade', { parcelaAtual: 4, qtdParcelas: 3 }],
    ['parcela zero', { parcelaAtual: 0 }],
    ['recorrente com quantidade de parcelas', { recorrente: true, qtdParcelas: 3 }],
    ['não recorrente sem quantidade de parcelas', { qtdParcelas: null }],
    ['pago_em sem pagamento SIM', { pagoEm: '2026-09-14' }],
    ['item vazio', { item: '   ' }],
  ])('recusa %s', async (_, alteracao) => {
    await expect(
      db.insert(lancamentos).values({ ...lancamentoValido(), ...alteracao }),
    ).rejects.toThrow()
  })

  it('recusa pessoa repetida mudando só maiúsculas e minúsculas', async () => {
    await expect(db.insert(pessoas).values({ nome: 'PESSOA TESTE' })).rejects.toThrow()
  })

  it('não deixa excluir pessoa que tem lançamento', async () => {
    await db.insert(lancamentos).values(lancamentoValido())
    await expect(db.delete(pessoas)).rejects.toThrow()
  })
})
```

- [ ] **Step 4: Rodar e ver falhar**

Run: `npx vitest run src/db/schema.test.ts`
Expected: FAIL com erro de import de `./schema` (ou de `@/db/schema`).

- [ ] **Step 5: Escrever o schema**

Crie `src/db/schema.ts`:

```ts
import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

export const pagamentoEnum = pgEnum('pagamento', ['NAO', 'SIM', 'PERDOADO'])
export const fonteEnum = pgEnum('fonte', ['manual', 'planilha', 'fatura', 'virada'])

export const pessoas = pgTable(
  'pessoas',
  {
    id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
    nome: text('nome').notNull(),
    ativo: boolean('ativo').notNull().default(true),
    criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Índice sobre lower(nome): "Ana" e "ANA" contam como o mesmo nome.
    uniqueIndex('pessoas_nome_unico').on(sql`lower(${t.nome})`),
    check('pessoas_nome_preenchido', sql`length(trim(${t.nome})) > 0`),
  ],
)

export const categorias = pgTable(
  'categorias',
  {
    id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
    nome: text('nome').notNull(),
    ativo: boolean('ativo').notNull().default(true),
    criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('categorias_nome_unico').on(sql`lower(${t.nome})`),
    check('categorias_nome_preenchido', sql`length(trim(${t.nome})) > 0`),
  ],
)

export const lancamentos = pgTable(
  'lancamentos',
  {
    // "by default" deixa a migração da planilha gravar os CÓDs antigos (1–4805).
    id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
    mesFatura: date('mes_fatura', { mode: 'string' }).notNull(),
    dataCompra: date('data_compra', { mode: 'string' }),
    pessoaId: integer('pessoa_id')
      .notNull()
      .references(() => pessoas.id, { onDelete: 'restrict' }),
    categoriaId: integer('categoria_id')
      .notNull()
      .references(() => categorias.id, { onDelete: 'restrict' }),
    item: text('item').notNull(),
    valorCentavos: integer('valor_centavos').notNull(),
    parcelaAtual: smallint('parcela_atual').notNull().default(1),
    qtdParcelas: smallint('qtd_parcelas'),
    recorrente: boolean('recorrente').notNull().default(false),
    pagamento: pagamentoEnum('pagamento').notNull().default('NAO'),
    pagoEm: date('pago_em', { mode: 'string' }),
    fonte: fonteEnum('fonte').notNull().default('manual'),
    criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
    atualizadoEm: timestamp('atualizado_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('lancamentos_mes_fatura_dia_1', sql`extract(day from ${t.mesFatura}) = 1`),
    check('lancamentos_item_preenchido', sql`length(trim(${t.item})) > 0`),
    check('lancamentos_parcela_atual_positiva', sql`${t.parcelaAtual} >= 1`),
    check(
      'lancamentos_parcelas_coerentes',
      sql`(${t.recorrente} and ${t.qtdParcelas} is null) or (not ${t.recorrente} and ${t.qtdParcelas} is not null and ${t.qtdParcelas} >= ${t.parcelaAtual})`,
    ),
    check('lancamentos_pago_em_so_com_sim', sql`${t.pagoEm} is null or ${t.pagamento} = 'SIM'`),
    index('lancamentos_mes_fatura_idx').on(t.mesFatura),
    index('lancamentos_pessoa_pagamento_idx').on(t.pessoaId, t.pagamento),
  ],
)

export const tentativasLogin = pgTable(
  'tentativas_login',
  {
    id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
    ip: text('ip').notNull(),
    criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('tentativas_login_ip_criado_em_idx').on(t.ip, t.criadoEm)],
)
```

Crie `src/db/tipos.ts`:

```ts
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import type * as schema from './schema'

/**
 * Qualquer conexão Drizzle com o nosso schema: Neon em produção, PGlite nos testes.
 * As consultas recebem `db` por parâmetro e não sabem qual dos dois está do outro lado.
 */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>
```

Se no Step 8 o typecheck acusar que `PgliteDatabase` (ou, na Tarefa 7, `NeonHttpDatabase`) não é atribuível a `Db`, troque a linha por `export type Db = PgDatabase<any, typeof schema>` precedida de `// eslint-disable-next-line @typescript-eslint/no-explicit-any` e registre isso no relatório.

- [ ] **Step 6: Configurar o drizzle-kit e gerar a migração**

Crie `drizzle.config.ts`:

```ts
import { loadEnvConfig } from '@next/env'
import { defineConfig } from 'drizzle-kit'

// O drizzle-kit não lê o .env.local sozinho; o carregador de variáveis do Next faz isso.
loadEnvConfig(process.cwd())

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: { url: process.env.DATABASE_URL ?? '' },
})
```

Acrescente aos `"scripts"` do `package.json`:

```json
"db:generate": "drizzle-kit generate",
"db:migrate": "drizzle-kit migrate"
```

Run: `npm run db:generate -- --name inicial`
Expected: cria `drizzle/0000_inicial.sql` e `drizzle/meta/`. Confira no SQL: `CREATE TYPE "public"."pagamento"`, `CREATE TABLE "lancamentos"`, as cinco `CONSTRAINT ... CHECK` de `lancamentos`, e `CREATE UNIQUE INDEX "pessoas_nome_unico" ... (lower("nome"))`.

- [ ] **Step 7: Rodar os testes e ver passar**

Run: `npx vitest run src/db/schema.test.ts`
Expected: PASS, todos os casos.

- [ ] **Step 8: Verificar e fazer commit**

Run: `npm run typecheck; npm run lint; npm test`
Expected: sem erros; todos os testes passando.

```powershell
git add package.json package-lock.json drizzle.config.ts drizzle src/db tests
git commit -m "feat: schema do banco com restrições, migração inicial e banco de teste PGlite"
```

### Task 4: Consultas de cadastros e lançamentos

**Papel:** construtor

**Files:**
- Create: `src/db/cadastros.ts`, `src/db/lancamentos.ts`
- Test: `src/db/cadastros.test.ts`, `src/db/lancamentos.test.ts`

**Interfaces:**
- Consumes: `Db`, `pessoas`, `categorias`, `lancamentos` (Tarefa 3); `criarBancoDeTeste()` (Tarefa 3); `type Pagamento` (Tarefa 2).
- Produces, em `src/db/cadastros.ts`:
  - `type ItemCadastro = { id: number; nome: string }`
  - `normalizarNome(nome: string): string`
  - `listarPessoasAtivas(db: Db): Promise<ItemCadastro[]>` e `listarCategoriasAtivas(db: Db): Promise<ItemCadastro[]>`, em ordem alfabética
  - `obterOuCriarPessoa(db: Db, nome: string): Promise<ItemCadastro>` e `obterOuCriarCategoria(db: Db, nome: string): Promise<ItemCadastro>`: reaproveitam o nome existente ignorando maiúsculas; nome vazio lança `Error('Nome obrigatório')`
- Produces, em `src/db/lancamentos.ts`:
  - `type NovoLancamento = { mesFatura: string; dataCompra: string | null; pessoaId: number; categoriaId: number; item: string; valorCentavos: number; parcelaAtual: number; qtdParcelas: number | null; recorrente: boolean; pagamento: 'NAO' | 'SIM'; pagoEm: string | null }`
  - `type LancamentoDoMes = { id: number; mesFatura: string; dataCompra: string | null; pessoaId: number; pessoa: string; categoriaId: number; categoria: string; item: string; valorCentavos: number; parcelaAtual: number; qtdParcelas: number | null; recorrente: boolean; pagamento: Pagamento; pagoEm: string | null }`
  - `criarLancamento(db: Db, dados: NovoLancamento): Promise<{ id: number }>`: grava com `fonte = 'manual'`
  - `listarLancamentosDoMes(db: Db, mesFatura: string): Promise<LancamentoDoMes[]>`: ordena por pessoa e depois por `id`
  - `marcarComoRecebidos(db: Db, ids: number[], hoje: string): Promise<number>`: só altera os que estão `NAO`; devolve quantos mudaram

- [ ] **Step 1: Escrever os testes de cadastros**

Crie `src/db/cadastros.test.ts`:

```ts
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { criarBancoDeTeste } from '../../tests/banco-de-teste'
import {
  listarCategoriasAtivas,
  listarPessoasAtivas,
  normalizarNome,
  obterOuCriarCategoria,
  obterOuCriarPessoa,
} from './cadastros'
import { pessoas } from './schema'
import type { Db } from './tipos'

describe('normalizarNome', () => {
  it('tira espaços das pontas e junta espaços repetidos', () => {
    expect(normalizarNome('  Ana   Maria ')).toBe('Ana Maria')
  })
})

describe('cadastros no banco', () => {
  let db: Db
  let fechar: () => Promise<void>

  beforeEach(async () => {
    ;({ db, fechar } = await criarBancoDeTeste())
  })

  afterEach(async () => {
    await fechar()
  })

  it('cria a pessoa quando o nome ainda não existe', async () => {
    const ana = await obterOuCriarPessoa(db, '  Ana   Maria ')
    expect(ana).toEqual({ id: expect.any(Number), nome: 'Ana Maria' })
  })

  it('reaproveita a pessoa existente ignorando maiúsculas e minúsculas', async () => {
    const primeira = await obterOuCriarPessoa(db, 'Ana')
    const segunda = await obterOuCriarPessoa(db, 'ANA')
    expect(segunda).toEqual(primeira)
    expect(await listarPessoasAtivas(db)).toHaveLength(1)
  })

  it('recusa nome vazio', async () => {
    await expect(obterOuCriarPessoa(db, '   ')).rejects.toThrow('Nome obrigatório')
  })

  it('lista só as pessoas ativas, em ordem alfabética', async () => {
    await obterOuCriarPessoa(db, 'Carlos')
    const bia = await obterOuCriarPessoa(db, 'Bia')
    await obterOuCriarPessoa(db, 'Ana')
    await db.update(pessoas).set({ ativo: false }).where(eq(pessoas.id, bia.id))

    expect((await listarPessoasAtivas(db)).map((p) => p.nome)).toEqual(['Ana', 'Carlos'])
  })

  it('categorias seguem as mesmas regras', async () => {
    const mercado = await obterOuCriarCategoria(db, 'Mercado')
    expect(await obterOuCriarCategoria(db, 'mercado')).toEqual(mercado)
    expect((await listarCategoriasAtivas(db)).map((c) => c.nome)).toEqual(['Mercado'])
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/db/cadastros.test.ts`
Expected: FAIL com erro de import de `./cadastros`.

- [ ] **Step 3: Implementar `src/db/cadastros.ts`**

```ts
import { asc, eq, sql } from 'drizzle-orm'
import { categorias, pessoas } from './schema'
import type { Db } from './tipos'

export type ItemCadastro = { id: number; nome: string }

/** "  Ana   Maria " → "Ana Maria". */
export function normalizarNome(nome: string): string {
  return nome.trim().replace(/\s+/g, ' ')
}

export async function listarPessoasAtivas(db: Db): Promise<ItemCadastro[]> {
  return db
    .select({ id: pessoas.id, nome: pessoas.nome })
    .from(pessoas)
    .where(eq(pessoas.ativo, true))
    .orderBy(asc(pessoas.nome))
}

export async function listarCategoriasAtivas(db: Db): Promise<ItemCadastro[]> {
  return db
    .select({ id: categorias.id, nome: categorias.nome })
    .from(categorias)
    .where(eq(categorias.ativo, true))
    .orderBy(asc(categorias.nome))
}

/**
 * Busca pelo nome (sem diferenciar maiúsculas); se não achar, cria.
 * O `onConflictDoNothing` + nova busca cobre o caso raro de duas requisições
 * criarem o mesmo nome ao mesmo tempo: o índice único impede a duplicata.
 */
async function obterOuCriar(
  nome: string,
  buscar: (nome: string) => Promise<ItemCadastro | undefined>,
  inserir: (nome: string) => Promise<ItemCadastro | undefined>,
): Promise<ItemCadastro> {
  const limpo = normalizarNome(nome)
  if (!limpo) throw new Error('Nome obrigatório')

  const encontrado = (await buscar(limpo)) ?? (await inserir(limpo)) ?? (await buscar(limpo))
  if (!encontrado) throw new Error(`Não foi possível obter ou criar "${limpo}"`)
  return encontrado
}

export function obterOuCriarPessoa(db: Db, nome: string): Promise<ItemCadastro> {
  return obterOuCriar(
    nome,
    async (limpo) =>
      (
        await db
          .select({ id: pessoas.id, nome: pessoas.nome })
          .from(pessoas)
          .where(sql`lower(${pessoas.nome}) = lower(${limpo})`)
          .limit(1)
      )[0],
    async (limpo) =>
      (
        await db
          .insert(pessoas)
          .values({ nome: limpo })
          .onConflictDoNothing()
          .returning({ id: pessoas.id, nome: pessoas.nome })
      )[0],
  )
}

export function obterOuCriarCategoria(db: Db, nome: string): Promise<ItemCadastro> {
  return obterOuCriar(
    nome,
    async (limpo) =>
      (
        await db
          .select({ id: categorias.id, nome: categorias.nome })
          .from(categorias)
          .where(sql`lower(${categorias.nome}) = lower(${limpo})`)
          .limit(1)
      )[0],
    async (limpo) =>
      (
        await db
          .insert(categorias)
          .values({ nome: limpo })
          .onConflictDoNothing()
          .returning({ id: categorias.id, nome: categorias.nome })
      )[0],
  )
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/db/cadastros.test.ts`
Expected: PASS.

- [ ] **Step 5: Escrever os testes de lançamentos**

Crie `src/db/lancamentos.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { criarBancoDeTeste } from '../../tests/banco-de-teste'
import { obterOuCriarCategoria, obterOuCriarPessoa } from './cadastros'
import {
  criarLancamento,
  listarLancamentosDoMes,
  marcarComoRecebidos,
  type NovoLancamento,
} from './lancamentos'
import type { Db } from './tipos'

describe('lançamentos no banco', () => {
  let db: Db
  let fechar: () => Promise<void>
  let pessoaId: number
  let categoriaId: number

  beforeEach(async () => {
    ;({ db, fechar } = await criarBancoDeTeste())
    pessoaId = (await obterOuCriarPessoa(db, 'Ana')).id
    categoriaId = (await obterOuCriarCategoria(db, 'Mercado')).id
  })

  afterEach(async () => {
    await fechar()
  })

  function novo(alteracoes: Partial<NovoLancamento> = {}): NovoLancamento {
    return {
      mesFatura: '2026-09-01',
      dataCompra: '2026-08-20',
      pessoaId,
      categoriaId,
      item: 'Compra',
      valorCentavos: 5000,
      parcelaAtual: 1,
      qtdParcelas: 1,
      recorrente: false,
      pagamento: 'NAO',
      pagoEm: null,
      ...alteracoes,
    }
  }

  it('cria e lista só os lançamentos do mês pedido, com nomes de pessoa e categoria', async () => {
    const { id } = await criarLancamento(db, novo({ item: 'Farmácia' }))
    await criarLancamento(db, novo({ mesFatura: '2026-10-01' }))

    const doMes = await listarLancamentosDoMes(db, '2026-09-01')

    expect(doMes).toHaveLength(1)
    expect(doMes[0]).toMatchObject({
      id,
      item: 'Farmácia',
      pessoa: 'Ana',
      categoria: 'Mercado',
      valorCentavos: 5000,
      pagamento: 'NAO',
      dataCompra: '2026-08-20',
    })
  })

  it('ordena por pessoa e, dentro da pessoa, pela ordem de criação', async () => {
    const bia = await obterOuCriarPessoa(db, 'Bia')
    await criarLancamento(db, novo({ pessoaId: bia.id, item: 'B1' }))
    await criarLancamento(db, novo({ item: 'A1' }))
    await criarLancamento(db, novo({ item: 'A2' }))

    const itens = (await listarLancamentosDoMes(db, '2026-09-01')).map((l) => l.item)

    expect(itens).toEqual(['A1', 'A2', 'B1'])
  })

  it('marca como recebidos só os que estão em aberto', async () => {
    const aberto = await criarLancamento(db, novo())
    const outroAberto = await criarLancamento(db, novo())
    const jaPago = await criarLancamento(db, novo({ pagamento: 'SIM', pagoEm: '2026-09-01' }))

    const alterados = await marcarComoRecebidos(db, [aberto.id, jaPago.id], '2026-09-14')

    expect(alterados).toBe(1)
    const porId = new Map((await listarLancamentosDoMes(db, '2026-09-01')).map((l) => [l.id, l]))
    expect(porId.get(aberto.id)).toMatchObject({ pagamento: 'SIM', pagoEm: '2026-09-14' })
    expect(porId.get(outroAberto.id)).toMatchObject({ pagamento: 'NAO', pagoEm: null })
    expect(porId.get(jaPago.id)).toMatchObject({ pagamento: 'SIM', pagoEm: '2026-09-01' })
  })

  it('não faz nada quando a lista de ids está vazia', async () => {
    expect(await marcarComoRecebidos(db, [], '2026-09-14')).toBe(0)
  })
})
```

- [ ] **Step 6: Rodar e ver falhar**

Run: `npx vitest run src/db/lancamentos.test.ts`
Expected: FAIL com erro de import de `./lancamentos`.

- [ ] **Step 7: Implementar `src/db/lancamentos.ts`**

```ts
import { and, asc, eq, inArray, sql } from 'drizzle-orm'
import type { Pagamento } from '@/domain/lancamento'
import { categorias, lancamentos, pessoas } from './schema'
import type { Db } from './tipos'

export type NovoLancamento = {
  mesFatura: string
  dataCompra: string | null
  pessoaId: number
  categoriaId: number
  item: string
  valorCentavos: number
  parcelaAtual: number
  qtdParcelas: number | null
  recorrente: boolean
  pagamento: 'NAO' | 'SIM'
  pagoEm: string | null
}

export type LancamentoDoMes = {
  id: number
  mesFatura: string
  dataCompra: string | null
  pessoaId: number
  pessoa: string
  categoriaId: number
  categoria: string
  item: string
  valorCentavos: number
  parcelaAtual: number
  qtdParcelas: number | null
  recorrente: boolean
  pagamento: Pagamento
  pagoEm: string | null
}

export async function criarLancamento(db: Db, dados: NovoLancamento): Promise<{ id: number }> {
  const [criado] = await db
    .insert(lancamentos)
    .values({ ...dados, fonte: 'manual' })
    .returning({ id: lancamentos.id })
  return criado
}

export async function listarLancamentosDoMes(db: Db, mesFatura: string): Promise<LancamentoDoMes[]> {
  return db
    .select({
      id: lancamentos.id,
      mesFatura: lancamentos.mesFatura,
      dataCompra: lancamentos.dataCompra,
      pessoaId: lancamentos.pessoaId,
      pessoa: pessoas.nome,
      categoriaId: lancamentos.categoriaId,
      categoria: categorias.nome,
      item: lancamentos.item,
      valorCentavos: lancamentos.valorCentavos,
      parcelaAtual: lancamentos.parcelaAtual,
      qtdParcelas: lancamentos.qtdParcelas,
      recorrente: lancamentos.recorrente,
      pagamento: lancamentos.pagamento,
      pagoEm: lancamentos.pagoEm,
    })
    .from(lancamentos)
    .innerJoin(pessoas, eq(lancamentos.pessoaId, pessoas.id))
    .innerJoin(categorias, eq(lancamentos.categoriaId, categorias.id))
    .where(eq(lancamentos.mesFatura, mesFatura))
    .orderBy(asc(pessoas.nome), asc(lancamentos.id))
}

/** Um único UPDATE para todos os ids: o driver HTTP do Neon não faz transação interativa. */
export async function marcarComoRecebidos(db: Db, ids: number[], hoje: string): Promise<number> {
  if (ids.length === 0) return 0
  const alterados = await db
    .update(lancamentos)
    .set({ pagamento: 'SIM', pagoEm: hoje, atualizadoEm: sql`now()` })
    .where(and(inArray(lancamentos.id, ids), eq(lancamentos.pagamento, 'NAO')))
    .returning({ id: lancamentos.id })
  return alterados.length
}
```

- [ ] **Step 8: Rodar e ver passar**

Run: `npx vitest run src/db`
Expected: PASS em `schema`, `cadastros` e `lancamentos`.

- [ ] **Step 9: Verificar e fazer commit**

Run: `npm run typecheck; npm run lint; npm test`
Expected: sem erros; todos os testes passando.

```powershell
git add src/db
git commit -m "feat: consultas de cadastros e lançamentos"
```

### Task 5: Autenticação — senha, token de sessão e bloqueio

**Papel:** construtor

**Files:**
- Create: `src/auth/senha.ts`, `src/auth/token.ts`, `src/auth/bloqueio.ts`, `scripts/gerar-credenciais.ts`
- Modify: `package.json` (script `credenciais` e dependência `jose`)
- Test: `src/auth/senha.test.ts`, `src/auth/token.test.ts`, `src/auth/bloqueio.test.ts`

**Interfaces:**
- Consumes: `Db`, `tentativasLogin` (Tarefa 3); `criarBancoDeTeste()` (Tarefa 3).
- Produces, em `src/auth/senha.ts`:
  - `gerarHashSenha(senha: string): Promise<string>`: formato `scrypt:N:r:p:sal:hash` (base64url)
  - `verificarSenha(senha: string, hashSalvo: string): Promise<boolean>`: hash malformado → `false`
- Produces, em `src/auth/token.ts`:
  - `VALIDADE_SESSAO_SEGUNDOS = 2592000` (30 dias)
  - `criarTokenSessao(usuario: string, segredo: string, agora?: Date): Promise<string>`
  - `verificarTokenSessao(token: string, segredo: string, agora?: Date): Promise<{ usuario: string } | null>`
- Produces, em `src/auth/bloqueio.ts`:
  - `MAX_TENTATIVAS = 5`, `JANELA_MINUTOS = 15`
  - `type SituacaoBloqueio = { bloqueado: boolean; minutosRestantes: number }`
  - `registrarFalha(db: Db, ip: string, agora?: Date): Promise<void>`
  - `consultarBloqueio(db: Db, ip: string, agora?: Date): Promise<SituacaoBloqueio>`
  - `limparFalhas(db: Db, ip: string): Promise<void>`
- Produces: script `npm run credenciais`, que imprime `AUTH_SENHA_HASH=...` e `AUTH_SEGREDO=...`.

- [ ] **Step 1: Instalar o jose**

```powershell
npm install jose@6
```

- [ ] **Step 2: Escrever os testes de senha e token**

Crie `src/auth/senha.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { gerarHashSenha, verificarSenha } from './senha'

describe('senha', () => {
  it('gera hash no formato scrypt:N:r:p:sal:hash, sem o caractere $', async () => {
    const hash = await gerarHashSenha('senha-de-teste')
    expect(hash).toMatch(/^scrypt:\d+:\d+:\d+:[\w-]+:[\w-]+$/)
    expect(hash).not.toContain('$')
  })

  it('aceita a senha certa e recusa a errada', async () => {
    const hash = await gerarHashSenha('senha-de-teste')
    expect(await verificarSenha('senha-de-teste', hash)).toBe(true)
    expect(await verificarSenha('senha-errada', hash)).toBe(false)
  })

  it('usa um sal diferente a cada hash', async () => {
    expect(await gerarHashSenha('mesma-senha')).not.toBe(await gerarHashSenha('mesma-senha'))
  })

  it.each(['', 'texto-qualquer', 'bcrypt:1:2:3:abc:def', 'scrypt:x:8:1:abc:def'])(
    'recusa hash malformado "%s"',
    async (hash) => {
      expect(await verificarSenha('qualquer', hash)).toBe(false)
    },
  )
})
```

Crie `src/auth/token.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { criarTokenSessao, verificarTokenSessao } from './token'

const SEGREDO = 'segredo-de-teste-com-mais-de-32-caracteres'

describe('token de sessão', () => {
  it('cria e verifica o token do usuário', async () => {
    const token = await criarTokenSessao('dono', SEGREDO)
    expect(await verificarTokenSessao(token, SEGREDO)).toEqual({ usuario: 'dono' })
  })

  it('recusa token assinado com outro segredo', async () => {
    const token = await criarTokenSessao('dono', 'outro-segredo-com-mais-de-32-caracteres!!')
    expect(await verificarTokenSessao(token, SEGREDO)).toBeNull()
  })

  it('recusa token com o conteúdo adulterado', async () => {
    const [cabecalho, , assinatura] = (await criarTokenSessao('dono', SEGREDO)).split('.')
    const conteudoFalso = Buffer.from(
      JSON.stringify({ sub: 'invasor', iat: 0, exp: 9999999999 }),
    ).toString('base64url')
    expect(await verificarTokenSessao(`${cabecalho}.${conteudoFalso}.${assinatura}`, SEGREDO)).toBeNull()
  })

  it('vale por 30 dias e depois expira', async () => {
    const token = await criarTokenSessao('dono', SEGREDO, new Date('2026-09-01T12:00:00Z'))
    expect(await verificarTokenSessao(token, SEGREDO, new Date('2026-09-30T12:00:00Z'))).toEqual({
      usuario: 'dono',
    })
    expect(await verificarTokenSessao(token, SEGREDO, new Date('2026-10-02T12:00:00Z'))).toBeNull()
  })

  it('recusa texto que não é token', async () => {
    expect(await verificarTokenSessao('isto-nao-e-um-jwt', SEGREDO)).toBeNull()
  })
})
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx vitest run src/auth`
Expected: FAIL com erros de import de `./senha` e `./token`.

- [ ] **Step 4: Implementar `src/auth/senha.ts`**

```ts
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'

const PREFIXO = 'scrypt'
const TAMANHO_CHAVE = 64
const PARAMETROS = { N: 2 ** 16, r: 8, p: 1 }
// N=2^16 usa ~64 MB; o limite padrão do Node é 32 MB, então liberamos 128 MB.
const MEMORIA_MAXIMA = 128 * 1024 * 1024

type Parametros = { N: number; r: number; p: number }

function derivar(senha: string, sal: Buffer, { N, r, p }: Parametros): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(senha, sal, TAMANHO_CHAVE, { N, r, p, maxmem: MEMORIA_MAXIMA }, (erro, chave) =>
      erro ? reject(erro) : resolve(chave),
    )
  })
}

/**
 * Separador ":" em vez de "$": o carregador de .env do Next trata "$NOME" como variável
 * e estragaria o hash.
 */
export async function gerarHashSenha(senha: string): Promise<string> {
  const sal = randomBytes(16)
  const chave = await derivar(senha, sal, PARAMETROS)
  return [
    PREFIXO,
    PARAMETROS.N,
    PARAMETROS.r,
    PARAMETROS.p,
    sal.toString('base64url'),
    chave.toString('base64url'),
  ].join(':')
}

export async function verificarSenha(senha: string, hashSalvo: string): Promise<boolean> {
  const partes = hashSalvo.split(':')
  if (partes.length !== 6 || partes[0] !== PREFIXO) return false

  const [N, r, p] = partes.slice(1, 4).map(Number)
  if (![N, r, p].every((n) => Number.isSafeInteger(n) && n > 0)) return false

  const esperado = Buffer.from(partes[5], 'base64url')
  if (esperado.length !== TAMANHO_CHAVE) return false

  try {
    const chave = await derivar(senha, Buffer.from(partes[4], 'base64url'), { N, r, p })
    // Comparação em tempo constante: não revela, pela demora, quantos bytes acertaram.
    return timingSafeEqual(chave, esperado)
  } catch {
    return false
  }
}
```

- [ ] **Step 5: Implementar `src/auth/token.ts`**

```ts
import { jwtVerify, SignJWT } from 'jose'

export const VALIDADE_SESSAO_SEGUNDOS = 60 * 60 * 24 * 30

function chave(segredo: string): Uint8Array {
  return new TextEncoder().encode(segredo)
}

export async function criarTokenSessao(
  usuario: string,
  segredo: string,
  agora: Date = new Date(),
): Promise<string> {
  const emitidoEm = Math.floor(agora.getTime() / 1000)
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(usuario)
    .setIssuedAt(emitidoEm)
    .setExpirationTime(emitidoEm + VALIDADE_SESSAO_SEGUNDOS)
    .sign(chave(segredo))
}

/** Devolve o usuário se o token for válido e não expirado; em qualquer outro caso, `null`. */
export async function verificarTokenSessao(
  token: string,
  segredo: string,
  agora: Date = new Date(),
): Promise<{ usuario: string } | null> {
  try {
    const { payload } = await jwtVerify(token, chave(segredo), {
      algorithms: ['HS256'],
      currentDate: agora,
    })
    return typeof payload.sub === 'string' ? { usuario: payload.sub } : null
  } catch {
    return null
  }
}
```

- [ ] **Step 6: Rodar e ver passar**

Run: `npx vitest run src/auth/senha.test.ts src/auth/token.test.ts`
Expected: PASS.

- [ ] **Step 7: Escrever os testes do bloqueio**

Crie `src/auth/bloqueio.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { criarBancoDeTeste } from '../../tests/banco-de-teste'
import type { Db } from '@/db/tipos'
import { consultarBloqueio, limparFalhas, registrarFalha } from './bloqueio'

const IP = '203.0.113.7'
const agora = new Date('2026-09-14T12:00:00Z')
const minutosAtras = (minutos: number) => new Date(agora.getTime() - minutos * 60_000)

describe('bloqueio de tentativas de login', () => {
  let db: Db
  let fechar: () => Promise<void>

  beforeEach(async () => {
    ;({ db, fechar } = await criarBancoDeTeste())
  })

  afterEach(async () => {
    await fechar()
  })

  async function falhas(...minutos: number[]) {
    for (const m of minutos) await registrarFalha(db, IP, minutosAtras(m))
  }

  it('não bloqueia com 4 falhas na janela', async () => {
    await falhas(0, 1, 2, 3)
    expect(await consultarBloqueio(db, IP, agora)).toEqual({ bloqueado: false, minutosRestantes: 0 })
  })

  it('bloqueia na 5ª falha e diz quanto falta para liberar', async () => {
    await falhas(10, 8, 6, 4, 2)
    // A 5ª falha mais recente foi há 10 minutos: sai da janela de 15 em 5 minutos.
    expect(await consultarBloqueio(db, IP, agora)).toEqual({ bloqueado: true, minutosRestantes: 5 })
  })

  it('ignora falhas com mais de 15 minutos', async () => {
    await falhas(20, 18, 16, 3, 2)
    expect((await consultarBloqueio(db, IP, agora)).bloqueado).toBe(false)
  })

  it('conta cada IP separadamente', async () => {
    await falhas(0, 1, 2, 3, 4)
    expect((await consultarBloqueio(db, '198.51.100.1', agora)).bloqueado).toBe(false)
  })

  it('limpar as falhas desbloqueia o IP', async () => {
    await falhas(0, 1, 2, 3, 4)
    await limparFalhas(db, IP)
    expect((await consultarBloqueio(db, IP, agora)).bloqueado).toBe(false)
  })
})
```

- [ ] **Step 8: Rodar e ver falhar**

Run: `npx vitest run src/auth/bloqueio.test.ts`
Expected: FAIL com erro de import de `./bloqueio`.

- [ ] **Step 9: Implementar `src/auth/bloqueio.ts`**

```ts
import { and, desc, eq, gt } from 'drizzle-orm'
import { tentativasLogin } from '@/db/schema'
import type { Db } from '@/db/tipos'

export const MAX_TENTATIVAS = 5
export const JANELA_MINUTOS = 15

const JANELA_MS = JANELA_MINUTOS * 60_000

export type SituacaoBloqueio = { bloqueado: boolean; minutosRestantes: number }

export async function registrarFalha(db: Db, ip: string, agora: Date = new Date()): Promise<void> {
  await db.insert(tentativasLogin).values({ ip, criadoEm: agora })
}

/** Bloqueado enquanto houver 5 falhas nos últimos 15 minutos (janela deslizante). */
export async function consultarBloqueio(
  db: Db,
  ip: string,
  agora: Date = new Date(),
): Promise<SituacaoBloqueio> {
  const recentes = await db
    .select({ criadoEm: tentativasLogin.criadoEm })
    .from(tentativasLogin)
    .where(and(eq(tentativasLogin.ip, ip), gt(tentativasLogin.criadoEm, new Date(agora.getTime() - JANELA_MS))))
    .orderBy(desc(tentativasLogin.criadoEm))
    .limit(MAX_TENTATIVAS)

  if (recentes.length < MAX_TENTATIVAS) return { bloqueado: false, minutosRestantes: 0 }

  // Libera quando a 5ª falha mais recente sair da janela.
  const liberaEm = recentes[MAX_TENTATIVAS - 1].criadoEm.getTime() + JANELA_MS
  return {
    bloqueado: true,
    minutosRestantes: Math.max(1, Math.ceil((liberaEm - agora.getTime()) / 60_000)),
  }
}

export async function limparFalhas(db: Db, ip: string): Promise<void> {
  await db.delete(tentativasLogin).where(eq(tentativasLogin.ip, ip))
}
```

- [ ] **Step 10: Rodar e ver passar**

Run: `npx vitest run src/auth`
Expected: PASS em `senha`, `token` e `bloqueio`.

- [ ] **Step 11: Criar o script de credenciais**

Crie `scripts/gerar-credenciais.ts`:

```ts
import { randomBytes } from 'node:crypto'
import { stdin as input, stdout as output } from 'node:process'
import { createInterface } from 'node:readline/promises'
import { gerarHashSenha } from '../src/auth/senha'

async function principal() {
  const leitor = createInterface({ input, output })
  console.log('Atenção: a senha aparece na tela enquanto você digita.')
  const senha = await leitor.question('Senha do FinanceControl (mínimo 12 caracteres): ')
  leitor.close()

  if (senha.length < 12) {
    console.error('Senha muito curta: use pelo menos 12 caracteres.')
    process.exit(1)
  }

  console.log('\nCopie estas linhas para o .env.local e para as variáveis da Vercel:\n')
  console.log(`AUTH_SENHA_HASH=${await gerarHashSenha(senha)}`)
  console.log(`AUTH_SEGREDO=${randomBytes(32).toString('base64url')}`)
}

void principal()
```

Acrescente aos `"scripts"` do `package.json`:

```json
"credenciais": "tsx scripts/gerar-credenciais.ts"
```

Run (senha descartável, só para testar): `"senha-descartavel-123" | npm run credenciais`
Expected: duas linhas, `AUTH_SENHA_HASH=scrypt:65536:8:1:...` e `AUTH_SEGREDO=...`.

- [ ] **Step 12: Verificar e fazer commit**

Run: `npm run typecheck; npm run lint; npm test`
Expected: sem erros; todos os testes passando.

```powershell
git add package.json package-lock.json src/auth scripts
git commit -m "feat: autenticação — hash de senha, token de sessão e bloqueio de tentativas"
```

### Task 6: Banco Neon de desenvolvimento e variáveis locais

**Papel:** você (manual)

O orquestrador para aqui e mostra estes passos. Criar conta e escolher senha são ações suas; nenhum agente faz isso por você.

**Files:**
- Create: `.env.local` (fica fora do git)

**Interfaces:**
- Consumes: `npm run credenciais` (Tarefa 5) e `npm run db:migrate` (Tarefa 3).
- Produces: `.env.local` com `DATABASE_URL` (branch `dev`), `AUTH_USUARIO`, `AUTH_SENHA_HASH` e `AUTH_SEGREDO`; banco `dev` com as tabelas criadas.

- [ ] **Step 1: Criar o projeto no Neon**

Em <https://console.neon.tech>, entre com a conta do GitHub e clique em **New Project**:
- Nome: `financecontrol`
- Região: **AWS US East (N. Virginia)**, a mesma região padrão das funções da Vercel (`iad1`). Banco perto do servidor deixa cada consulta rápida.

- [ ] **Step 2: Criar a branch `dev`**

No projeto, abra **Branches → Create branch**, com nome `dev` e origem `main`. Assim, os testes no seu PC nunca tocam nos dados de produção.

- [ ] **Step 3: Copiar a conexão da branch `dev`**

Clique em **Connect**, escolha a branch `dev` e copie a connection string **sem pooler** (o endereço não pode ter `-pooler`). Ela começa com `postgresql://`.

- [ ] **Step 4: Gerar as credenciais do login**

Run: `npm run credenciais`
Digite a senha real que o dono vai usar e guarde-a num gerenciador de senhas. Copie as duas linhas que aparecerem.

- [ ] **Step 5: Criar o `.env.local`**

Na raiz da pasta onde o plano está sendo executado (se o orquestrador criou uma worktree, é nela), crie `.env.local`:

```dotenv
DATABASE_URL=postgresql://COLE-AQUI-A-CONEXAO-DA-BRANCH-DEV
AUTH_USUARIO=escolha-um-usuario
AUTH_SENHA_HASH=COLE-AQUI-A-LINHA-DO-PASSO-4
AUTH_SEGREDO=COLE-AQUI-A-LINHA-DO-PASSO-4
```

- [ ] **Step 6: Criar as tabelas no banco `dev`**

Run: `npm run db:migrate`
Expected: migração aplicada sem erro. No Neon, em **Tables** da branch `dev`, aparecem `pessoas`, `categorias`, `lancamentos` e `tentativas_login`.

- [ ] **Step 7: Confirmar que os segredos não vão para o git**

Run: `git status --short`
Expected: `.env.local` **não** aparece na lista.

Avise o orquestrador ("Tarefa 6 concluída") para a execução continuar.

### Task 7: Login e porteiro das rotas

**Papel:** construtor

**Files:**
- Create: `.env.example`, `src/env.ts`, `src/db/cliente.ts`, `src/auth/cookie.ts`, `src/auth/http.ts`, `src/auth/login.ts`, `src/auth/sessao.ts`, `src/proxy.ts`, `src/app/login/page.tsx`, `src/app/login/formulario-login.tsx`, `src/app/login/actions.ts`
- Modify: `src/app/page.tsx`, `next.config.ts`, `package.json` (dependências)
- Test: `src/env.test.ts`, `src/auth/http.test.ts`, `src/auth/login.test.ts`

**Interfaces:**
- Consumes: `Db`, `tentativasLogin` e `criarBancoDeTeste()` (Tarefa 3); `verificarSenha`, `gerarHashSenha`, `criarTokenSessao`, `verificarTokenSessao`, `VALIDADE_SESSAO_SEGUNDOS`, `consultarBloqueio`, `registrarFalha`, `limparFalhas` (Tarefa 5); `.env.local` (Tarefa 6).
- Produces:
  - `type Env = { DATABASE_URL: string; AUTH_USUARIO: string; AUTH_SENHA_HASH: string; AUTH_SEGREDO: string }`, `lerEnv(fonte: Record<string, string | undefined>): Env` e `obterEnv(): Env` (em `src/env.ts`)
  - `obterDb(): Db` (em `src/db/cliente.ts`, só no servidor)
  - `COOKIE_SESSAO = 'fc_sessao'` (em `src/auth/cookie.ts`)
  - `obterIp(cabecalhos: Headers): string`, `destinoSeguro(voltar: string | null | undefined): string` e `DESTINO_PADRAO = '/lancamentos'` (em `src/auth/http.ts`)
  - `type ResultadoLogin = { ok: true } | { ok: false; erro: string }` e `autenticar(db: Db, credenciais: { usuario: string; senha: string }, esperado: { usuario: string; senhaHash: string }, ip: string): Promise<ResultadoLogin>` (em `src/auth/login.ts`)
  - `iniciarSessao(usuario: string): Promise<void>`, `encerrarSessao(): Promise<void>`, `obterSessao(): Promise<{ usuario: string } | null>` e `exigirSessao(): Promise<{ usuario: string }>` (em `src/auth/sessao.ts`, só no servidor)
  - Server Actions `entrar(anterior: EstadoLogin, dados: FormData)` e `sair()` (em `src/app/login/actions.ts`)

- [ ] **Step 1: Instalar as dependências**

```powershell
npm install @neondatabase/serverless@1 zod@4 server-only
```

`server-only` faz o build falhar se um arquivo de servidor (com segredos) for importado por um componente de navegador.

- [ ] **Step 2: Escrever os testes de ambiente, HTTP e login**

Crie `src/env.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { lerEnv } from './env'

const valido = {
  DATABASE_URL: 'postgresql://usuario:senha@host.neon.tech/neondb?sslmode=require',
  AUTH_USUARIO: 'dono',
  AUTH_SENHA_HASH: 'scrypt:65536:8:1:abc:def',
  AUTH_SEGREDO: 'x'.repeat(32),
}

describe('lerEnv', () => {
  it('aceita variáveis válidas', () => {
    expect(lerEnv(valido)).toEqual(valido)
  })

  it('explica cada variável com problema na mesma mensagem', () => {
    let mensagem = ''
    try {
      lerEnv({ ...valido, AUTH_SEGREDO: 'curto', AUTH_USUARIO: undefined })
    } catch (erro) {
      mensagem = (erro as Error).message
    }
    expect(mensagem).toContain('AUTH_SEGREDO')
    expect(mensagem).toContain('AUTH_USUARIO')
  })

  it('recusa hash de senha que não é scrypt', () => {
    expect(() => lerEnv({ ...valido, AUTH_SENHA_HASH: 'bcrypt-abc' })).toThrow('scrypt:')
  })
})
```

Crie `src/auth/http.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { DESTINO_PADRAO, destinoSeguro, obterIp } from './http'

describe('obterIp', () => {
  it('usa o primeiro IP do x-forwarded-for', () => {
    expect(obterIp(new Headers({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' }))).toBe('203.0.113.7')
  })

  it('usa o x-real-ip quando não há x-forwarded-for', () => {
    expect(obterIp(new Headers({ 'x-real-ip': '198.51.100.1' }))).toBe('198.51.100.1')
  })

  it('devolve "desconhecido" sem cabeçalhos', () => {
    expect(obterIp(new Headers())).toBe('desconhecido')
  })
})

describe('destinoSeguro', () => {
  it('aceita caminho interno com query', () => {
    expect(destinoSeguro('/lancamentos?mes=2026-09')).toBe('/lancamentos?mes=2026-09')
  })

  it.each([null, undefined, '', 'https://site-malicioso.com', '//site-malicioso.com', '/\\site-malicioso.com', '/login'])(
    'troca "%s" pelo destino padrão',
    (voltar) => {
      expect(destinoSeguro(voltar)).toBe(DESTINO_PADRAO)
    },
  )
})
```

Crie `src/auth/login.test.ts`:

```ts
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { criarBancoDeTeste } from '../../tests/banco-de-teste'
import { tentativasLogin } from '@/db/schema'
import type { Db } from '@/db/tipos'
import { consultarBloqueio, registrarFalha } from './bloqueio'
import { autenticar } from './login'
import { gerarHashSenha } from './senha'

const IP = '203.0.113.7'

describe('autenticar', () => {
  let db: Db
  let fechar: () => Promise<void>
  let esperado: { usuario: string; senhaHash: string }

  beforeAll(async () => {
    esperado = { usuario: 'dono', senhaHash: await gerarHashSenha('senha-certa-123') }
  })

  beforeEach(async () => {
    ;({ db, fechar } = await criarBancoDeTeste())
  })

  afterEach(async () => {
    await fechar()
  })

  it('entra com usuário e senha certos e apaga as falhas anteriores', async () => {
    await registrarFalha(db, IP)

    expect(await autenticar(db, { usuario: 'dono', senha: 'senha-certa-123' }, esperado, IP)).toEqual({ ok: true })

    // Se a falha antiga não tivesse sido apagada, estas 4 completariam 5 e bloqueariam.
    for (let i = 0; i < 4; i++) await registrarFalha(db, IP)
    expect((await consultarBloqueio(db, IP)).bloqueado).toBe(false)
  })

  it.each([
    ['senha errada', { usuario: 'dono', senha: 'senha-errada' }],
    ['usuário errado', { usuario: 'outro', senha: 'senha-certa-123' }],
  ])('recusa %s com mensagem genérica e registra a falha', async (_, credenciais) => {
    expect(await autenticar(db, credenciais, esperado, IP)).toEqual({
      ok: false,
      erro: 'Usuário ou senha incorretos.',
    })
    expect(await db.select().from(tentativasLogin)).toHaveLength(1)
  })

  it('bloqueia depois de 5 falhas, mesmo com a senha certa', async () => {
    for (let i = 0; i < 5; i++) {
      await autenticar(db, { usuario: 'dono', senha: 'senha-errada' }, esperado, IP)
    }

    expect(await autenticar(db, { usuario: 'dono', senha: 'senha-certa-123' }, esperado, IP)).toEqual({
      ok: false,
      erro: 'Muitas tentativas. Tente de novo em 15 minutos.',
    })
  })
})
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx vitest run src/env.test.ts src/auth/http.test.ts src/auth/login.test.ts`
Expected: FAIL com erros de import de `./env`, `./http` e `./login`.

- [ ] **Step 4: Implementar ambiente, HTTP e login**

Crie `src/env.ts`:

```ts
import { z } from 'zod'

const esquema = z.object({
  DATABASE_URL: z.string().startsWith('postgres', 'DATABASE_URL precisa ser uma conexão postgresql://'),
  AUTH_USUARIO: z.string().trim().min(1, 'AUTH_USUARIO está vazio'),
  AUTH_SENHA_HASH: z
    .string()
    .startsWith('scrypt:', 'AUTH_SENHA_HASH precisa começar com "scrypt:" (gere com npm run credenciais)'),
  AUTH_SEGREDO: z.string().min(32, 'AUTH_SEGREDO precisa ter pelo menos 32 caracteres'),
})

export type Env = z.infer<typeof esquema>

/** Valida as variáveis e junta todos os problemas numa mensagem só. */
export function lerEnv(fonte: Record<string, string | undefined>): Env {
  const resultado = esquema.safeParse(fonte)
  if (!resultado.success) {
    const problemas = resultado.error.issues
      .map((problema) => `- ${problema.path.join('.')}: ${problema.message}`)
      .join('\n')
    throw new Error(`Variáveis de ambiente inválidas:\n${problemas}`)
  }
  return resultado.data
}

let cache: Env | undefined

/** Lê e valida uma única vez. Use só no servidor. */
export function obterEnv(): Env {
  cache ??= lerEnv(process.env)
  return cache
}
```

Crie `src/auth/cookie.ts`:

```ts
// Separado de sessao.ts porque o proxy também precisa do nome e não pode importar next/headers.
export const COOKIE_SESSAO = 'fc_sessao'
```

Crie `src/auth/http.ts`:

```ts
export const DESTINO_PADRAO = '/lancamentos'

/** Na Vercel, o x-forwarded-for traz o IP real de quem acessou. */
export function obterIp(cabecalhos: Headers): string {
  const encaminhado = cabecalhos.get('x-forwarded-for')?.split(',')[0]?.trim()
  return encaminhado || cabecalhos.get('x-real-ip')?.trim() || 'desconhecido'
}

/**
 * Evita "open redirect": depois do login, só volta para caminhos internos.
 * "//site.com" e "/\site.com" são tratados por navegadores como outro site.
 */
export function destinoSeguro(voltar: string | null | undefined): string {
  if (!voltar || !voltar.startsWith('/') || voltar.startsWith('//') || voltar.startsWith('/\\')) {
    return DESTINO_PADRAO
  }
  if (voltar.startsWith('/login')) return DESTINO_PADRAO
  return voltar
}
```

Crie `src/auth/login.ts`:

```ts
import type { Db } from '@/db/tipos'
import { consultarBloqueio, limparFalhas, registrarFalha } from './bloqueio'
import { verificarSenha } from './senha'

export type ResultadoLogin = { ok: true } | { ok: false; erro: string }

export async function autenticar(
  db: Db,
  credenciais: { usuario: string; senha: string },
  esperado: { usuario: string; senhaHash: string },
  ip: string,
): Promise<ResultadoLogin> {
  const bloqueio = await consultarBloqueio(db, ip)
  if (bloqueio.bloqueado) {
    const minutos = bloqueio.minutosRestantes
    return {
      ok: false,
      erro: `Muitas tentativas. Tente de novo em ${minutos} ${minutos === 1 ? 'minuto' : 'minutos'}.`,
    }
  }

  // Confere a senha mesmo com usuário errado: assim a demora não revela qual dos dois errou.
  const senhaConfere = await verificarSenha(credenciais.senha, esperado.senhaHash)
  if (senhaConfere && credenciais.usuario === esperado.usuario) {
    await limparFalhas(db, ip)
    return { ok: true }
  }

  await registrarFalha(db, ip)
  return { ok: false, erro: 'Usuário ou senha incorretos.' }
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run src/env.test.ts src/auth`
Expected: PASS.

- [ ] **Step 6: Conexão com o Neon e sessão**

Crie `src/db/cliente.ts`:

```ts
import 'server-only'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { obterEnv } from '@/env'
import * as schema from './schema'
import type { Db } from './tipos'

let db: Db | undefined

/** Conexão HTTP com o Neon, criada na primeira vez que alguém precisa dela. */
export function obterDb(): Db {
  db ??= drizzle({ client: neon(obterEnv().DATABASE_URL), schema })
  return db
}
```

Crie `src/auth/sessao.ts`:

```ts
import 'server-only'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { obterEnv } from '@/env'
import { COOKIE_SESSAO } from './cookie'
import { criarTokenSessao, VALIDADE_SESSAO_SEGUNDOS, verificarTokenSessao } from './token'

export async function iniciarSessao(usuario: string): Promise<void> {
  const token = await criarTokenSessao(usuario, obterEnv().AUTH_SEGREDO)
  const loja = await cookies()
  loja.set(COOKIE_SESSAO, token, {
    httpOnly: true, // o JavaScript da página não consegue ler o cookie
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: VALIDADE_SESSAO_SEGUNDOS,
  })
}

export async function encerrarSessao(): Promise<void> {
  const loja = await cookies()
  loja.delete(COOKIE_SESSAO)
}

export async function obterSessao(): Promise<{ usuario: string } | null> {
  const token = (await cookies()).get(COOKIE_SESSAO)?.value
  if (!token) return null
  const env = obterEnv()
  const sessao = await verificarTokenSessao(token, env.AUTH_SEGREDO)
  // Se o usuário do .env mudar, sessões antigas deixam de valer.
  return sessao?.usuario === env.AUTH_USUARIO ? sessao : null
}

/**
 * Primeira linha de toda Server Action e de todo Route Handler protegido.
 * O proxy protege as páginas, mas uma action é um POST que pode ser chamado direto.
 */
export async function exigirSessao(): Promise<{ usuario: string }> {
  const sessao = await obterSessao()
  if (!sessao) redirect('/login')
  return sessao
}
```

- [ ] **Step 7: Porteiro, tela de login e redirecionamento inicial**

Crie `src/proxy.ts`:

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { COOKIE_SESSAO } from '@/auth/cookie'
import { verificarTokenSessao } from '@/auth/token'
import { obterEnv } from '@/env'

// No Next 16 o antigo "middleware" se chama "proxy": roda antes de cada rota do matcher.
export async function proxy(requisicao: NextRequest) {
  const token = requisicao.cookies.get(COOKIE_SESSAO)?.value
  const env = obterEnv()
  const sessao = token ? await verificarTokenSessao(token, env.AUTH_SEGREDO) : null
  if (sessao?.usuario === env.AUTH_USUARIO) return NextResponse.next()

  const destino = requisicao.nextUrl.clone()
  destino.pathname = '/login'
  destino.search = `?voltar=${encodeURIComponent(requisicao.nextUrl.pathname + requisicao.nextUrl.search)}`
  return NextResponse.redirect(destino)
}

export const config = {
  // Tudo, menos a tela de login, os arquivos internos do Next e arquivos com extensão (ícones etc.).
  matcher: ['/((?!login|_next/static|_next/image|favicon.ico|.*\\.\\w+$).*)'],
}
```

Crie `src/app/login/actions.ts`:

```ts
'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { destinoSeguro, obterIp } from '@/auth/http'
import { autenticar } from '@/auth/login'
import { encerrarSessao, iniciarSessao } from '@/auth/sessao'
import { obterDb } from '@/db/cliente'
import { obterEnv } from '@/env'

export type EstadoLogin = { erro: string | null }

// Única action sem exigirSessao(): é ela que cria a sessão.
export async function entrar(_anterior: EstadoLogin, dados: FormData): Promise<EstadoLogin> {
  const env = obterEnv()
  const usuario = String(dados.get('usuario') ?? '').trim()
  const resultado = await autenticar(
    obterDb(),
    { usuario, senha: String(dados.get('senha') ?? '') },
    { usuario: env.AUTH_USUARIO, senhaHash: env.AUTH_SENHA_HASH },
    obterIp(await headers()),
  )
  if (!resultado.ok) return { erro: resultado.erro }

  await iniciarSessao(usuario)
  redirect(destinoSeguro(String(dados.get('voltar') ?? '')))
}

export async function sair(): Promise<void> {
  await encerrarSessao()
  redirect('/login')
}
```

Crie `src/app/login/formulario-login.tsx`:

```tsx
'use client'

import { useActionState } from 'react'
import { entrar, type EstadoLogin } from './actions'

const estadoInicial: EstadoLogin = { erro: null }

export function FormularioLogin({ voltar }: { voltar: string }) {
  const [estado, acao, enviando] = useActionState(entrar, estadoInicial)

  return (
    <form action={acao} className="flex flex-col gap-4">
      <input type="hidden" name="voltar" value={voltar} />
      <label className="flex flex-col gap-1 text-sm">
        Usuário
        {/* text-base (16px) evita o zoom automático do iPhone ao tocar no campo */}
        <input name="usuario" autoComplete="username" required className="rounded-md border px-3 py-2 text-base" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Senha
        <input
          name="senha"
          type="password"
          autoComplete="current-password"
          required
          className="rounded-md border px-3 py-2 text-base"
        />
      </label>
      {estado.erro && (
        <p role="alert" className="text-sm text-red-600">
          {estado.erro}
        </p>
      )}
      <button
        type="submit"
        disabled={enviando}
        className="rounded-md bg-neutral-900 px-3 py-2 text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
      >
        {enviando ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  )
}
```

Crie `src/app/login/page.tsx`:

```tsx
import { redirect } from 'next/navigation'
import { destinoSeguro } from '@/auth/http'
import { obterSessao } from '@/auth/sessao'
import { FormularioLogin } from './formulario-login'

export default async function PaginaLogin({
  searchParams,
}: {
  searchParams: Promise<{ voltar?: string }>
}) {
  const destino = destinoSeguro((await searchParams).voltar)
  if (await obterSessao()) redirect(destino)

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 p-6">
      <h1 className="text-2xl font-semibold">FinanceControl</h1>
      <FormularioLogin voltar={destino} />
    </main>
  )
}
```

Substitua todo o conteúdo de `src/app/page.tsx` por:

```tsx
import { redirect } from 'next/navigation'

// Até o Plano 2 (tela "Quem me deve"), a entrada do site é a lista do mês.
export default function Inicio() {
  redirect('/lancamentos')
}
```

Em `next.config.ts`, mantenha as opções que já existirem e acrescente `headers()`. Com a configuração padrão do template, o arquivo fica:

```ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'same-origin' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
        ],
      },
    ]
  },
}

export default nextConfig
```

Crie `.env.example`:

```dotenv
# Copie para .env.local e preencha. O .env.local nunca vai para o git.
# Neon: branch dev no seu PC; a branch main só nas variáveis de produção da Vercel.
DATABASE_URL=postgresql://usuario:senha@host.neon.tech/neondb?sslmode=require
# Login do dono do sistema
AUTH_USUARIO=
# Gere as duas com: npm run credenciais
AUTH_SENHA_HASH=
AUTH_SEGREDO=
```

- [ ] **Step 8: Verificar o porteiro com o servidor rodando**

Run: `npm run build`
Expected: build concluído (ele precisa do `.env.local` da Tarefa 6).

Run, em um terminal: `npm run dev`. Em outro:

```powershell
curl.exe -s -o NUL -w "%{http_code} %{redirect_url}`n" http://localhost:3000/lancamentos
curl.exe -s -o NUL -w "%{http_code}`n" http://localhost:3000/login
```

Expected: a primeira linha mostra `307 http://localhost:3000/login?voltar=%2Flancamentos`; a segunda mostra `200`. Encerre o `npm run dev` depois.

- [ ] **Step 9: Verificar e fazer commit**

Run: `npm run typecheck; npm run lint; npm test`
Expected: sem erros; todos os testes passando.

```powershell
git add .env.example package.json package-lock.json next.config.ts src
git commit -m "feat: login com sessão, bloqueio de tentativas e porteiro das rotas"
```

### Task 8: Casca do app e tela Lançar

**Papel:** construtor

**Files:**
- Create (gerados pelo shadcn): `components.json`, `src/lib/utils.ts`, `src/components/ui/button.tsx`, `src/components/ui/input.tsx`, `src/components/ui/label.tsx`, `src/components/ui/switch.tsx`
- Create: `src/components/navegacao.tsx`, `src/app/(app)/layout.tsx`, `src/app/(app)/lancamentos/novo/page.tsx`, `src/app/(app)/lancamentos/novo/formulario-lancamento.tsx`, `src/app/(app)/lancamentos/novo/actions.ts`, `src/app/(app)/lancamentos/novo/validacao.ts`
- Modify: `src/app/layout.tsx` (idioma e título), `src/app/globals.css` (alterado pelo shadcn)
- Test: `src/app/(app)/lancamentos/novo/validacao.test.ts`

**Interfaces:**
- Consumes: `exigirSessao()` e `sair()` (Tarefa 7); `obterDb()` (Tarefa 7); `listarPessoasAtivas`, `listarCategoriasAtivas`, `obterOuCriarPessoa`, `obterOuCriarCategoria`, `criarLancamento` (Tarefa 4); `paraCentavos` (Tarefa 1); `hojeEmSaoPaulo`, `sugerirMesFatura`, `mesParaTexto`, `lerMes`, `ehDataValida` (Tarefa 2).
- Produces:
  - `type CampoFormulario = 'pessoa' | 'categoria' | 'item' | 'valor' | 'dataCompra' | 'mesFatura' | 'parcelaAtual' | 'qtdParcelas'`
  - `type LancamentoValidado = { pessoa: string; categoria: string; item: string; valorCentavos: number; dataCompra: string; mesFatura: string; parcelaAtual: number; qtdParcelas: number | null; recorrente: boolean; pagamento: 'NAO' | 'SIM'; pagoEm: string | null }`
  - `validarFormularioLancamento(entrada: Record<string, FormDataEntryValue | undefined>, hoje: string): { ok: true; dados: LancamentoValidado } | { ok: false; erros: Partial<Record<CampoFormulario, string>> }`
  - Server Action `salvarLancamento(dados: FormData): Promise<ResultadoSalvar>`, com `ResultadoSalvar = { ok: true } | { ok: false; erros: Partial<Record<CampoFormulario, string>>; erroGeral?: string }`. Com `depois=lista`, redireciona para `/lancamentos?mes=AAAA-MM`.
  - Layout `(app)`, com navegação, que envolve todas as páginas logadas.

- [ ] **Step 1: Instalar o shadcn/ui e os componentes**

```powershell
npx --yes shadcn@4 init --defaults --yes
npx --yes shadcn@4 add button input label switch
```

Expected: cria `components.json`, `src/lib/utils.ts` e `src/components/ui/`, e acrescenta as variáveis de tema ao `src/app/globals.css`. Se o `init` fizer perguntas mesmo assim, escolha: estilo padrão, cor base `neutral` e variáveis CSS ligadas.

- [ ] **Step 2: Ajustar idioma e título do site**

Em `src/app/layout.tsx`, troque `lang="en"` por `lang="pt-BR"` e substitua o objeto `metadata` por:

```ts
export const metadata: Metadata = {
  title: 'FinanceControl',
  description: 'Controle do cartão compartilhado',
}
```

- [ ] **Step 3: Escrever o teste da validação do formulário**

Crie `src/app/(app)/lancamentos/novo/validacao.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { validarFormularioLancamento, type CampoFormulario } from './validacao'

const hoje = '2026-09-14'

function entrada(alteracoes: Record<string, string | undefined> = {}) {
  return {
    pessoa: 'Ana',
    categoria: 'Mercado',
    item: 'Compra',
    valor: '1.234,56',
    dataCompra: '2026-09-14',
    mesFatura: '2026-10',
    parcelaAtual: '1',
    qtdParcelas: '3',
    ...alteracoes,
  }
}

describe('validarFormularioLancamento', () => {
  it('converte um formulário válido para os tipos do banco', () => {
    expect(validarFormularioLancamento(entrada(), hoje)).toEqual({
      ok: true,
      dados: {
        pessoa: 'Ana',
        categoria: 'Mercado',
        item: 'Compra',
        valorCentavos: 123456,
        dataCompra: '2026-09-14',
        mesFatura: '2026-10-01',
        parcelaAtual: 1,
        qtdParcelas: 3,
        recorrente: false,
        pagamento: 'NAO',
        pagoEm: null,
      },
    })
  })

  it('"É crédito?" grava o valor negativo', () => {
    const resultado = validarFormularioLancamento(entrada({ credito: 'on' }), hoje)
    expect(resultado.ok && resultado.dados.valorCentavos).toBe(-123456)
  })

  it('recorrente ignora a quantidade de parcelas', () => {
    const resultado = validarFormularioLancamento(entrada({ recorrente: 'on', qtdParcelas: undefined }), hoje)
    expect(resultado.ok && resultado.dados).toMatchObject({ recorrente: true, qtdParcelas: null })
  })

  it('"Já recebi" grava SIM com a data de hoje', () => {
    const resultado = validarFormularioLancamento(entrada({ recebido: 'on' }), hoje)
    expect(resultado.ok && resultado.dados).toMatchObject({ pagamento: 'SIM', pagoEm: hoje })
  })

  it.each([
    ['pessoa', { pessoa: '   ' }],
    ['categoria', { categoria: '' }],
    ['item', { item: '' }],
    ['valor', { valor: 'abc' }],
    ['valor', { valor: '0,00' }],
    ['dataCompra', { dataCompra: '2026-02-30' }],
    ['mesFatura', { mesFatura: '2026-13' }],
    ['parcelaAtual', { parcelaAtual: '0' }],
    ['parcelaAtual', { parcelaAtual: '4', qtdParcelas: '3' }],
    ['qtdParcelas', { qtdParcelas: undefined }],
  ])('aponta erro no campo %s', (campo, alteracoes) => {
    const resultado = validarFormularioLancamento(entrada(alteracoes), hoje)
    expect(resultado.ok).toBe(false)
    if (!resultado.ok) expect(resultado.erros[campo as CampoFormulario]).toBeTruthy()
  })
})
```

- [ ] **Step 4: Rodar e ver falhar**

Run: `npx vitest run "src/app/(app)/lancamentos/novo/validacao.test.ts"`
Expected: FAIL com erro de import de `./validacao`.

- [ ] **Step 5: Implementar a validação**

Crie `src/app/(app)/lancamentos/novo/validacao.ts`:

```ts
import { z } from 'zod'
import { ehDataValida, lerMes } from '@/domain/datas'
import { paraCentavos } from '@/domain/dinheiro'

export type CampoFormulario =
  | 'pessoa'
  | 'categoria'
  | 'item'
  | 'valor'
  | 'dataCompra'
  | 'mesFatura'
  | 'parcelaAtual'
  | 'qtdParcelas'

export type LancamentoValidado = {
  pessoa: string
  categoria: string
  item: string
  valorCentavos: number
  dataCompra: string
  mesFatura: string
  parcelaAtual: number
  qtdParcelas: number | null
  recorrente: boolean
  pagamento: 'NAO' | 'SIM'
  pagoEm: string | null
}

type Erros = Partial<Record<CampoFormulario, string>>

const esquema = z.object({
  pessoa: z.string().trim().min(1, 'Informe a pessoa'),
  categoria: z.string().trim().min(1, 'Informe a categoria'),
  item: z.string().trim().min(1, 'Informe o item'),
  valor: z.string().refine((texto) => {
    const centavos = paraCentavos(texto)
    return centavos !== null && centavos !== 0
  }, 'Valor inválido: use o formato 1.234,56'),
  credito: z.string().optional(),
  dataCompra: z.string().refine(ehDataValida, 'Data da compra inválida'),
  mesFatura: z.string().refine((texto) => lerMes(texto) !== null, 'Mês da fatura inválido'),
  parcelaAtual: z.coerce.number().int('Use um número inteiro').min(1, 'A parcela começa em 1').max(99, 'No máximo 99'),
  qtdParcelas: z.coerce.number().int('Use um número inteiro').min(1, 'No mínimo 1').max(99, 'No máximo 99').optional(),
  recorrente: z.string().optional(),
  recebido: z.string().optional(),
})

/** Recebe os campos do formulário (texto) e devolve os dados prontos para o banco, ou os erros por campo. */
export function validarFormularioLancamento(
  entrada: Record<string, FormDataEntryValue | undefined>,
  hoje: string,
): { ok: true; dados: LancamentoValidado } | { ok: false; erros: Erros } {
  const resultado = esquema.safeParse(entrada)
  const erros: Erros = {}

  if (!resultado.success) {
    for (const problema of resultado.error.issues) {
      const campo = problema.path[0] as CampoFormulario
      erros[campo] ??= problema.message
    }
    return { ok: false, erros }
  }

  const d = resultado.data
  const recorrente = d.recorrente === 'on'
  if (!recorrente && d.qtdParcelas === undefined) erros.qtdParcelas = 'Informe a quantidade de parcelas'
  if (!recorrente && d.qtdParcelas !== undefined && d.parcelaAtual > d.qtdParcelas) {
    erros.parcelaAtual = 'A parcela não pode passar da quantidade'
  }
  if (Object.keys(erros).length > 0) return { ok: false, erros }

  // O refine acima já garantiu que estes valores existem.
  const centavos = paraCentavos(d.valor) as number
  const recebido = d.recebido === 'on'

  return {
    ok: true,
    dados: {
      pessoa: d.pessoa,
      categoria: d.categoria,
      item: d.item,
      valorCentavos: d.credito === 'on' ? -Math.abs(centavos) : centavos,
      dataCompra: d.dataCompra,
      mesFatura: lerMes(d.mesFatura) as string,
      parcelaAtual: d.parcelaAtual,
      qtdParcelas: recorrente ? null : (d.qtdParcelas as number),
      recorrente,
      pagamento: recebido ? 'SIM' : 'NAO',
      pagoEm: recebido ? hoje : null,
    },
  }
}
```

- [ ] **Step 6: Rodar e ver passar**

Run: `npx vitest run "src/app/(app)/lancamentos/novo/validacao.test.ts"`
Expected: PASS.

- [ ] **Step 7: Criar a action de salvar**

Crie `src/app/(app)/lancamentos/novo/actions.ts`:

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { exigirSessao } from '@/auth/sessao'
import { obterOuCriarCategoria, obterOuCriarPessoa } from '@/db/cadastros'
import { obterDb } from '@/db/cliente'
import { criarLancamento } from '@/db/lancamentos'
import { hojeEmSaoPaulo, mesParaTexto } from '@/domain/datas'
import { validarFormularioLancamento, type CampoFormulario } from './validacao'

export type ResultadoSalvar =
  | { ok: true }
  | { ok: false; erros: Partial<Record<CampoFormulario, string>>; erroGeral?: string }

export async function salvarLancamento(dados: FormData): Promise<ResultadoSalvar> {
  await exigirSessao()

  const validacao = validarFormularioLancamento(Object.fromEntries(dados), hojeEmSaoPaulo())
  if (!validacao.ok) return { ok: false, erros: validacao.erros }

  const { pessoa, categoria, ...lancamento } = validacao.dados
  try {
    const db = obterDb()
    const [{ id: pessoaId }, { id: categoriaId }] = await Promise.all([
      obterOuCriarPessoa(db, pessoa),
      obterOuCriarCategoria(db, categoria),
    ])
    await criarLancamento(db, { ...lancamento, pessoaId, categoriaId })
  } catch (erro) {
    console.error('Falha ao salvar lançamento', erro)
    return { ok: false, erros: {}, erroGeral: 'Não foi possível salvar. Tente de novo.' }
  }

  revalidatePath('/lancamentos')
  if (dados.get('depois') === 'outro') return { ok: true }
  // redirect fica fora do try: ele funciona lançando uma exceção especial do Next.
  redirect(`/lancamentos?mes=${mesParaTexto(lancamento.mesFatura)}`)
}
```

- [ ] **Step 8: Criar o formulário**

Crie `src/app/(app)/lancamentos/novo/formulario-lancamento.tsx`:

```tsx
'use client'

import { useState, useTransition, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { ehDataValida, mesParaTexto, sugerirMesFatura } from '@/domain/datas'
import { salvarLancamento } from './actions'
import type { CampoFormulario } from './validacao'

type Erros = Partial<Record<CampoFormulario, string>>

function Campo(props: { id: string; rotulo: string; erro?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={props.id}>{props.rotulo}</Label>
      {props.children}
      {props.erro && (
        <p role="alert" className="text-sm text-destructive">
          {props.erro}
        </p>
      )}
    </div>
  )
}

function Interruptor(props: { id: string; rotulo: string; ligado: boolean; aoMudar: (ligado: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Label htmlFor={props.id}>{props.rotulo}</Label>
      <Switch id={props.id} checked={props.ligado} onCheckedChange={props.aoMudar} />
    </div>
  )
}

export function FormularioLancamento(props: { hoje: string; pessoas: string[]; categorias: string[] }) {
  const [pessoa, setPessoa] = useState('')
  const [valor, setValor] = useState('')
  const [credito, setCredito] = useState(false)
  const [item, setItem] = useState('')
  const [categoria, setCategoria] = useState('')
  const [dataCompra, setDataCompra] = useState(props.hoje)
  const [mesFatura, setMesFatura] = useState(mesParaTexto(sugerirMesFatura(props.hoje)))
  const [mesEscolhidoAMao, setMesEscolhidoAMao] = useState(false)
  const [parcelaAtual, setParcelaAtual] = useState('1')
  const [qtdParcelas, setQtdParcelas] = useState('1')
  const [recorrente, setRecorrente] = useState(false)
  const [recebido, setRecebido] = useState(false)
  const [erros, setErros] = useState<Erros>({})
  const [aviso, setAviso] = useState<string | null>(null)
  const [enviando, iniciarEnvio] = useTransition()

  function mudarDataCompra(nova: string) {
    setDataCompra(nova)
    // Enquanto ninguém escolheu o mês à mão, ele acompanha a regra do fechamento (R3).
    if (!mesEscolhidoAMao && ehDataValida(nova)) setMesFatura(mesParaTexto(sugerirMesFatura(nova)))
  }

  function enviar(depois: 'lista' | 'outro') {
    const dados = new FormData()
    dados.set('pessoa', pessoa)
    dados.set('valor', valor)
    dados.set('item', item)
    dados.set('categoria', categoria)
    dados.set('dataCompra', dataCompra)
    dados.set('mesFatura', mesFatura)
    dados.set('parcelaAtual', parcelaAtual)
    if (recorrente) dados.set('recorrente', 'on')
    else dados.set('qtdParcelas', qtdParcelas)
    if (credito) dados.set('credito', 'on')
    if (recebido) dados.set('recebido', 'on')
    dados.set('depois', depois)

    iniciarEnvio(async () => {
      const resultado = await salvarLancamento(dados)
      if (!resultado.ok) {
        setErros(resultado.erros)
        setAviso(resultado.erroGeral ?? null)
        return
      }
      // "Salvar e lançar outro": mantém pessoa, data da compra e mês da fatura; limpa o resto.
      setValor('')
      setItem('')
      setCategoria('')
      setCredito(false)
      setParcelaAtual('1')
      setQtdParcelas('1')
      setRecorrente(false)
      setRecebido(false)
      setErros({})
      setAviso('Lançamento salvo. Pode lançar o próximo.')
    })
  }

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(evento) => {
        evento.preventDefault()
        enviar('lista')
      }}
    >
      <Campo id="pessoa" rotulo="Pessoa" erro={erros.pessoa}>
        <Input id="pessoa" list="lista-pessoas" autoComplete="off" value={pessoa} onChange={(e) => setPessoa(e.target.value)} />
        {/* datalist: sugere os nomes existentes, mas aceita um nome novo (que é criado ao salvar) */}
        <datalist id="lista-pessoas">
          {props.pessoas.map((nome) => (
            <option key={nome} value={nome} />
          ))}
        </datalist>
      </Campo>

      <Campo id="valor" rotulo="Valor (R$)" erro={erros.valor}>
        {/* inputMode="decimal" abre o teclado numérico com vírgula no celular */}
        <Input id="valor" inputMode="decimal" placeholder="0,00" value={valor} onChange={(e) => setValor(e.target.value)} />
      </Campo>
      {/* O teclado decimal do iPhone não tem sinal de menos: o crédito vira um interruptor. */}
      <Interruptor id="credito" rotulo="É crédito (abate do que a pessoa deve)?" ligado={credito} aoMudar={setCredito} />

      <Campo id="item" rotulo="Item" erro={erros.item}>
        <Input id="item" value={item} onChange={(e) => setItem(e.target.value)} />
      </Campo>

      <Campo id="categoria" rotulo="Categoria" erro={erros.categoria}>
        <Input id="categoria" list="lista-categorias" autoComplete="off" value={categoria} onChange={(e) => setCategoria(e.target.value)} />
        <datalist id="lista-categorias">
          {props.categorias.map((nome) => (
            <option key={nome} value={nome} />
          ))}
        </datalist>
      </Campo>

      <div className="grid grid-cols-2 gap-3">
        <Campo id="dataCompra" rotulo="Data da compra" erro={erros.dataCompra}>
          <Input id="dataCompra" type="date" value={dataCompra} onChange={(e) => mudarDataCompra(e.target.value)} />
        </Campo>
        <Campo id="mesFatura" rotulo="Fatura" erro={erros.mesFatura}>
          <Input
            id="mesFatura"
            type="month"
            value={mesFatura}
            onChange={(e) => {
              setMesFatura(e.target.value)
              setMesEscolhidoAMao(true)
            }}
          />
        </Campo>
      </div>

      <Interruptor id="recorrente" rotulo="Recorrente (mensal)" ligado={recorrente} aoMudar={setRecorrente} />
      <div className="grid grid-cols-2 gap-3">
        <Campo id="parcelaAtual" rotulo="Parcela" erro={erros.parcelaAtual}>
          <Input id="parcelaAtual" type="number" inputMode="numeric" min={1} max={99} value={parcelaAtual} onChange={(e) => setParcelaAtual(e.target.value)} />
        </Campo>
        {!recorrente && (
          <Campo id="qtdParcelas" rotulo="De quantas" erro={erros.qtdParcelas}>
            <Input id="qtdParcelas" type="number" inputMode="numeric" min={1} max={99} value={qtdParcelas} onChange={(e) => setQtdParcelas(e.target.value)} />
          </Campo>
        )}
      </div>

      <Interruptor id="recebido" rotulo="Já recebi" ligado={recebido} aoMudar={setRecebido} />

      {aviso && (
        <p role="status" className="text-sm">
          {aviso}
        </p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="submit" disabled={enviando}>
          {enviando ? 'Salvando…' : 'Salvar'}
        </Button>
        <Button type="button" variant="outline" disabled={enviando} onClick={() => enviar('outro')}>
          Salvar e lançar outro
        </Button>
      </div>
    </form>
  )
}
```

- [ ] **Step 9: Criar a página, a navegação e o layout logado**

Crie `src/app/(app)/lancamentos/novo/page.tsx`:

```tsx
import { exigirSessao } from '@/auth/sessao'
import { listarCategoriasAtivas, listarPessoasAtivas } from '@/db/cadastros'
import { obterDb } from '@/db/cliente'
import { hojeEmSaoPaulo } from '@/domain/datas'
import { FormularioLancamento } from './formulario-lancamento'

export default async function PaginaLancar() {
  await exigirSessao()
  const db = obterDb()
  const [pessoas, categorias] = await Promise.all([listarPessoasAtivas(db), listarCategoriasAtivas(db)])

  return (
    <>
      <h1 className="mb-4 text-xl font-semibold">Lançar</h1>
      <FormularioLancamento
        hoje={hojeEmSaoPaulo()}
        pessoas={pessoas.map((p) => p.nome)}
        categorias={categorias.map((c) => c.nome)}
      />
    </>
  )
}
```

Crie `src/components/navegacao.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { sair } from '@/app/login/actions'

const LINKS = [
  { href: '/lancamentos', rotulo: 'Lançamentos' },
  { href: '/lancamentos/novo', rotulo: '＋ Lançar' },
]

export function Navegacao() {
  const caminho = usePathname()

  return (
    <nav
      aria-label="Principal"
      // No celular fica embaixo; a margem respeita a barra de gestos do iPhone.
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      className="fixed inset-x-0 bottom-0 z-10 flex border-t bg-background md:inset-y-0 md:right-auto md:w-56 md:flex-col md:border-t-0 md:border-r md:p-4"
    >
      {LINKS.map((link) => {
        const ativo = caminho === link.href
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={ativo ? 'page' : undefined}
            className={`flex-1 p-4 text-center text-sm md:flex-none md:rounded-md md:px-3 md:py-2 md:text-left ${
              ativo ? 'font-semibold' : 'text-muted-foreground'
            }`}
          >
            {link.rotulo}
          </Link>
        )
      })}
      <form action={sair} className="flex-1 md:mt-auto md:flex-none">
        <button type="submit" className="w-full p-4 text-sm text-muted-foreground md:px-3 md:py-2 md:text-left">
          Sair
        </button>
      </form>
    </nav>
  )
}
```

Crie `src/app/(app)/layout.tsx`:

```tsx
import type { ReactNode } from 'react'
import { exigirSessao } from '@/auth/sessao'
import { Navegacao } from '@/components/navegacao'

export default async function LayoutLogado({ children }: { children: ReactNode }) {
  // Reforço: o proxy já barra quem não tem sessão antes de chegar aqui.
  await exigirSessao()

  return (
    <div className="min-h-dvh pb-24 md:pb-0 md:pl-56">
      <Navegacao />
      <main className="mx-auto max-w-3xl p-4">{children}</main>
    </div>
  )
}
```

- [ ] **Step 10: Verificar e fazer commit**

Run: `npm run typecheck; npm run lint; npm test; npm run build`
Expected: sem erros; testes passando; build concluído com as rotas `/login` e `/lancamentos/novo`.

```powershell
git add components.json package.json package-lock.json src
git commit -m "feat: casca do app com navegação e tela Lançar"
```

### Task 9: Lista da fatura do mês e "marcar como recebido"

**Papel:** construtor

**Files:**
- Create: `src/domain/resumo-do-mes.ts`, `src/app/(app)/lancamentos/page.tsx`, `src/app/(app)/lancamentos/lista-do-mes.tsx`, `src/app/(app)/lancamentos/actions.ts`
- Modify: `src/domain/lancamento.ts` (nova função `descreverParcela`)
- Test: `src/domain/resumo-do-mes.test.ts`, `src/domain/lancamento.test.ts`

**Interfaces:**
- Consumes: `listarLancamentosDoMes`, `marcarComoRecebidos`, `LancamentoDoMes` (Tarefa 4); `exigirSessao`, `obterDb` (Tarefa 7); `formatarReais` (Tarefa 1); `hojeEmSaoPaulo`, `inicioDoMes`, `lerMes`, `mesParaTexto`, `somarMeses`, `formatarMesFatura`, `calcularSituacao`, `ROTULO_SITUACAO`, `type Situacao`, `type DadosDaRegra` (Tarefa 2).
- Produces:
  - `descreverParcela(l: Pick<DadosDaRegra, 'parcelaAtual' | 'qtdParcelas' | 'recorrente'>): string`: `'mensal'`, `'3/10'` ou `''` (em `src/domain/lancamento.ts`)
  - `type TotaisDoMes = { total: number; aReceber: number; aAbater: number }` e `calcularTotaisDoMes(lancamentos: Pick<DadosDaRegra, 'valorCentavos' | 'pagamento'>[]): TotaisDoMes`
  - `type LinhaDoMes = { id: number; item: string; detalhe: string; valor: string; situacao: Situacao }`
  - Server Action `marcarRecebidos(ids: number[]): Promise<{ ok: true; alterados: number } | { ok: false; erro: string }>`
  - Página `/lancamentos?mes=AAAA-MM` (sem `mes`: fatura do mês de hoje)

- [ ] **Step 1: Escrever os testes de parcela e totais**

Em `src/domain/lancamento.test.ts`, acrescente `descreverParcela` ao `import` de `./lancamento` e, no fim do arquivo:

```ts
describe('descreverParcela', () => {
  it('mostra "mensal" para gasto recorrente', () => {
    expect(descreverParcela({ parcelaAtual: 1, qtdParcelas: null, recorrente: true })).toBe('mensal')
  })

  it('mostra "atual/quantidade" para compra parcelada', () => {
    expect(descreverParcela({ parcelaAtual: 3, qtdParcelas: 10, recorrente: false })).toBe('3/10')
  })

  it('fica vazio para compra à vista', () => {
    expect(descreverParcela({ parcelaAtual: 1, qtdParcelas: 1, recorrente: false })).toBe('')
  })
})
```

Crie `src/domain/resumo-do-mes.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { calcularTotaisDoMes } from './resumo-do-mes'

describe('calcularTotaisDoMes', () => {
  it('soma tudo, o que falta receber e o que falta abater', () => {
    expect(
      calcularTotaisDoMes([
        { valorCentavos: 10000, pagamento: 'NAO' }, // A RECEBER
        { valorCentavos: 2500, pagamento: 'SIM' }, // RECEBIDO
        { valorCentavos: -1000, pagamento: 'NAO' }, // A ABATER
        { valorCentavos: -500, pagamento: 'SIM' }, // ABATIDO
        { valorCentavos: 3000, pagamento: 'PERDOADO' },
      ]),
    ).toEqual({ total: 14000, aReceber: 10000, aAbater: -1000 })
  })

  it('dá zero em tudo quando o mês está vazio', () => {
    expect(calcularTotaisDoMes([])).toEqual({ total: 0, aReceber: 0, aAbater: 0 })
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/domain/lancamento.test.ts src/domain/resumo-do-mes.test.ts`
Expected: FAIL (`descreverParcela` não existe; import de `./resumo-do-mes` falha).

- [ ] **Step 3: Implementar**

No fim de `src/domain/lancamento.ts`, acrescente:

```ts
/** Texto curto da parcela para listas: "mensal", "3/10", ou nada para compra à vista. */
export function descreverParcela(
  l: Pick<DadosDaRegra, 'parcelaAtual' | 'qtdParcelas' | 'recorrente'>,
): string {
  if (l.recorrente) return 'mensal'
  if (l.qtdParcelas === null || l.qtdParcelas <= 1) return ''
  return `${l.parcelaAtual}/${l.qtdParcelas}`
}
```

Crie `src/domain/resumo-do-mes.ts`:

```ts
import { calcularSituacao, type DadosDaRegra } from './lancamento'

export type TotaisDoMes = { total: number; aReceber: number; aAbater: number }

/** Totais de uma fatura. `aAbater` sai negativo, porque créditos são valores negativos. */
export function calcularTotaisDoMes(
  lancamentos: Pick<DadosDaRegra, 'valorCentavos' | 'pagamento'>[],
): TotaisDoMes {
  const totais: TotaisDoMes = { total: 0, aReceber: 0, aAbater: 0 }
  for (const lancamento of lancamentos) {
    totais.total += lancamento.valorCentavos
    const situacao = calcularSituacao(lancamento)
    if (situacao === 'A_RECEBER') totais.aReceber += lancamento.valorCentavos
    if (situacao === 'A_ABATER') totais.aAbater += lancamento.valorCentavos
  }
  return totais
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/domain`
Expected: PASS.

- [ ] **Step 5: Criar a action de marcar recebidos**

Crie `src/app/(app)/lancamentos/actions.ts`:

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { exigirSessao } from '@/auth/sessao'
import { obterDb } from '@/db/cliente'
import { marcarComoRecebidos } from '@/db/lancamentos'
import { hojeEmSaoPaulo } from '@/domain/datas'

// A action recebe dados de fora (qualquer um pode fazer POST): valida mesmo vindo da nossa tela.
const idsValidos = z.array(z.number().int().positive()).min(1).max(500)

export async function marcarRecebidos(
  ids: number[],
): Promise<{ ok: true; alterados: number } | { ok: false; erro: string }> {
  await exigirSessao()

  const validacao = idsValidos.safeParse(ids)
  if (!validacao.success) return { ok: false, erro: 'Selecione pelo menos um lançamento.' }

  try {
    const alterados = await marcarComoRecebidos(obterDb(), validacao.data, hojeEmSaoPaulo())
    revalidatePath('/lancamentos')
    return { ok: true, alterados }
  } catch (erro) {
    console.error('Falha ao marcar lançamentos como recebidos', erro)
    return { ok: false, erro: 'Não foi possível salvar. Tente de novo.' }
  }
}
```

- [ ] **Step 6: Criar a lista com seleção**

Crie `src/app/(app)/lancamentos/lista-do-mes.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { ROTULO_SITUACAO, type Situacao } from '@/domain/lancamento'
import { marcarRecebidos } from './actions'

export type LinhaDoMes = { id: number; item: string; detalhe: string; valor: string; situacao: Situacao }

// Cor ajuda a bater o olho, mas o chip sempre mostra o texto: nunca informação só por cor.
const COR_SITUACAO: Record<Situacao, string> = {
  A_RECEBER: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
  RECEBIDO: 'bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-200',
  A_ABATER: 'bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-200',
  ABATIDO: 'bg-neutral-200 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200',
  PERDOADO: 'bg-purple-100 text-purple-900 dark:bg-purple-950 dark:text-purple-200',
}

export function ListaDoMes({ linhas }: { linhas: LinhaDoMes[] }) {
  const [selecionados, setSelecionados] = useState<Set<number>>(new Set())
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, iniciarEnvio] = useTransition()

  if (linhas.length === 0) {
    return (
      <p className="text-muted-foreground">
        Nenhum lançamento nesta fatura.{' '}
        <Link href="/lancamentos/novo" className="underline">
          Lançar agora
        </Link>
      </p>
    )
  }

  function alternar(id: number) {
    setSelecionados((atual) => {
      const novo = new Set(atual)
      if (novo.has(id)) novo.delete(id)
      else novo.add(id)
      return novo
    })
  }

  function marcar() {
    iniciarEnvio(async () => {
      const resultado = await marcarRecebidos([...selecionados])
      if (resultado.ok) {
        setSelecionados(new Set())
        setErro(null)
      } else {
        setErro(resultado.erro)
      }
    })
  }

  const quantidade = selecionados.size

  return (
    <div className="flex flex-col gap-3">
      <ul className="divide-y rounded-md border">
        {linhas.map((linha) => {
          const emAberto = linha.situacao === 'A_RECEBER' || linha.situacao === 'A_ABATER'
          return (
            <li key={linha.id} className="flex items-center gap-3 p-3">
              <input
                type="checkbox"
                className="size-5"
                aria-label={`Selecionar ${linha.item}`}
                disabled={!emAberto}
                checked={selecionados.has(linha.id)}
                onChange={() => alternar(linha.id)}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{linha.item}</p>
                <p className="truncate text-sm text-muted-foreground">{linha.detalhe}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="font-medium tabular-nums">{linha.valor}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${COR_SITUACAO[linha.situacao]}`}>
                  {ROTULO_SITUACAO[linha.situacao]}
                </span>
              </div>
            </li>
          )
        })}
      </ul>

      {erro && (
        <p role="alert" className="text-sm text-destructive">
          {erro}
        </p>
      )}

      <Button onClick={marcar} disabled={quantidade === 0 || enviando}>
        {enviando ? 'Salvando…' : `Marcar ${quantidade} como recebido${quantidade === 1 ? '' : 's'}`}
      </Button>
    </div>
  )
}
```

- [ ] **Step 7: Criar a página do mês**

Crie `src/app/(app)/lancamentos/page.tsx`:

```tsx
import Link from 'next/link'
import { exigirSessao } from '@/auth/sessao'
import { obterDb } from '@/db/cliente'
import { listarLancamentosDoMes } from '@/db/lancamentos'
import { formatarMesFatura, hojeEmSaoPaulo, inicioDoMes, lerMes, mesParaTexto, somarMeses } from '@/domain/datas'
import { formatarReais } from '@/domain/dinheiro'
import { calcularSituacao, descreverParcela } from '@/domain/lancamento'
import { calcularTotaisDoMes } from '@/domain/resumo-do-mes'
import { ListaDoMes, type LinhaDoMes } from './lista-do-mes'

export default async function PaginaLancamentos({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>
}) {
  await exigirSessao()

  // O mês fica na URL (?mes=2026-09): o botão voltar funciona e o link pode ser salvo.
  const mes = lerMes((await searchParams).mes ?? '') ?? inicioDoMes(hojeEmSaoPaulo())
  const lancamentos = await listarLancamentosDoMes(obterDb(), mes)
  const totais = calcularTotaisDoMes(lancamentos)

  const linhas: LinhaDoMes[] = lancamentos.map((l) => ({
    id: l.id,
    item: l.item,
    detalhe: [l.pessoa, l.categoria, descreverParcela(l)].filter(Boolean).join(' · '),
    valor: formatarReais(l.valorCentavos),
    situacao: calcularSituacao(l),
  }))

  const linkDoMes = (deslocamento: number) => `/lancamentos?mes=${mesParaTexto(somarMeses(mes, deslocamento))}`

  return (
    <>
      <header className="mb-4 flex items-center justify-between gap-2">
        <Link href={linkDoMes(-1)} aria-label="Fatura anterior" className="rounded-md px-3 py-2 text-lg">
          ‹
        </Link>
        <h1 className="text-xl font-semibold">Fatura {formatarMesFatura(mes)}</h1>
        <Link href={linkDoMes(1)} aria-label="Próxima fatura" className="rounded-md px-3 py-2 text-lg">
          ›
        </Link>
      </header>

      <dl className="mb-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-md border p-2">
          <dt className="text-xs text-muted-foreground">Total</dt>
          <dd className="font-semibold tabular-nums">{formatarReais(totais.total)}</dd>
        </div>
        <div className="rounded-md border p-2">
          <dt className="text-xs text-muted-foreground">A receber</dt>
          <dd className="font-semibold tabular-nums">{formatarReais(totais.aReceber)}</dd>
        </div>
        <div className="rounded-md border p-2">
          <dt className="text-xs text-muted-foreground">A abater</dt>
          <dd className="font-semibold tabular-nums">{formatarReais(totais.aAbater)}</dd>
        </div>
      </dl>

      {/* key={mes}: ao trocar de mês, a seleção de caixas começa do zero */}
      <ListaDoMes key={mes} linhas={linhas} />
    </>
  )
}
```

- [ ] **Step 8: Verificação automática**

Run: `npm run typecheck; npm run lint; npm test; npm run build`
Expected: sem erros; testes passando; build com as rotas `/lancamentos`, `/lancamentos/novo` e `/login`.

- [ ] **Step 9: Verificação no navegador (o orquestrador pede para você conferir)**

Run: `npm run dev` e abra <http://localhost:3000>.

Expected, nesta ordem:
1. Cai em `/login`. Senha errada mostra "Usuário ou senha incorretos."
2. Com a senha certa, cai na "Fatura" do mês atual.
3. Em "＋ Lançar", mude a data da compra para um dia 10 ou maior: a fatura sugerida passa para o mês seguinte.
4. Lance uma pessoa nova, valor `12,50`, um item e uma categoria nova. Ao salvar, volta para a lista daquele mês com o item em **A RECEBER** e o total "A receber" de R$ 12,50.
5. Marque a caixa e toque em "Marcar 1 como recebido": o chip vira **RECEBIDO** e "A receber" volta a R$ 0,00.
6. As setas ‹ › trocam de mês.
7. "Sair" volta para `/login`.

Os dados de teste ficam só no banco `dev`.

- [ ] **Step 10: Commit**

```powershell
git add src
git commit -m "feat: lista da fatura do mês com totais e marcar recebidos"
```

### Task 10: README e comentários das funções exportadas

**Papel:** ajudante

**Files:**
- Create: `README.md`
- Modify: `CLAUDE.md` (seção Comandos) e comentários JSDoc nos arquivos listados no Step 3

**Interfaces:**
- Consumes: o código das Tarefas 1 a 9 (só leitura; nenhuma lógica muda).
- Produces: `README.md` com setup local, variáveis, scripts, estrutura, deploy e privacidade.

- [ ] **Step 1: Criar o `README.md`**

```markdown
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
```

- [ ] **Step 2: Atualizar o `CLAUDE.md`**

Na seção `## Comandos`, apague a linha `Criados pelo Plano 1. Enquanto a Tarefa 1 não rodar, o projeto ainda não tem \`package.json\`.` e, no lugar dela, escreva `Detalhes no README.md.`

- [ ] **Step 3: Acrescentar JSDoc de uma linha onde falta**

Coloque cada comentário na linha imediatamente acima da função indicada, sem alterar mais nada no arquivo:

| Arquivo | Função | Comentário |
|---|---|---|
| `src/domain/datas.ts` | `inicioDoMes` | `/** "2026-09-14" → "2026-09-01". */` |
| `src/domain/datas.ts` | `somarMeses` | `/** Soma (ou subtrai, com número negativo) meses a um mês de fatura "AAAA-MM-01". */` |
| `src/domain/datas.ts` | `mesmoMes` | `/** true quando as duas datas caem no mesmo mês do mesmo ano. */` |
| `src/domain/datas.ts` | `lerMes` | `/** Valor de um <input type="month"> ("2026-09") → mês da fatura ("2026-09-01"); inválido → null. */` |
| `src/domain/datas.ts` | `mesParaTexto` | `/** Mês da fatura ("2026-09-01") → valor para <input type="month"> e URLs ("2026-09"). */` |
| `src/domain/datas.ts` | `ehDataValida` | `/** true só para datas "AAAA-MM-DD" que existem no calendário (30/02 é recusado). */` |
| `src/db/cadastros.ts` | `listarPessoasAtivas` | `/** Pessoas que aparecem nas listas de escolha, em ordem alfabética. */` |
| `src/db/cadastros.ts` | `listarCategoriasAtivas` | `/** Categorias que aparecem nas listas de escolha, em ordem alfabética. */` |
| `src/db/cadastros.ts` | `obterOuCriarPessoa` | `/** Devolve a pessoa com esse nome (ignorando maiúsculas) ou cria uma nova. */` |
| `src/db/cadastros.ts` | `obterOuCriarCategoria` | `/** Devolve a categoria com esse nome (ignorando maiúsculas) ou cria uma nova. */` |
| `src/db/lancamentos.ts` | `criarLancamento` | `/** Grava um lançamento digitado no site (fonte "manual") e devolve o id criado. */` |
| `src/db/lancamentos.ts` | `listarLancamentosDoMes` | `/** Lançamentos de uma fatura, com os nomes da pessoa e da categoria, ordenados por pessoa. */` |
| `src/auth/senha.ts` | `verificarSenha` | `/** Confere a senha contra o hash salvo; hash malformado ou senha errada → false. */` |
| `src/auth/token.ts` | `criarTokenSessao` | `/** Cria o JWT da sessão do usuário, válido por 30 dias a partir de \`agora\`. */` |
| `src/auth/bloqueio.ts` | `registrarFalha` | `/** Guarda uma tentativa de login errada vinda deste IP. */` |
| `src/auth/bloqueio.ts` | `limparFalhas` | `/** Apaga as falhas deste IP (chamado depois de um login certo). */` |

- [ ] **Step 4: Provar que nada quebrou**

Run: `npm run typecheck; npm run lint; npm test`
Expected: sem erros; todos os testes passando.

Run: `git diff --stat`
Expected: só `README.md`, `CLAUDE.md` e os 6 arquivos da tabela do Step 3, com linhas **adicionadas** (nenhuma linha de código removida).

- [ ] **Step 5: Commit**

```powershell
git add README.md CLAUDE.md src
git commit -m "docs: README e comentários das funções exportadas"
```

### Task 11: Produção — GitHub, Vercel e banco `main`

**Papel:** você (manual)

Faça depois que o Plano 1 estiver integrado na branch `main` (etapa final do Superpowers, "finishing a development branch"). Criar repositório, publicar e mexer em variáveis de produção são ações suas.

**Files:**
- Nenhum arquivo do repositório muda.

**Interfaces:**
- Consumes: o repositório completo com as Tarefas 1 a 10; `npm run credenciais` e `npm run db:migrate`.
- Produces: site em produção num endereço `*.vercel.app`, com banco Neon `main`.

- [ ] **Step 1: Criar o repositório privado no GitHub**

Em <https://github.com/new>: nome `FinanceControl`, visibilidade **Private**, sem README, sem `.gitignore` e sem licença (o projeto já tem tudo).

- [ ] **Step 2: Enviar o código**

```powershell
git remote add origin https://github.com/SEU-USUARIO/FinanceControl.git
git push -u origin main
```

Expected: push concluído. Na aba **Actions** do repositório, o workflow **CI** fica verde.

- [ ] **Step 3: Aplicar as migrações no banco de produção**

No Neon, copie a connection string da branch **`main`** (sem `-pooler`). Rode no PowerShell, sem gravar essa conexão em arquivo nenhum:

```powershell
$env:DATABASE_URL = "COLE-AQUI-A-CONEXAO-DA-BRANCH-MAIN"
npm run db:migrate
Remove-Item Env:DATABASE_URL
```

Expected: migração aplicada. A variável definida no terminal tem prioridade sobre o `.env.local`, então o banco `dev` não é tocado.

- [ ] **Step 4: Criar o projeto na Vercel**

Em <https://vercel.com/new>, importe `FinanceControl` do GitHub (o framework Next.js é detectado sozinho). Antes de clicar em **Deploy**, abra **Environment Variables** e cadastre para **Production**:

| Nome | Valor |
|---|---|
| `DATABASE_URL` | conexão da branch `main` (a mesma do Step 3) |
| `AUTH_USUARIO` | o usuário do dono |
| `AUTH_SENHA_HASH` | linha gerada por `npm run credenciais` |
| `AUTH_SEGREDO` | linha gerada por `npm run credenciais` |

Recomendado: rodar `npm run credenciais` de novo e usar em produção um `AUTH_SEGREDO` diferente do local.
Para as prévias de outras branches (**Preview**) funcionarem, cadastre as mesmas variáveis para Preview com o `DATABASE_URL` da branch `dev`.

- [ ] **Step 5: Conferir a região das funções**

Em **Settings → Functions**, confirme a região `iad1` (Washington, D.C., EUA), a mesma do banco (AWS US East).

- [ ] **Step 6: Testar em produção**

Abra o endereço `https://….vercel.app` mostrado pela Vercel e repita o roteiro do Step 9 da Tarefa 9: login, lançar, marcar como recebido, trocar de mês e sair.

- [ ] **Step 7: Instalar no iPhone**

No Safari do iPhone, abra o endereço de produção, faça login, toque em **Compartilhar → Adicionar à Tela de Início** e confirme.

- [ ] **Step 8: Encerrar o Plano 1**

Com tudo funcionando, avise o orquestrador: "Plano 1 em produção". O próximo passo é o Cérebro escrever o **Plano 2 — Melhor que o Excel** (§15 da spec).
