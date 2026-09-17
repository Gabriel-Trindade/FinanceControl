# Plano A1 — A planilha entra

> **Para quem executa com agentes:** SUB-SKILL OBRIGATÓRIA — use `superpowers:subagent-driven-development` (recomendada) ou `superpowers:executing-plans` para implementar tarefa a tarefa. Os passos usam caixas (`- [ ]`) para acompanhamento.

**Objetivo:** o dono envia a planilha `USO_CARTÃO.xlsx` pelo celular, confere o que o sistema entendeu antes de gravar, e passa a ver os 4.805 lançamentos dele dentro do app.

**Arquitetura:** o `.xlsx` é lido no próprio aparelho e nunca sobe para o servidor. A leitura do arquivo (`src/importacao/ler-xlsx.ts`) fica separada da tradução das linhas (`src/domain/planilha.ts`, função pura), para que toda a regra seja testável com uma matriz escrita à mão, sem nenhum `.xlsx` no repositório. A gravação vai em lotes idempotentes por `cod_planilha`, porque o driver HTTP do Neon não tem transação interativa.

**Stack:** Next.js 16.3.5 (App Router) · TypeScript · Drizzle ORM · Neon Postgres · Vitest com PGlite · Tailwind 4 · shadcn sobre `@base-ui/react` · `read-excel-file` 9.3.10.

**Spec:** [`docs/superpowers/specs/2026-09-16-planilha-primeiro-design.md`](../specs/2026-09-16-planilha-primeiro-design.md)

## Restrições globais

Valem para **todas** as tarefas. Vêm do `CLAUDE.md` e da spec.

- Português do Brasil em nomes, mensagens, comentários e commits.
- Dinheiro em **centavos inteiros**. Vírgula e `R$` só na tela.
- Mês da fatura é data no **dia 1**, sempre.
- "Hoje" é calculado no fuso `America/Sao_Paulo`, nunca no UTC do servidor.
- `exigirSessao()` na **primeira linha** de toda Server Action e Route Handler protegido.
- SUBTOTAL, SITUAÇÃO e RESTANTE são calculados em `src/domain`, **nunca salvos**.
- Regra de negócio existe só em `src/domain`. SQL agrega por colunas cruas; nunca reimplementa regra.
- Nunca commitar `.env*`, `.xlsx`, `.csv`, `.pdf` ou qualquer dado real. Testes usam dados fictícios.
- Antes de cada commit: `npm test && npm run lint && npm run typecheck`.
- Comentário no código explica o **porquê** do trecho não óbvio, não o que ele faz.

---

### Tarefa 1: Normalização NFC dos nomes

**Papel:** construtor

Pré-requisito de tudo. Sem isso, "José" em duas formas Unicode vira duas pessoas quando os 4.805 nomes chegarem do Excel.

**Arquivos:**
- Modificar: `src/db/cadastros.ts` (função `normalizarNome`)
- Criar: `src/db/cadastros-nfc.test.ts`
- Criar: `drizzle/0001_normalizar_nomes_nfc.sql` (gerada por comando, ver passo 5)

**Interfaces:**
- Consome: nada
- Produz: `normalizarNome(nome: string): string` — agora com forma Unicode NFC garantida. As tarefas 9 e 11 dependem disso.

- [ ] **Passo 1: escrever o teste que falha**

Crie `src/db/cadastros-nfc.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { normalizarNome } from './cadastros'

// "José" em duas formas Unicode: iguais na tela, diferentes em bytes.
const NFC = 'José' // é como um caractere só
const NFD = 'José' // e + acento combinante

describe('normalizarNome', () => {
  it('as duas formas de "José" viram a mesma string', () => {
    expect(NFC).not.toBe(NFD) // confirma que o teste testa algo
    expect(normalizarNome(NFD)).toBe(normalizarNome(NFC))
  })

  it('devolve a forma NFC', () => {
    expect(normalizarNome(NFD)).toBe(NFC)
  })

  it('continua limpando espaços', () => {
    expect(normalizarNome('  Ana   Maria ')).toBe('Ana Maria')
  })
})
```

- [ ] **Passo 2: rodar e ver falhar**

```bash
npx vitest run src/db/cadastros-nfc.test.ts
```

Esperado: os dois primeiros testes FALHAM (`normalizarNome(NFD)` devolve a forma decomposta).

- [ ] **Passo 3: corrigir a função**

Em `src/db/cadastros.ts`, troque `normalizarNome` por:

```ts
/**
 * "  Ana   Maria " → "Ana Maria", já em forma Unicode NFC.
 * O NFC não é enfeite: "é" pode ser gravado como um caractere ou como "e" + acento
 * combinante. São iguais na tela, mas o índice pessoas_nome_unico compara bytes —
 * sem normalizar, o mesmo nome vindo do Excel viraria uma segunda pessoa.
 */
export function normalizarNome(nome: string): string {
  return nome.normalize('NFC').trim().replace(/\s+/g, ' ')
}
```

- [ ] **Passo 4: rodar e ver passar**

```bash
npx vitest run src/db/cadastros-nfc.test.ts
```

Esperado: 3 testes PASSAM.

- [ ] **Passo 5: normalizar o que já está gravado**

A correção acima vale para gravações novas. Uma linha já no banco em NFD não seria encontrada pela busca, e o `INSERT` passaria pelo índice — a segunda pessoa nasceria assim mesmo.

Crie a migração vazia e escreva o SQL dentro dela:

```bash
npx drizzle-kit generate --custom --name=normalizar_nomes_nfc
```

No arquivo gerado em `drizzle/`, escreva:

```sql
-- Nomes gravados antes da correção do NFC podem estar em forma decomposta.
UPDATE pessoas SET nome = normalize(nome, NFC) WHERE nome <> normalize(nome, NFC);
UPDATE categorias SET nome = normalize(nome, NFC) WHERE nome <> normalize(nome, NFC);
```

- [ ] **Passo 6: testar a migração contra o banco em memória**

Acrescente a `src/db/cadastros-nfc.test.ts`:

```ts
import { sql } from 'drizzle-orm'
import { criarBancoDeTeste } from '../../tests/banco-de-teste'
import { obterOuCriarPessoa } from './cadastros'

it('o mesmo nome em NFC e NFD resolve para uma pessoa só', async () => {
  const { db, fechar } = await criarBancoDeTeste()
  try {
    const primeira = await obterOuCriarPessoa(db, NFD)
    const segunda = await obterOuCriarPessoa(db, NFC)
    expect(segunda.id).toBe(primeira.id)

    const [{ total }] = await db.execute<{ total: number }>(
      sql`select count(*)::int as total from pessoas`,
    )
    expect(total).toBe(1)
  } finally {
    await fechar()
  }
})
```

- [ ] **Passo 7: rodar tudo e commitar**

```bash
npm test && npm run lint && npm run typecheck
```

```bash
git add src/db/cadastros.ts src/db/cadastros-nfc.test.ts drizzle/
git commit -m "fix: normalizar nomes em NFC antes de comparar e gravar"
```

---

### Tarefa 2: Coluna `cod_planilha`

**Papel:** construtor

Decisão D12 da spec §3.1. O `CÓD` do Excel e o `id` do banco são numerações independentes; usar a mesma coluna para as duas quebra o reenvio aditivo no primeiro lançamento manual feito depois da migração.

**Arquivos:**
- Modificar: `src/db/schema.ts` (tabela `lancamentos`)
- Criar: `drizzle/0002_cod_planilha.sql` (gerada)
- Criar: `src/db/cod-planilha.test.ts`

**Interfaces:**
- Consome: nada
- Produz: `lancamentos.codPlanilha: integer | null`, com índice único parcial `lancamentos_cod_planilha_unico`. As tarefas 9 e 11 dependem disso.

- [ ] **Passo 1: escrever o teste que falha**

Crie `src/db/cod-planilha.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { criarBancoDeTeste } from '../../tests/banco-de-teste'
import { obterOuCriarCategoria, obterOuCriarPessoa } from './cadastros'
import { lancamentos } from './schema'
import type { Db } from './tipos'

async function inserir(db: Db, codPlanilha: number | null) {
  const pessoa = await obterOuCriarPessoa(db, 'Ana')
  const categoria = await obterOuCriarCategoria(db, 'Mercado')
  return db.insert(lancamentos).values({
    codPlanilha,
    mesFatura: '2026-09-01',
    pessoaId: pessoa.id,
    categoriaId: categoria.id,
    item: 'Compra',
    valorCentavos: 1000,
    parcelaAtual: 1,
    qtdParcelas: 1,
    recorrente: false,
    fonte: 'planilha',
  })
}

describe('cod_planilha', () => {
  it('recusa dois lançamentos com o mesmo CÓD', async () => {
    const { db, fechar } = await criarBancoDeTeste()
    try {
      await inserir(db, 42)
      await expect(inserir(db, 42)).rejects.toMatchObject({
        cause: { constraint: 'lancamentos_cod_planilha_unico' },
      })
    } finally {
      await fechar()
    }
  })

  it('aceita vários lançamentos manuais sem CÓD', async () => {
    const { db, fechar } = await criarBancoDeTeste()
    try {
      await inserir(db, null)
      await inserir(db, null)
      const linhas = await db.select({ id: lancamentos.id }).from(lancamentos)
      expect(linhas).toHaveLength(2)
    } finally {
      await fechar()
    }
  })
})
```

- [ ] **Passo 2: rodar e ver falhar**

```bash
npx vitest run src/db/cod-planilha.test.ts
```

Esperado: FALHA de compilação — `codPlanilha` não existe em `lancamentos`.

- [ ] **Passo 3: acrescentar a coluna ao schema**

Em `src/db/schema.ts`, dentro de `lancamentos`, depois de `dataCompra`:

```ts
    // CÓD da planilha. Fica separado do id porque são duas numerações independentes:
    // o id é do banco, o CÓD é do Excel. Juntá-los faria um lançamento manual roubar
    // o número de uma linha futura da planilha, e o reenvio aditivo pararia de funcionar.
    codPlanilha: integer('cod_planilha'),
```

E, na lista de restrições da mesma tabela:

```ts
    // Índice simples, não parcial: o Postgres trata cada NULL como distinto dos outros,
    // então muitos lançamentos manuais sem CÓD convivem aqui sem conflito. Um índice
    // parcial quebraria o ON CONFLICT da gravação, que só reconhece índice parcial
    // quando a cláusula WHERE dele é repetida na consulta.
    uniqueIndex('lancamentos_cod_planilha_unico').on(t.codPlanilha),
```

- [ ] **Passo 4: gerar e conferir a migração**

```bash
npm run db:generate
```

Abra o arquivo gerado em `drizzle/` e confirme que ele tem `ADD COLUMN "cod_planilha" integer` e o `CREATE UNIQUE INDEX ... WHERE "cod_planilha" is not null`. Não edite à mão.

- [ ] **Passo 5: rodar e ver passar**

```bash
npx vitest run src/db/cod-planilha.test.ts
```

Esperado: 2 testes PASSAM.

- [ ] **Passo 6: rodar tudo e commitar**

```bash
npm test && npm run lint && npm run typecheck
```

```bash
git add src/db/schema.ts src/db/cod-planilha.test.ts drizzle/
git commit -m "feat: coluna cod_planilha separada do id do banco"
```

---

### Tarefa 3: Fonte IBM Plex Sans e tokens de cor

**Papel:** designer (invoca a skill `ui-ux-pro-max` antes de escrever)

Spec §9.1 e §10. Precisa vir **antes** de qualquer tela: hoje `--chart-1` a `--chart-5` são `oklch(L 0 0)` — cinco cinzas — e não existe token para as cinco situações.

**Arquivos:**
- Modificar: `src/app/layout.tsx`
- Modificar: `src/app/globals.css`

**Interfaces:**
- Consome: nada
- Produz: variáveis CSS `--situacao-a-receber`, `--situacao-recebido`, `--situacao-a-abater`, `--situacao-abatido`, `--situacao-perdoado` e `--chart-1` a `--chart-5`, todas em `oklch`, definidas no tema claro e redefinidas no escuro. As tarefas 10 e 11 e todo o Plano A2 dependem delas.

- [ ] **Passo 1: trocar a fonte**

Em `src/app/layout.tsx`, troque a importação e a declaração. `IBM_Plex_Sans` **não é fonte variável**: exige `weight` explícito, e o `AJUSTES-DO-PROJETO.md` §5 usa só dois pesos (400 e 500).

```tsx
import { IBM_Plex_Sans, Geist_Mono } from "next/font/google";

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500"],
});
```

Troque `geistSans.variable` por `plexSans.variable` no `className` do `<html>`. Mantenha `Geist_Mono`: nenhum texto usa `--font-mono` hoje, e trocá-lo não faz parte desta tarefa.

- [ ] **Passo 2: apontar `--font-sans` para ela**

Em `src/app/globals.css`, linha 10:

```css
  --font-sans: var(--font-plex-sans);
```

- [ ] **Passo 3: definir os tokens de cor**

No bloco `:root` de `globals.css`, junto dos outros tokens, e **repetidos no bloco de tema escuro**. Use `oklch`, como o resto do arquivo. Regras:

- Cada cor precisa de **contraste mínimo 4.5:1** contra o fundo do seu tema.
- A ABATER e ABATIDO são crédito, não erro: não reaproveite `--destructive`.
- PERDOADO é o estado neutro-encerrado: o mais apagado dos cinco.
- `--chart-1` a `--chart-5` precisam ser distinguíveis entre si **e** por quem não enxerga cor — os gráficos do Plano A2 vão parear cada série com um segundo sinal (hachura ou traço), mas a cor não pode ser a única diferença já na origem.

- [ ] **Passo 4: conferir o contraste**

Para cada par texto/fundo, nos dois temas, meça o contraste (DevTools → inspecionar elemento → contraste, ou qualquer medidor de WCAG). Anote os valores num comentário no próprio `globals.css`, acima do bloco. Se algum ficar abaixo de 4.5:1, ajuste a luminosidade (`L` do `oklch`) e meça de novo.

- [ ] **Passo 5: ver nos dois temas**

```bash
npm run dev
```

Abra `http://localhost:3000/lancamentos` e alterne o tema do sistema entre claro e escuro. Esperado: a fonte mudou visivelmente (IBM Plex Sans tem desenho mais estreito que a Geist) e nada ficou ilegível.

- [ ] **Passo 6: rodar tudo e commitar**

```bash
npm test && npm run lint && npm run typecheck && npm run build
```

```bash
git add src/app/layout.tsx src/app/globals.css
git commit -m "feat: fonte IBM Plex Sans e tokens de cor de situacao e grafico"
```

---

### Tarefa 4: Telas de erro em português e `build` no CI

**Papel:** construtor

`pendencias-plano-2.md` §2 e §5. Hoje, se o banco cair, o dono vê a tela padrão do Next, em inglês — e uma quebra de build só apareceria no deploy, porque o CI não roda `build`.

**Arquivos:**
- Criar: `src/app/error.tsx`
- Criar: `src/app/global-error.tsx`
- Modificar: `.github/workflows/ci.yml`

**Interfaces:**
- Consome: tokens da Tarefa 3
- Produz: nada que outra tarefa consuma em código; o critério de aceite 12 depende do CI rodar `build`

- [ ] **Passo 1: criar `src/app/error.tsx`**

```tsx
'use client'

// Captura erro de qualquer página abaixo da raiz. Precisa ser Client Component:
// é o React que chama esta tela quando um componente abaixo lança.
export default function Erro({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-6">
      <h1 className="text-xl font-semibold">Alguma coisa deu errado</h1>
      <p className="text-sm text-muted-foreground">
        Não foi possível carregar esta página. Isso costuma ser falha de conexão com o banco.
      </p>
      <button
        type="button"
        onClick={reset}
        className="min-h-11 rounded-md border px-4 text-sm font-medium"
      >
        Tentar de novo
      </button>
    </main>
  )
}
```

Não mostre `error.message` na tela: pode conter detalhe da conexão com o banco.

- [ ] **Passo 2: criar `src/app/global-error.tsx`**

Este substitui o `<html>` inteiro, então precisa trazer as próprias tags:

```tsx
'use client'

// Último recurso: só dispara quando o erro acontece no próprio layout raiz,
// e por isso precisa renderizar <html> e <body>, que ali já falharam.
export default function ErroGlobal({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="pt-BR">
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: 0, padding: '2rem' }}>
        <h1 style={{ fontSize: '1.25rem' }}>O aplicativo não conseguiu iniciar</h1>
        <p style={{ fontSize: '0.875rem' }}>Tente de novo em alguns instantes.</p>
        <button type="button" onClick={reset} style={{ minHeight: '2.75rem', padding: '0 1rem' }}>
          Tentar de novo
        </button>
      </body>
    </html>
  )
}
```

O estilo vai inline de propósito: se o layout raiz falhou, o `globals.css` pode não ter carregado.

- [ ] **Passo 3: verificar na prática**

```bash
npm run dev
```

Force um erro temporário: em `src/app/(app)/lancamentos/page.tsx`, acrescente `throw new Error('teste')` na primeira linha do componente. Abra `/lancamentos`. Esperado: a tela em português, com o botão "Tentar de novo". **Apague o `throw` antes de commitar.**

- [ ] **Passo 4: fazer o CI rodar `build`**

Em `.github/workflows/ci.yml`, acrescente o passo depois de `npm test`:

```yaml
      - run: npm run build
        env:
          # Valores falsos, só para o build passar pela validação de src/env.ts.
          # Nenhum deles funciona: o CI não fala com o banco nem faz login.
          DATABASE_URL: postgresql://ci:ci@localhost:5432/ci
          AUTH_USUARIO: ci
          AUTH_SENHA_HASH: scrypt:16384:8:1:Y2ktc2FsLWZhbHNv:Y2ktaGFzaC1mYWxzbw
          AUTH_SEGREDO: segredo-falso-do-ci-com-mais-de-32-caracteres
```

`obterEnv()` valida sob demanda, com cache, e não no topo do módulo — mas o `build` pode tentar prerenderizar uma rota que a chame, e aí falharia sem estas variáveis.

- [ ] **Passo 5: conferir que o build passa localmente com as mesmas variáveis**

```bash
DATABASE_URL=postgresql://ci:ci@localhost:5432/ci AUTH_USUARIO=ci AUTH_SENHA_HASH=scrypt:16384:8:1:Y2ktc2FsLWZhbHNv:Y2ktaGFzaC1mYWxzbw AUTH_SEGREDO=segredo-falso-do-ci-com-mais-de-32-caracteres npm run build
```

Esperado: build conclui. Se falhar por variável de ambiente, o valor no workflow precisa do mesmo ajuste.

- [ ] **Passo 6: rodar tudo e commitar**

```bash
npm test && npm run lint && npm run typecheck && npm run build
```

```bash
git add src/app/error.tsx src/app/global-error.tsx .github/workflows/ci.yml
git commit -m "feat: telas de erro em portugues e build no CI"
```

---

### Tarefa 5: Valor da planilha em centavos

**Papel:** construtor

Spec §6.3. É a conversão mais delicada da importação: 433 valores com mais de duas casas e 393 negativos.

**Arquivos:**
- Criar: `src/domain/planilha.ts`
- Criar: `src/domain/planilha.test.ts`

**Interfaces:**
- Consome: nada
- Produz: `valorParaCentavos(bruto: string | number): number | null` — `null` quando não dá para converter. A Tarefa 6 usa.

- [ ] **Passo 1: escrever o teste que falha**

Crie `src/domain/planilha.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { valorParaCentavos } from './planilha'

describe('valorParaCentavos', () => {
  it('converte número inteiro e com duas casas', () => {
    expect(valorParaCentavos(1234.56)).toBe(123456)
    expect(valorParaCentavos('1234.56')).toBe(123456)
    expect(valorParaCentavos(10)).toBe(1000)
  })

  it('arredonda a terceira casa para longe do zero', () => {
    // 1.005 * 100 vale 100.49999999999999 em ponto flutuante: sem cuidado, viraria 100.
    expect(valorParaCentavos(1.005)).toBe(101)
    expect(valorParaCentavos('1.005')).toBe(101)
    expect(valorParaCentavos(-1.005)).toBe(-101)
    expect(valorParaCentavos('-1.005')).toBe(-101)
    expect(valorParaCentavos(-0.125)).toBe(-13)
    expect(valorParaCentavos('-0.125')).toBe(-13)
  })

  it('zero nunca vira -0', () => {
    // expect(-0).toBe(0) falha no Vitest, porque ele usa Object.is.
    expect(Object.is(valorParaCentavos(0), 0)).toBe(true)
    expect(Object.is(valorParaCentavos('-0'), 0)).toBe(true)
  })

  it('recusa o que não é número', () => {
    expect(valorParaCentavos('abc')).toBeNull()
    expect(valorParaCentavos('')).toBeNull()
    expect(valorParaCentavos(Number.NaN)).toBeNull()
  })
})
```

- [ ] **Passo 2: rodar e ver falhar**

```bash
npx vitest run src/domain/planilha.test.ts
```

Esperado: FALHA — `valorParaCentavos` não existe.

- [ ] **Passo 3: implementar**

Crie `src/domain/planilha.ts`:

```ts
// O número da célula chega como texto ("1234.56", com ponto decimal do XLSX) ou já
// como number. Os dois caminhos existem porque o read-excel-file pode entregar
// qualquer um dos dois, e nenhum dos dois pode perder centavo.
const PADRAO_NUMERO = /^(-)?(\d+)(?:\.(\d+))?$/

/** Valor da planilha → centavos inteiros. `null` quando não é número. */
export function valorParaCentavos(bruto: string | number): number | null {
  if (typeof bruto === 'string') {
    const partes = PADRAO_NUMERO.exec(bruto.trim())
    if (!partes) return null
    const [, sinal, inteiro, decimal = ''] = partes
    // Duas casas exatas: completa com zero, ou arredonda a partir da terceira.
    const centavosSemArredondar = Number(inteiro) * 100 + Number(decimal.slice(0, 2).padEnd(2, '0'))
    const terceira = Number(decimal[2] ?? '0')
    const centavos = centavosSemArredondar + (terceira >= 5 ? 1 : 0)
    return sinal && centavos !== 0 ? -centavos : centavos
  }

  if (!Number.isFinite(bruto)) return null
  // toFixed antes do round limpa o ruído binário: sem ele, 1.005 * 100 é 100.4999...
  const centavos = Math.round(Number((Math.abs(bruto) * 100).toFixed(6)))
  return bruto < 0 && centavos !== 0 ? -centavos : centavos
}
```

- [ ] **Passo 4: rodar e ver passar**

```bash
npx vitest run src/domain/planilha.test.ts
```

Esperado: 4 testes PASSAM. Se `-0.125` falhar, confira que o ramo de texto usa `decimal.slice(0, 2)` e não `decimal`.

- [ ] **Passo 5: commitar**

```bash
npm test && npm run lint && npm run typecheck
```

```bash
git add src/domain/planilha.ts src/domain/planilha.test.ts
git commit -m "feat: converter valor da planilha em centavos sem erro de ponto flutuante"
```

---

### Tarefa 6: Traduzir uma linha da planilha

**Papel:** construtor

Spec §6.2 e §6.4. Função pura: não sabe o que é arquivo, banco nem tela.

**Arquivos:**
- Modificar: `src/domain/planilha.ts`
- Modificar: `src/domain/planilha.test.ts`

**Interfaces:**
- Consome: `valorParaCentavos` (Tarefa 5)
- Produz:

```ts
export type Celula = string | number | boolean | Date | null
export type LancamentoDaPlanilha = {
  codPlanilha: number
  mesFatura: string
  pessoa: string
  categoria: string
  item: string
  valorCentavos: number
  parcelaAtual: number
  qtdParcelas: number | null
  recorrente: boolean
  pagamento: Pagamento
}
export type TraducaoDeLinha =
  | { ok: true; lancamento: LancamentoDaPlanilha; avisos: string[] }
  | { ok: false; motivo: string }
export function traduzirLinha(celulas: Celula[]): TraducaoDeLinha
```

A Tarefa 7 usa.

- [ ] **Passo 1: escrever o teste que falha**

Acrescente a `src/domain/planilha.test.ts`:

```ts
import { traduzirLinha, type Celula } from './planilha'

// Ordem das 14 colunas da aba GASTOS, conforme docs/referencias/planilha-gastos.md:
// CÓD, VENCIMENTO, ANO, MÊS, CATEGORIA, ITEM, VALOR, PARCELA ATUAL, QTD PARCELAS,
// SUBTOTAL, RESTANTE, ORIGEM, PAGO?, SITUAÇÃO
function linha(mudancas: Partial<Record<number, Celula>> = {}): Celula[] {
  const base: Celula[] = [
    1, new Date(Date.UTC(2026, 8, 5)), 2026, 'SETEMBRO', 'Mercado', 'Compra do mês',
    150.5, 1, 3, 451.5, 301, 'Ana', 'SIM', 'RECEBIDO',
  ]
  for (const [i, valor] of Object.entries(mudancas)) base[Number(i)] = valor as Celula
  return base
}

describe('traduzirLinha', () => {
  it('traduz uma linha comum', () => {
    const r = traduzirLinha(linha())
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.lancamento).toEqual({
      codPlanilha: 1,
      mesFatura: '2026-09-01', // VENCIMENTO é dia 5; guardamos o dia 1
      pessoa: 'Ana',
      categoria: 'Mercado',
      item: 'Compra do mês',
      valorCentavos: 15050,
      parcelaAtual: 1,
      qtdParcelas: 3,
      recorrente: false,
      pagamento: 'SIM',
    })
  })

  it('∞ em QTD PARCELAS vira recorrente sem quantidade', () => {
    const r = traduzirLinha(linha({ 8: '∞' }))
    expect(r.ok && r.lancamento.recorrente).toBe(true)
    expect(r.ok && r.lancamento.qtdParcelas).toBeNull()
  })

  it('PAGO? vazio vira NAO', () => {
    expect(traduzirLinha(linha({ 12: null })).ok && traduzirLinha(linha({ 12: null })))
      .toMatchObject({ lancamento: { pagamento: 'NAO' } })
    expect(traduzirLinha(linha({ 12: '' }))).toMatchObject({ lancamento: { pagamento: 'NAO' } })
  })

  it('lê a data em UTC, para o dia 5 não cair no mês anterior', () => {
    const r = traduzirLinha(linha({ 1: new Date(Date.UTC(2026, 0, 5)) }))
    expect(r.ok && r.lancamento.mesFatura).toBe('2026-01-01')
  })

  it('PARCELA ATUAL 0 vira 1, com aviso', () => {
    const r = traduzirLinha(linha({ 7: 0 }))
    expect(r.ok && r.lancamento.parcelaAtual).toBe(1)
    expect(r.ok && r.avisos).toContain('PARCELA ATUAL era 0, corrigida para 1')
  })

  it('valor com mais de duas casas gera aviso', () => {
    const r = traduzirLinha(linha({ 6: 150.555 }))
    expect(r.ok && r.lancamento.valorCentavos).toBe(15056)
    expect(r.ok && r.avisos.some((a) => a.includes('arredondado'))).toBe(true)
  })

  it('valor zero entra, com aviso', () => {
    const r = traduzirLinha(linha({ 6: 0 }))
    expect(r.ok && r.lancamento.valorCentavos).toBe(0)
    expect(r.ok && r.avisos.some((a) => a.includes('zero'))).toBe(true)
  })

  it('SUBTOTAL diferente do que a R4 calcula gera aviso', () => {
    // valor 150.50 × 3 parcelas = 451.50; aqui está 999 (fórmula sobrescrita à mão)
    const r = traduzirLinha(linha({ 9: 999 }))
    expect(r.ok && r.avisos.some((a) => a.includes('SUBTOTAL'))).toBe(true)
  })

  it.each([
    ['CÓD ausente', { 0: null }],
    ['CÓD zero', { 0: 0 }],
    ['VENCIMENTO não é data', { 1: 'setembro' }],
    ['ITEM vazio', { 5: '   ' }],
    ['VALOR não numérico', { 6: 'muito' }],
    ['CATEGORIA vazia', { 4: '' }],
    ['ORIGEM vazia', { 11: '' }],
    ['QTD PARCELAS vazia', { 8: null }],
    ['QTD PARCELAS menor que PARCELA ATUAL', { 7: 5, 8: 3 }],
    ['PARCELA ATUAL acima de smallint', { 7: 40000, 8: 40000 }],
    ['PAGO? com valor estranho', { 12: 'TALVEZ' }],
  ])('recusa: %s', (_nome, mudancas) => {
    expect(traduzirLinha(linha(mudancas)).ok).toBe(false)
  })
})
```

- [ ] **Passo 2: rodar e ver falhar**

```bash
npx vitest run src/domain/planilha.test.ts
```

Esperado: FALHA — `traduzirLinha` não existe.

- [ ] **Passo 3: implementar**

Acrescente a `src/domain/planilha.ts`. Importe `calcularSubtotal` e o tipo `Pagamento` de `./lancamento`.

Pontos que o teste cobra e que é fácil errar:

- **Data em UTC.** `getUTCFullYear()` e `getUTCMonth()`, nunca `toISOString()` sobre data local: o dia 5 em fuso negativo viraria dia 4, e em janeiro cairia em dezembro do ano anterior.
- **Aviso de arredondamento:** compare o valor bruto com `centavos / 100`; se diferirem, houve arredondamento.
- **`∞`:** a célula pode chegar como `'∞'` ou com espaços; compare depois de `trim()`.
- **Limite de `smallint`:** `parcelaAtual` e `qtdParcelas` são `smallint` no schema — acima de 32.767 o `INSERT` derrubaria **o lote inteiro**, não só a linha. Por isso é problema, não aviso.
- **`qtdParcelas` vazia com `recorrente = false`** violaria `lancamentos_parcelas_coerentes`: também é problema.
- **Aviso de SUBTOTAL:** compare a célula 9 com `calcularSubtotal({ valorCentavos, qtdParcelas, recorrente })`, os dois em centavos.

- [ ] **Passo 4: rodar e ver passar**

```bash
npx vitest run src/domain/planilha.test.ts
```

Esperado: todos PASSAM, incluindo os 11 casos do `it.each`.

- [ ] **Passo 5: commitar**

```bash
npm test && npm run lint && npm run typecheck
```

```bash
git add src/domain/planilha.ts src/domain/planilha.test.ts
git commit -m "feat: traduzir uma linha da planilha em lancamento, problema ou aviso"
```

---

### Tarefa 7: Traduzir a planilha inteira

**Papel:** construtor

Spec §6.4. Junta as linhas, numera os problemas pela linha real do Excel e pega `CÓD` repetido.

**Arquivos:**
- Modificar: `src/domain/planilha.ts`
- Modificar: `src/domain/planilha.test.ts`

**Interfaces:**
- Consome: `traduzirLinha` (Tarefa 6)
- Produz:

```ts
export type OcorrenciaDaPlanilha = { linha: number; motivo: string }
export type ResultadoDaTraducao = {
  lancamentos: LancamentoDaPlanilha[]
  problemas: OcorrenciaDaPlanilha[]
  avisos: OcorrenciaDaPlanilha[]
}
export function traduzirPlanilha(linhas: Celula[][]): ResultadoDaTraducao
```

As Tarefas 10 e 11 usam.

- [ ] **Passo 1: escrever o teste que falha**

Acrescente a `src/domain/planilha.test.ts`:

```ts
import { traduzirPlanilha } from './planilha'

describe('traduzirPlanilha', () => {
  it('separa o que entra do que tem problema', () => {
    const r = traduzirPlanilha([linha({ 0: 1 }), linha({ 0: 2, 5: '' }), linha({ 0: 3 })])
    expect(r.lancamentos.map((l) => l.codPlanilha)).toEqual([1, 3])
    expect(r.problemas).toHaveLength(1)
  })

  it('numera o problema pela linha do Excel, contando o cabeçalho', () => {
    // linhas[0] é a primeira linha de dados, que no Excel é a linha 2.
    const r = traduzirPlanilha([linha({ 0: 1, 5: '' })])
    expect(r.problemas[0].linha).toBe(2)
  })

  it('recusa CÓD repetido dentro do arquivo, mantendo o primeiro', () => {
    const r = traduzirPlanilha([linha({ 0: 7 }), linha({ 0: 7 })])
    expect(r.lancamentos).toHaveLength(1)
    expect(r.problemas[0].motivo).toContain('repetido')
  })

  it('junta os avisos com a linha de origem', () => {
    const r = traduzirPlanilha([linha({ 0: 1, 6: 0 })])
    expect(r.lancamentos).toHaveLength(1)
    expect(r.avisos[0].linha).toBe(2)
  })

  it('planilha vazia devolve tudo vazio', () => {
    expect(traduzirPlanilha([])).toEqual({ lancamentos: [], problemas: [], avisos: [] })
  })
})
```

- [ ] **Passo 2: rodar e ver falhar**

```bash
npx vitest run src/domain/planilha.test.ts -t traduzirPlanilha
```

Esperado: FALHA — `traduzirPlanilha` não existe.

- [ ] **Passo 3: implementar**

Acrescente a `src/domain/planilha.ts`:

```ts
/**
 * Traduz as linhas de dados da aba GASTOS (sem o cabeçalho).
 * O número da linha no resultado é o do Excel: índice 0 é a linha 2.
 */
export function traduzirPlanilha(linhas: Celula[][]): ResultadoDaTraducao {
  const lancamentos: LancamentoDaPlanilha[] = []
  const problemas: OcorrenciaDaPlanilha[] = []
  const avisos: OcorrenciaDaPlanilha[] = []
  const codsVistos = new Set<number>()

  linhas.forEach((celulas, indice) => {
    const linha = indice + 2
    const traducao = traduzirLinha(celulas)

    if (!traducao.ok) {
      problemas.push({ linha, motivo: traducao.motivo })
      return
    }
    // CÓD repetido dentro do próprio arquivo: o primeiro vale, o segundo é problema.
    // Sem isso, o INSERT quebraria no índice único de cod_planilha só na hora de gravar.
    if (codsVistos.has(traducao.lancamento.codPlanilha)) {
      problemas.push({ linha, motivo: `CÓD ${traducao.lancamento.codPlanilha} repetido no arquivo` })
      return
    }

    codsVistos.add(traducao.lancamento.codPlanilha)
    lancamentos.push(traducao.lancamento)
    for (const motivo of traducao.avisos) avisos.push({ linha, motivo })
  })

  return { lancamentos, problemas, avisos }
}
```

- [ ] **Passo 4: rodar e ver passar**

```bash
npx vitest run src/domain/planilha.test.ts
```

Esperado: todos PASSAM.

- [ ] **Passo 5: commitar**

```bash
npm test && npm run lint && npm run typecheck
```

```bash
git add src/domain/planilha.ts src/domain/planilha.test.ts
git commit -m "feat: traduzir a planilha inteira, com COD repetido e avisos por linha"
```

---

### Tarefa 8: Ler o arquivo `.xlsx`

**Papel:** construtor

Spec §6.1 e §11. É a única parte que conhece o formato do arquivo.

**Arquivos:**
- Criar: `src/importacao/ler-xlsx.ts`
- Criar: `src/importacao/ler-xlsx.test.ts`
- Modificar: `package.json` (dependência)

**Interfaces:**
- Consome: `Celula` (Tarefa 6)
- Produz:

```ts
export const COLUNAS_ESPERADAS: readonly string[]
export class ErroDeLeitura extends Error { constructor(mensagem: string) }
export function conferirCabecalho(primeiraLinha: Celula[]): void  // lança ErroDeLeitura
export async function lerPlanilha(arquivo: File): Promise<Celula[][]>  // sem o cabeçalho
```

As Tarefas 10 e 11 usam.

- [ ] **Passo 1: instalar a biblioteca**

```bash
npm install read-excel-file
```

Confirme que a versão instalada é 9.x: `npm list read-excel-file`.

- [ ] **Passo 2: escrever o teste que falha**

Crie `src/importacao/ler-xlsx.test.ts`. Só o cabeçalho é testado aqui — `lerPlanilha` exige um `.xlsx` de verdade, que a verificação manual da Tarefa 12 cobre.

```ts
import { describe, expect, it } from 'vitest'
import { COLUNAS_ESPERADAS, conferirCabecalho, ErroDeLeitura } from './ler-xlsx'

describe('conferirCabecalho', () => {
  it('aceita o cabeçalho da aba GASTOS', () => {
    expect(() => conferirCabecalho([...COLUNAS_ESPERADAS])).not.toThrow()
  })

  it('ignora espaços e diferença de maiúsculas', () => {
    expect(() => conferirCabecalho(COLUNAS_ESPERADAS.map((c) => ` ${c.toLowerCase()} `))).not.toThrow()
  })

  it('recusa coluna faltando, dizendo qual', () => {
    const semValor = COLUNAS_ESPERADAS.filter((c) => c !== 'VALOR')
    expect(() => conferirCabecalho([...semValor])).toThrow(ErroDeLeitura)
    expect(() => conferirCabecalho([...semValor])).toThrow(/VALOR/)
  })

  it('recusa coluna fora de ordem', () => {
    const trocado = [...COLUNAS_ESPERADAS]
    ;[trocado[5], trocado[6]] = [trocado[6], trocado[5]]
    expect(() => conferirCabecalho(trocado)).toThrow(ErroDeLeitura)
  })

  it('recusa planilha sem nenhuma linha', () => {
    expect(() => conferirCabecalho([])).toThrow(ErroDeLeitura)
  })
})
```

- [ ] **Passo 3: rodar e ver falhar**

```bash
npx vitest run src/importacao/ler-xlsx.test.ts
```

Esperado: FALHA — o módulo não existe.

- [ ] **Passo 4: implementar**

Crie `src/importacao/ler-xlsx.ts`:

```ts
import type { Celula } from '@/domain/planilha'

export const COLUNAS_ESPERADAS = [
  'CÓD', 'VENCIMENTO', 'ANO', 'MÊS', 'CATEGORIA', 'ITEM', 'VALOR',
  'PARCELA ATUAL', 'QTD PARCELAS', 'SUBTOTAL', 'RESTANTE', 'ORIGEM', 'PAGO?', 'SITUAÇÃO',
] as const

const NOME_DA_ABA = 'GASTOS'

/** Erro que a tela mostra direto para o dono: a mensagem já está em português. */
export class ErroDeLeitura extends Error {
  constructor(mensagem: string) {
    super(mensagem)
    this.name = 'ErroDeLeitura'
  }
}

function normalizar(celula: Celula): string {
  return String(celula ?? '').normalize('NFC').trim().toLocaleUpperCase('pt-BR')
}

/** Confere que a aba tem as 14 colunas esperadas, na ordem. Lança ErroDeLeitura se não tiver. */
export function conferirCabecalho(primeiraLinha: Celula[]): void {
  if (primeiraLinha.length === 0) {
    throw new ErroDeLeitura('A aba GASTOS está vazia.')
  }
  const lidas = primeiraLinha.map(normalizar)
  const esperadas = COLUNAS_ESPERADAS.map((c) => normalizar(c))

  const faltando = esperadas.filter((c) => !lidas.includes(c))
  if (faltando.length > 0) {
    throw new ErroDeLeitura(`A planilha não tem a coluna ${faltando.join(', ')}.`)
  }
  // Ordem importa: a tradução lê por posição, não por nome.
  const foraDeOrdem = esperadas.findIndex((c, i) => lidas[i] !== c)
  if (foraDeOrdem !== -1) {
    throw new ErroDeLeitura(
      `A coluna ${esperadas[foraDeOrdem]} deveria ser a ${foraDeOrdem + 1}ª, mas veio ` +
        `"${primeiraLinha[foraDeOrdem] ?? ''}".`,
    )
  }
}

/**
 * Abre o .xlsx no próprio aparelho e devolve as linhas de dados, sem o cabeçalho.
 * O import é dinâmico para a biblioteca só viajar até o navegador nesta tela.
 */
export async function lerPlanilha(arquivo: File): Promise<Celula[][]> {
  const { readSheet, SheetNotFoundError, InvalidSpreadsheetError } = await import('read-excel-file')

  let linhas: Celula[][]
  try {
    linhas = (await readSheet(arquivo, NOME_DA_ABA)) as Celula[][]
  } catch (erro) {
    if (erro instanceof SheetNotFoundError) {
      throw new ErroDeLeitura(`A planilha não tem a aba "${NOME_DA_ABA}".`)
    }
    if (erro instanceof InvalidSpreadsheetError) {
      throw new ErroDeLeitura('O arquivo não é uma planilha válida, ou está protegido por senha.')
    }
    throw new ErroDeLeitura('Não foi possível ler o arquivo. Ele precisa ser um .xlsx.')
  }

  const [cabecalho, ...dados] = linhas
  conferirCabecalho(cabecalho ?? [])
  return dados
}
```

Se os nomes `SheetNotFoundError` e `InvalidSpreadsheetError` não existirem no pacote instalado, confira `node_modules/read-excel-file/browser/index.d.ts` e use os que estiverem lá. **Não invente nomes.**

- [ ] **Passo 5: rodar e ver passar**

```bash
npx vitest run src/importacao/ler-xlsx.test.ts
```

Esperado: 5 testes PASSAM.

- [ ] **Passo 6: commitar**

```bash
npm test && npm run lint && npm run typecheck
```

```bash
git add src/importacao/ package.json package-lock.json
git commit -m "feat: ler o .xlsx no aparelho, com cabecalho conferido"
```

---

### Tarefa 9: Consultas de importação

**Papel:** construtor

Spec §6.6 e §6.7.

**Arquivos:**
- Criar: `src/db/importacao.ts`
- Criar: `src/db/importacao.test.ts`

**Interfaces:**
- Consome: `lancamentos` (Tarefa 2), `LancamentoDaPlanilha` (Tarefa 6), `obterOuCriarPessoa`/`obterOuCriarCategoria` (Tarefa 1)
- Produz:

```ts
export const TAMANHO_DO_LOTE = 500
export async function codsJaImportados(db: Db, cods: number[]): Promise<Set<number>>
export async function resolverCadastros(db: Db, pessoas: string[], categorias: string[]):
  Promise<{ pessoas: Map<string, number>; categorias: Map<string, number> }>
export async function gravarLote(
  db: Db, lote: LancamentoDaPlanilha[],
  mapas: { pessoas: Map<string, number>; categorias: Map<string, number> },
): Promise<number>
export async function desfazerImportacao(db: Db): Promise<number>
```

A Tarefa 10 usa.

- [ ] **Passo 1: escrever o teste que falha**

Crie `src/db/importacao.test.ts` cobrindo, cada um com seu `it`:

1. `codsJaImportados` devolve só os `cod_planilha` que existem.
2. `gravarLote` grava e devolve a quantidade inserida.
3. **Rodar `gravarLote` duas vezes com o mesmo lote não duplica** — é a prova da idempotência.
4. Um lançamento manual (`fonte: 'manual'`, `codPlanilha: null`) com `id` igual a um `CÓD` da planilha **não** impede a linha da planilha de entrar — é a prova da decisão D12.
5. `gravarLote` grava com `fonte: 'planilha'` — o desfazer depende disso.
6. `desfazerImportacao` apaga só `fonte = 'planilha'`, deixando `manual` intacto.
7. `resolverCadastros` devolve um mapa e **não cria duplicata** quando o mesmo nome vem duas vezes.

Modelo do teste 4, que é o mais importante:

```ts
it('CÓD da planilha não colide com id de lançamento manual', async () => {
  const { db, fechar } = await criarBancoDeTeste()
  try {
    const pessoa = await obterOuCriarPessoa(db, 'Ana')
    const categoria = await obterOuCriarCategoria(db, 'Mercado')
    // Um lançamento manual consome o id 1.
    await db.insert(lancamentos).values({
      mesFatura: '2026-09-01', pessoaId: pessoa.id, categoriaId: categoria.id,
      item: 'Manual', valorCentavos: 500, parcelaAtual: 1, qtdParcelas: 1,
      recorrente: false, fonte: 'manual',
    })

    // A planilha traz CÓD 1. Antes da D12 isso seria descartado em silêncio.
    const mapas = await resolverCadastros(db, ['Ana'], ['Mercado'])
    const gravados = await gravarLote(db, [lancamentoDaPlanilha({ codPlanilha: 1 })], mapas)

    expect(gravados).toBe(1)
    const todos = await db.select({ id: lancamentos.id }).from(lancamentos)
    expect(todos).toHaveLength(2)
  } finally {
    await fechar()
  }
})
```

Escreva uma fábrica `lancamentoDaPlanilha(mudancas)` no topo do arquivo, como a `linha()` da Tarefa 6.

- [ ] **Passo 2: rodar e ver falhar**

```bash
npx vitest run src/db/importacao.test.ts
```

Esperado: FALHA — o módulo não existe.

- [ ] **Passo 3: implementar**

Crie `src/db/importacao.ts`. Pontos que os testes cobram:

- `gravarLote` usa **um** `INSERT` com todas as linhas do lote e `.onConflictDoNothing({ target: lancamentos.codPlanilha })`, e devolve `.returning()` contado. Nunca um `INSERT` por linha. O `target` funciona porque o índice da Tarefa 2 é simples: contra um índice **parcial**, o Postgres responde `there is no unique or exclusion constraint matching the ON CONFLICT specification` — em tempo de execução, não de compilação.
- `resolverCadastros` chama `obterOuCriarPessoa`/`obterOuCriarCategoria` **uma vez por nome distinto**, não uma por linha: são ~44 nomes contra 4.805 linhas. Passe os nomes por `normalizarNome` antes de usar como chave do mapa, para a chave bater com o que foi gravado.
- `codsJaImportados` seleciona só a coluna `codPlanilha`, com `inArray`. Nunca `select()` da linha inteira.
- `TAMANHO_DO_LOTE = 500`: o `INSERT` grava 13 colunas por linha e o Postgres aceita 65.535 parâmetros por consulta. 500 dá 6.500, com folga larga e dez passos de progresso.
- `desfazerImportacao` é `delete(lancamentos).where(eq(lancamentos.fonte, 'planilha'))`.

- [ ] **Passo 4: rodar e ver passar**

```bash
npx vitest run src/db/importacao.test.ts
```

Esperado: 7 testes PASSAM.

- [ ] **Passo 5: commitar**

```bash
npm test && npm run lint && npm run typecheck
```

```bash
git add src/db/importacao.ts src/db/importacao.test.ts
git commit -m "feat: consultas de importacao em lotes idempotentes e desfazer"
```

---

### Tarefa 10: Server Actions da importação

**Papel:** construtor

Spec §6.5 e §12.

**Arquivos:**
- Criar: `src/app/(app)/importar/actions.ts`
- Criar: `src/app/(app)/importar/validacao.ts`
- Criar: `src/app/(app)/importar/validacao.test.ts`

**Interfaces:**
- Consome: Tarefa 9
- Produz:

```ts
export async function conferirCods(cods: number[]): Promise<{ jaImportados: number[] }>
export async function gravarLoteAction(lote: unknown):
  Promise<{ ok: true; gravados: number } | { ok: false; erro: string }>
export async function desfazerAction(): Promise<{ ok: true; apagados: number }>
```

A Tarefa 11 usa.

- [ ] **Passo 1: escrever o teste de validação que falha**

O esquema Zod é o que protege o banco de um POST direto com tipo errado. Crie `validacao.test.ts` cobrindo: lote válido passa · lote acima de 500 é recusado · `codPlanilha` não inteiro é recusado · `mesFatura` fora do dia 1 é recusado · `qtdParcelas` nulo com `recorrente: false` é recusado · mensagens **em português** (o Zod responde em inglês por padrão).

- [ ] **Passo 2: rodar e ver falhar**

```bash
npx vitest run "src/app/(app)/importar/validacao.test.ts"
```

- [ ] **Passo 3: escrever o esquema**

Em `validacao.ts`, espelhe `LancamentoDaPlanilha` com Zod, com `.max(TAMANHO_DO_LOTE)` no array e `message` em português em cada regra. Siga o padrão de `src/app/(app)/lancamentos/novo/validacao.ts`, que já existe.

- [ ] **Passo 4: escrever as actions**

Em `actions.ts`, **`'use server'` no topo e `await exigirSessao()` na primeira linha de cada action** — inclusive na de conferir, que parece inofensiva mas revela quais `CÓD` existem.

```ts
'use server'

import { exigirSessao } from '@/auth/sessao'
import { obterDb } from '@/db/cliente'
import { codsJaImportados, desfazerImportacao, gravarLote, resolverCadastros } from '@/db/importacao'
import { loteSchema } from './validacao'

export async function gravarLoteAction(lote: unknown) {
  await exigirSessao()
  const validado = loteSchema.safeParse(lote)
  if (!validado.success) {
    return { ok: false as const, erro: validado.error.issues[0].message }
  }
  const db = obterDb()
  const mapas = await resolverCadastros(
    db,
    validado.data.map((l) => l.pessoa),
    validado.data.map((l) => l.categoria),
  )
  return { ok: true as const, gravados: await gravarLote(db, validado.data, mapas) }
}
```

- [ ] **Passo 5: rodar e ver passar**

```bash
npx vitest run "src/app/(app)/importar/"
```

- [ ] **Passo 6: commitar**

```bash
npm test && npm run lint && npm run typecheck
```

```bash
git add "src/app/(app)/importar/"
git commit -m "feat: actions de conferir, gravar em lotes e desfazer importacao"
```

---

### Tarefa 11: Assistente de importação

**Papel:** designer (invoca a skill `ui-ux-pro-max` antes de escrever)

Spec §6.5, §9.1 e §10. Quatro etapas com progresso explícito.

**Arquivos:**
- Criar: `src/app/(app)/importar/page.tsx`
- Criar: `src/app/(app)/importar/assistente.tsx`
- Modificar: `src/components/navegacao.tsx`

**Interfaces:**
- Consome: Tarefas 3, 7, 8, 10
- Produz: a rota `/importar`

- [ ] **Passo 1: a página**

`page.tsx` é Server Component e chama `await exigirSessao()` na primeira linha, como as outras páginas de `(app)`. Ela só renderiza `<Assistente />`.

- [ ] **Passo 2: o assistente**

`assistente.tsx` é Client Component (`'use client'`) e guarda em estado: etapa atual, resultado da tradução, quais `CÓD` já existem, e o progresso da gravação.

Fluxo: escolher arquivo → `lerPlanilha` → `traduzirPlanilha` → `conferirCods` → mostrar contagem → ao confirmar, fatiar em lotes de `TAMANHO_DO_LOTE` e chamar `gravarLoteAction` em sequência, atualizando o progresso → relatório.

Regras da tela:

- **Nada é gravado antes da confirmação.** O botão da etapa 2 diz o que vai acontecer, com o número: "Gravar 4.802 lançamentos".
- Progresso com `<progress>` ou `role="progressbar"` e texto "lote 4 de 10" — não só a barra.
- Problemas e avisos em listas separadas, cada item com o número da linha do Excel.
- **Avise antes de começar** que sair da página no meio faz perder a leitura e exige reescolher o arquivo (spec §11) — o arquivo só existe na memória do navegador.
- Alvo de toque 44×44px; erro com `aria-invalid` e `aria-describedby`; `aria-live="polite"` na região do progresso.
- Estado vazio que ensina, não que reclama.
- Ícones `lucide-react`, nunca emoji.

- [ ] **Passo 3: a navegação**

Em `src/components/navegacao.tsx`, os quatro itens com ícones `lucide-react`: início (`Home`), lançamentos (`List`), lançar (`Plus`), importar (`Upload`). O `＋` de texto sai. Mantenha o `pb-[env(safe-area-inset-bottom)]`, que existe por causa da barra de gestos do iPhone.

- [ ] **Passo 4: conferir no navegador**

```bash
npm run dev
```

Confira, com a janela estreita (375px) e larga: a barra inferior não cobre conteúdo · dá para percorrer tudo só com o teclado, com foco visível · tema claro e escuro · nenhuma rolagem horizontal. Sem a planilha real ainda — a Tarefa 12 faz isso.

- [ ] **Passo 5: commitar**

```bash
npm test && npm run lint && npm run typecheck && npm run build
```

```bash
git add "src/app/(app)/importar/" src/components/navegacao.tsx
git commit -m "feat: assistente de importacao em quatro etapas"
```

---

### Tarefa 12: Migração real e README

**Papel:** você (manual), com o `ajudante` escrevendo a documentação

É aqui que a planilha de verdade entra. **Nada neste passo vai para o repositório.**

**Arquivos:**
- Modificar: `README.md` (papel: ajudante)

- [ ] **Passo 1: aplicar as migrações no banco `dev`**

```bash
npm run db:migrate
```

- [ ] **Passo 2: importar a planilha real**

```bash
npm run dev
```

Abra `/importar` e envie o `USO_CARTÃO.xlsx`, que fica **fora do repositório**. Na etapa 2, confira:

- linhas lidas: **4.805**
- com problema: espera-se **0**. Se aparecer algum, leia o motivo antes de confirmar — pode ser um caso que a Tarefa 6 não previu.
- avisos: espera-se **433** de arredondamento, **3** de valor zero e **4** de SUBTOTAL.

Se os números baterem, confirme.

- [ ] **Passo 3: conferir contra a planilha**

Abra `/lancamentos` no mês corrente e compare o total com o da aba GASTOS filtrada pelo mesmo `VENCIMENTO`. Anote se bateu ao centavo ou se a diferença é exatamente a soma dos arredondamentos daquele mês (critério de aceite 2).

- [ ] **Passo 4: testar o reenvio**

Envie o **mesmo arquivo** de novo. Esperado na etapa 2: **4.805 já importadas, 0 novas**. Confirme e verifique que a contagem de lançamentos no banco não mudou — é o critério de aceite 3.

- [ ] **Passo 5: testar no celular**

```bash
npm run dev -- --hostname 0.0.0.0
```

Abra pelo IP do computador na mesma rede Wi-Fi. Percorra o assistente com uma mão só.

- [ ] **Passo 6: documentar**

O `ajudante` acrescenta ao `README.md`: como importar a planilha, o que cada etapa mostra, como desfazer, e o comando `--hostname 0.0.0.0` para testar no celular. Sem inventar comportamento: só descrever o que existe.

- [ ] **Passo 7: commitar**

```bash
git add README.md
git commit -m "docs: como importar a planilha e testar no celular"
```

---

## Depois deste plano

O Plano A2 (`docs/superpowers/plans/`, a escrever) traz R7, R10, `db/agregados.ts`, o painel com os quatro gráficos, e o sistema de design nas telas que já existem.

## Revisão

Cada tarefa é revisada pelo `cerebro` (Opus) antes da seguinte começar. Ao fim do plano, revisão final do branch, também pelo `cerebro`.
