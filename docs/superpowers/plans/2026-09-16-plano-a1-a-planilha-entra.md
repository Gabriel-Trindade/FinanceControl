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
- **Nunca desestruture o retorno de `db.execute`.** Neste projeto o tipo `Db` faz esse retorno resolver para `unknown`, e desestruturar reprova no `typecheck` com `TS2488`, mesmo o teste passando. Para contar linhas use `db.$count(tabela)`; para ler, `db.select(...).from(...)`.
- O shell deste projeto é **PowerShell**. Prefixo de variável inline (`VAR=x comando`) não existe: use `$env:VAR='x'; comando`.
- **`npm test` verde não significa tipos corretos.** O Vitest compila com esbuild, que apaga os tipos sem checá-los. Um erro de tipo só aparece no `npm run typecheck`, que é portão separado. No passo "veja falhar" do TDD, o vermelho pode precisar de dois comandos: um pelo comportamento, outro pelo tipo.
- **Nunca escreva código que emita sessão, pule `exigirSessao()` ou contorne o `proxy`** — nem temporário, nem local, nem "só para testar". Vale para Route Handler, Server Action, página e script. Para exercitar uma tela protegida sem a senha do dono: force o estado numa rota **pública** (`/login` compartilha o mesmo `error.tsx` e o mesmo layout raiz), ou use o alternador de error boundary do React DevTools. Se nem isso servir, **pare e devolva ao Cérebro**: falta de caminho de teste é problema de arquitetura, não algo para contornar com um endpoint. Um atalho desses funciona dez vezes; na décima primeira alguém roda `git add -A` e publica uma porta dos fundos.

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

`normalize(texto, NFC)` existe no Postgres e **funciona no PGlite** dos testes (verificado contra o PGlite 0.5.8 / Postgres 18.3).

**Antes de aplicar no banco `dev`**, confira que o `UPDATE` não vai colidir. Se "José" já existir nas duas formas, normalizar as duas viola `pessoas_nome_unico` e a migração aborta no meio:

```bash
npm run db:migrate
```

Se abortar com `pessoas_nome_unico` ou `categorias_nome_unico`, há nome duplicado em formas diferentes. São poucas linhas no `dev`: apague a duplicata à mão antes de repetir.

- [ ] **Passo 6: testar a migração contra o banco em memória**

Acrescente a `src/db/cadastros-nfc.test.ts`:

```ts
import { criarBancoDeTeste } from '../../tests/banco-de-teste'
import { obterOuCriarPessoa } from './cadastros'
import { pessoas } from './schema'

it('o mesmo nome em NFC e NFD resolve para uma pessoa só', async () => {
  const { db, fechar } = await criarBancoDeTeste()
  try {
    const primeira = await obterOuCriarPessoa(db, NFD)
    const segunda = await obterOuCriarPessoa(db, NFC)
    expect(segunda.id).toBe(primeira.id)
    expect(await db.$count(pessoas)).toBe(1)
  } finally {
    await fechar()
  }
})
```

**Não use `db.execute`.** Neste projeto o tipo `Db` faz `db.execute` resolver para `unknown`, e desestruturar o resultado reprova no `typecheck` com `TS2488: Type 'unknown' must have a '[Symbol.iterator]()' method` — mesmo o teste passando. Use `db.$count(tabela)`, que devolve `number`, ou `db.select(...).from(...)` com `toHaveLength`. Vale para **todas** as tarefas deste plano.

- [ ] **Passo 6b: provar que a migração faz alguma coisa**

O teste acima exercita a função, não a migração: `criarBancoDeTeste` aplica as migrações num banco **vazio**, então o `UPDATE` não encontra nada e passaria mesmo com o SQL errado. Acrescente:

```ts
import { sql } from 'drizzle-orm'

it('a migração normaliza nomes já gravados em NFD', async () => {
  const { db, fechar } = await criarBancoDeTeste()
  try {
    // Insere direto, sem passar por normalizarNome: simula linha gravada antes da correção.
    await db.insert(pessoas).values({ nome: NFD })
    await db.execute(sql`update pessoas set nome = normalize(nome, NFC) where nome <> normalize(nome, NFC)`)

    // Agora a busca por lower(nome) encontra a linha, em vez de criar uma segunda.
    const encontrada = await obterOuCriarPessoa(db, NFC)
    expect(encontrada.nome).toBe(NFC)
    expect(await db.$count(pessoas)).toBe(1)
  } finally {
    await fechar()
  }
})
```

Aqui `db.execute` aparece sem desestruturar o retorno, que é o uso que compila.

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
- Produz: `lancamentos.codPlanilha: integer | null`, com índice único **simples** `lancamentos_cod_planilha_unico`. As tarefas 9 e 11 dependem disso.

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

Esperado: FALHA. Mas atenção ao **como**: o Vitest compila com esbuild, que apaga os tipos sem checá-los, então a chave `codPlanilha` inexistente não gera erro de tipo aqui — o Drizzle simplesmente a ignora, e o vermelho vem do comportamento (a segunda inserção resolve em vez de rejeitar). Para ver o erro de tipo, rode `npm run typecheck` à parte. Dois comandos, um vermelho cada.

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
npx drizzle-kit generate --name=cod_planilha
```

O `--name` não é opcional: sem ele o drizzle-kit inventa um nome aleatório e o arquivo `0002_cod_planilha.sql` listado em **Arquivos** não vai existir.

Abra o arquivo gerado em `drizzle/` e confirme que ele tem:

```sql
ALTER TABLE "lancamentos" ADD COLUMN "cod_planilha" integer;
CREATE UNIQUE INDEX "lancamentos_cod_planilha_unico" ON "lancamentos" USING btree ("cod_planilha");
```

**Sem `WHERE`.** Se aparecer um `WHERE cod_planilha is not null`, o schema do passo 3 foi escrito com `.where()` e precisa voltar — um índice parcial faz o `ON CONFLICT` da Tarefa 9 falhar em execução com `there is no unique or exclusion constraint matching the ON CONFLICT specification`. Não edite a migração à mão: corrija o schema e gere de novo.

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

Em `src/app/layout.tsx`, troque a importação e a declaração:

```tsx
import { IBM_Plex_Sans, Geist_Mono } from "next/font/google";

// Sem weight: no Next 16.3.5 a IBM Plex Sans é fonte variável (eixos wght 100–700
// e wdth), então vem um arquivo só e qualquer peso fica disponível.
const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
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

**Mapeie os tokens novos em `@theme inline` também**, junto de `--color-chart-1` e companhia (linhas 30–34 do arquivo): `--color-situacao-a-receber: var(--situacao-a-receber);` e assim por diante. Sem isso, `bg-situacao-recebido` não existe como classe e as telas ficam presas a `text-[var(--situacao-recebido)]`.

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
export default function Erro({ retry }: { error: Error; retry: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-6">
      <h1 className="text-xl font-semibold">Alguma coisa deu errado</h1>
      <p className="text-sm text-muted-foreground">
        Não foi possível carregar esta página. Isso costuma ser falha de conexão com o banco.
      </p>
      <button
        type="button"
        onClick={() => retry()}
        className="min-h-11 rounded-md border px-4 text-sm font-medium"
      >
        Tentar de novo
      </button>
    </main>
  )
}
```

**É `retry`, não `reset`.** O `retry` virou estável no Next 16.3.0 e é ele que **refaz a busca** no servidor antes de renderizar de novo. O `reset` só limpa o estado de erro e re-renderiza com os mesmos dados — com o banco fora do ar, o dono clicaria em "Tentar de novo" e veria exatamente a mesma tela. Os dois compilam, então nem o `typecheck` nem o teste do passo 3 acusariam a troca. Leia `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/error.md` antes de escrever: este Next tem mudanças que não estão na memória do modelo.

Não mostre `error.message` na tela: pode conter detalhe da conexão com o banco.

- [ ] **Passo 2: criar `src/app/global-error.tsx`**

Este substitui o `<html>` inteiro, então precisa trazer as próprias tags:

```tsx
'use client'

// Último recurso: só dispara quando o erro acontece no próprio layout raiz,
// e por isso precisa renderizar <html> e <body>, que ali já falharam.
export default function ErroGlobal({ retry }: { error: Error; retry: () => void }) {
  return (
    <html lang="pt-BR">
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: 0, padding: '2rem' }}>
        <h1 style={{ fontSize: '1.25rem' }}>O aplicativo não conseguiu iniciar</h1>
        <p style={{ fontSize: '0.875rem' }}>Tente de novo em alguns instantes.</p>
        <button type="button" onClick={() => retry()} style={{ minHeight: '2.75rem', padding: '0 1rem' }}>
          Tentar de novo
        </button>
      </body>
    </html>
  )
}
```

O estilo vai inline de propósito, e não é preciosismo: a documentação confirma que o `global-error` **não recebe os estilos globais**, porque substitui o layout raiz onde eles são carregados.

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

No PowerShell, que é o shell deste projeto (não existe prefixo de variável inline como no bash):

```powershell
$env:DATABASE_URL='postgresql://ci:ci@localhost:5432/ci'; $env:AUTH_USUARIO='ci'; $env:AUTH_SENHA_HASH='scrypt:16384:8:1:Y2ktc2FsLWZhbHNv:Y2ktaGFzaC1mYWxzbw'; $env:AUTH_SEGREDO='segredo-falso-do-ci-com-mais-de-32-caracteres'; npm run build
```

Esperado: build conclui. **Renomeie o `.env.local` temporariamente** antes de rodar, senão ele fornece as variáveis e o teste não prova nada. Se falhar por variável de ambiente, o valor no workflow precisa do mesmo ajuste.

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

  it.each([
    ['nulo', null],
    ['texto vazio', ''],
    ['só espaços', '   '],
  ])('PAGO? %s vira NAO', (_nome, celula) => {
    const r = traduzirLinha(linha({ 12: celula }))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.lancamento.pagamento).toBe('NAO')
  })

  it('PAGO? PERDOADO entra como PERDOADO', () => {
    const r = traduzirLinha(linha({ 12: 'PERDOADO' }))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.lancamento.pagamento).toBe('PERDOADO')
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
    // A célula 9 acompanha: 150.555 × 3 = 451.665, senão dispara também o aviso de SUBTOTAL.
    const r = traduzirLinha(linha({ 6: 150.555, 9: 451.665 }))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.lancamento.valorCentavos).toBe(15056)
    expect(r.avisos.some((a) => a.includes('arredondado'))).toBe(true)
  })

  it('valor zero entra, com aviso', () => {
    const r = traduzirLinha(linha({ 6: 0, 9: 0 }))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.lancamento.valorCentavos).toBe(0)
    expect(r.avisos.some((a) => a.includes('zero'))).toBe(true)
  })

  it('SUBTOTAL sobrescrito à mão gera aviso', () => {
    // valor 150.50 × 3 parcelas = 451.50; aqui está 999 (fórmula sobrescrita à mão)
    const r = traduzirLinha(linha({ 9: 999 }))
    expect(r.ok && r.avisos.some((a) => a.includes('SUBTOTAL'))).toBe(true)
  })

  it('SUBTOTAL do Excel, calculado antes do arredondamento, NÃO gera aviso', () => {
    // Este é o teste que impede o aviso de disparar às centenas.
    // A fórmula do Excel é QTD × VALOR sem arredondar: 3 × 33,333333 = 99,999999.
    // calcularSubtotal multiplica os centavos JÁ arredondados: 3 × 3333 = 9999.
    // Os dois divergem por 1 centavo, e isso é normal — não é fórmula sobrescrita.
    const r = traduzirLinha(linha({ 6: 33.333333, 7: 1, 8: 3, 9: 99.999999 }))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.avisos.some((a) => a.includes('SUBTOTAL'))).toBe(false)
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
- **`item` também leva `.normalize('NFC')`**, antes do `trim()`. Pessoa e categoria já normalizam (via `normalizarNome`, Tarefa 1) e o item não normalizava — mas ele vem do mesmo Excel, e a R10 do Plano A2 agrupa séries por item. "Café" em NFC e em NFD não agrupariam, e o bug seria silencioso.
- **Aviso de arredondamento:** compare `Number(bruto)` com `centavos / 100`; se diferirem, houve arredondamento. A comparação é exata em ponto flutuante nos dois casos, porque dividir inteiro por 100 e ler o decimal dão o mesmo `double`.
- **`∞`:** a célula pode chegar como `'∞'` ou com espaços; compare depois de `trim()`.
- **Limite de `smallint`:** `parcelaAtual` e `qtdParcelas` são `smallint` no schema — acima de 32.767 o `INSERT` derrubaria **o lote inteiro**, não só a linha. Por isso é problema, não aviso.
- **`qtdParcelas` vazia com `recorrente = false`** violaria `lancamentos_parcelas_coerentes`: também é problema.
- **Aviso de SUBTOTAL, com tolerância.** Compare a célula 9 com `calcularSubtotal(...)`, os dois em centavos, e **só avise se a diferença passar de `qtdParcelas` centavos**.

  A tolerância não é frouxidão: a fórmula do Excel é `QTD × VALOR` calculada sobre o valor **sem arredondar**, enquanto `calcularSubtotal` multiplica os centavos **já arredondados**. Para qualquer das 433 linhas de mais de duas casas com `QTD ≥ 2`, os dois divergem por alguns centavos — sem tolerância o aviso dispararia centenas de vezes, e as 4 fórmulas realmente sobrescritas (a única coisa que o aviso existe para achar) ficariam enterradas no meio do ruído, junto com o critério de conferência da Tarefa 12. O desvio máximo é da ordem de `qtdParcelas / 2 + 1` centavos; usar `qtdParcelas` como folga cobre isso e ainda pega as sobrescritas, que divergem por valores grandes.

- **Mensagens.** Escreva a tabela de mensagens antes de implementar, uma frase por motivo, e reaproveite: é esse texto que o dono lê na tela de conferência. Quando uma linha tiver dois defeitos, vence o **primeiro** motivo na ordem em que a lista da §6.4 da spec está escrita — fixe a ordem, para o texto não mudar conforme a implementação.
- **Células numéricas podem chegar como texto.** `CÓD`, `VALOR`, `PARCELA ATUAL` e `QTD PARCELAS` aceitam `number` ou `string` numérica (`'3'` é válido). `valorParaCentavos` já trata os dois; faça o mesmo para os inteiros.

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
export function mapearErroDeLeitura(erro: unknown, tipos: {...}): ErroDeLeitura
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
import { COLUNAS_ESPERADAS, conferirCabecalho, ErroDeLeitura, mapearErroDeLeitura } from './ler-xlsx'

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

describe('mapearErroDeLeitura', () => {
  it('traduz cada erro da biblioteca para português', async () => {
    const m = await import('read-excel-file/browser')

    expect(mapearErroDeLeitura(new m.SheetNotFoundError('x'), m).message).toContain('GASTOS')
    expect(mapearErroDeLeitura(new m.InvalidSpreadsheetError('x'), m).message).toContain('senha')
    expect(mapearErroDeLeitura(new m.InvalidInputError('x'), m).message).toContain('.xlsx')
    expect(mapearErroDeLeitura(new Error('desconhecido'), m)).toBeInstanceOf(ErroDeLeitura)
  })

  it('não embrulha um ErroDeLeitura que já veio pronto', async () => {
    const m = await import('read-excel-file/browser')
    const original = new ErroDeLeitura('mensagem original')
    expect(mapearErroDeLeitura(original, m)).toBe(original)
  })
})
```

Se os construtores dessas classes exigirem argumentos diferentes, veja a assinatura em `node_modules/read-excel-file/browser/index.d.ts` e ajuste **só a construção no teste** — os nomes estão confirmados.

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

/** Traduz o erro da biblioteca numa mensagem que o dono entende. Separado para ter teste. */
export function mapearErroDeLeitura(
  erro: unknown,
  tipos: {
    SheetNotFoundError: new (...args: never[]) => Error
    InvalidSpreadsheetError: new (...args: never[]) => Error
    InvalidInputError: new (...args: never[]) => Error
  },
): ErroDeLeitura {
  if (erro instanceof ErroDeLeitura) return erro
  if (erro instanceof tipos.SheetNotFoundError) {
    return new ErroDeLeitura(`A planilha não tem a aba "${NOME_DA_ABA}".`)
  }
  if (erro instanceof tipos.InvalidSpreadsheetError) {
    return new ErroDeLeitura('O arquivo não é uma planilha válida, ou está protegido por senha.')
  }
  if (erro instanceof tipos.InvalidInputError) {
    return new ErroDeLeitura('Não foi possível ler o arquivo. Ele precisa ser um .xlsx.')
  }
  return new ErroDeLeitura('Não foi possível ler o arquivo.')
}

/**
 * Abre o .xlsx no próprio aparelho e devolve as linhas de dados, sem o cabeçalho.
 * O import é dinâmico para a biblioteca só viajar até o navegador nesta tela.
 */
export async function lerPlanilha(arquivo: File): Promise<Celula[][]> {
  const modulo = await import('read-excel-file/browser')

  let linhas: Celula[][]
  try {
    linhas = (await modulo.readSheet(arquivo, NOME_DA_ABA)) as Celula[][]
  } catch (erro) {
    throw mapearErroDeLeitura(erro, modulo)
  }

  const [cabecalho, ...dados] = linhas
  conferirCabecalho(cabecalho ?? [])
  return dados
}
```

**O caminho é `'read-excel-file/browser'`, não `'read-excel-file'`.** O pacote 9.3.10 **não tem export padrão**: o `exports` do `package.json` só declara `./browser`, `./node`, `./web-worker`, `./universal` e `./package.json`. Importar do nome cru falha com `ERR_PACKAGE_PATH_NOT_EXPORTED` — e falha no build ou em execução, nunca no `tsc`, então os testes desta tarefa passariam e o erro só apareceria quando o dono escolhesse o arquivo.

Os quatro nomes usados acima já foram conferidos no pacote real e **existem** como classes exportadas em `/browser`: `readSheet`, `SheetNotFoundError`, `InvalidSpreadsheetError` e `InvalidInputError`. A assinatura é `readSheet(input, sheet?: number | string, options?)`, e `Input` aceita `File | Blob | ArrayBuffer` — então passar o `File` do navegador está correto. **Não troque esses nomes.**

Passar o módulo inteiro para `mapearErroDeLeitura` existe por um motivo: as classes de erro só chegam depois do `import()` dinâmico, então não dá para usá-las num `instanceof` de módulo importado no topo — e é isso que torna as três outras recusas testáveis sem nenhum `.xlsx`.

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

**Antes de começar, unifique a normalização de nome.** Hoje existem duas cópias idênticas: `normalizarNome` em `src/db/cadastros.ts` (Tarefa 1) e `normalizarCadastro` em `src/domain/planilha.ts` (Tarefa 6). A spec §6.8 diz explicitamente que é **a mesma função** — duas cópias que derivem produzem chaves de mapa diferentes dos dois lados desta tarefa, e o `INSERT` quebra com violação de `NOT NULL` no lote inteiro, sem dizer qual nome causou.

A tradução não podia importar de `src/db/` (é `src/domain/` puro), então o lugar certo da função é o domínio:

1. Mover `normalizarNome` para `src/domain/texto.ts`, junto de `compararNomes`, que já trata nome.
2. `src/db/cadastros.ts` passa a importá-la de lá (pode reexportar, se algum chamador depender do caminho antigo).
3. `src/domain/planilha.ts` passa a usá-la, e `normalizarCadastro` deixa de existir.
4. Os testes das Tarefas 1 e 6 continuam passando sem alteração — se algum precisar mudar, a movimentação mudou comportamento e está errada.

**Arquivos:**
- Criar: `src/db/importacao.ts`
- Criar: `src/db/importacao.test.ts`

**Interfaces:**
- Consome: `lancamentos` (Tarefa 2), `LancamentoDaPlanilha` (Tarefa 6), `obterOuCriarPessoa`/`obterOuCriarCategoria` (Tarefa 1)
- Produz:

```ts
// Em src/importacao/lotes.ts (NÃO em db/importacao.ts — ver as armadilhas do passo 3):
export const TAMANHO_DO_LOTE = 500

// Em src/db/importacao.ts:
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
7. `resolverCadastros` devolve um mapa e **não cria duplicata** quando o mesmo nome vem em grafias diferentes — use `'Ana'` e `'ANA'`, não o mesmo texto duas vezes; com texto repetido o teste passaria com qualquer implementação.
8. **Reenviar não altera o que já existe.** Grave o lote, marque um lançamento como `pagamento: 'SIM'`, grave o mesmo lote de novo, e afirme que ele continua `'SIM'`. Os testes 3 e 8 provam coisas diferentes: o 3 diz que o reenvio não **duplica**, o 8 diz que não **sobrescreve** — e é o 8 que prova o critério de aceite 4.
9. **Retomada depois de falha.** Grave o lote 1, simule a falha do lote 2 (não chame), depois grave lotes 1 e 2 juntos: o total precisa ficar certo, sem duplicata. É a prova de que "tentar de novo" é seguro.

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
- `resolverCadastros` chama `obterOuCriarPessoa`/`obterOuCriarCategoria` **uma vez por nome distinto**, não uma por linha: são ~44 nomes contra 4.805 linhas.
- **A chave do mapa é `normalizarNome(nome).toLocaleLowerCase('pt-BR')`, nos dois lados** — ao montar em `resolverCadastros` e ao consultar em `gravarLote`. O banco compara por `lower(nome)` (é assim que `pessoas_nome_unico` é definido), então "Ana" e "ANA" são a **mesma** pessoa lá; sem baixar a caixa na chave, o mapa criaria duas entradas apontando para o mesmo id, e qualquer diferença entre as duas transformações faria `mapas.pessoas.get(nome)` devolver `undefined`. Esse erro é silencioso: o `INSERT` quebra com violação de `NOT NULL` no **lote inteiro**, sem dizer qual nome causou.
- `codsJaImportados` seleciona só a coluna `codPlanilha`, com `inArray`. Nunca `select()` da linha inteira.
- **O mapeamento para o `INSERT` é literal e completo**, com os três campos que a spec §6.2 fixa e que não vêm da planilha: `fonte: 'planilha'`, `pagoEm: null` e `dataCompra: null`. Mais `codPlanilha`, `mesFatura`, `pessoaId` e `categoriaId` (dos mapas), `item`, `valorCentavos`, `parcelaAtual`, `qtdParcelas`, `recorrente` e `pagamento`.
- `TAMANHO_DO_LOTE = 500`: são 13 a 14 colunas por linha, e o Postgres aceita 65.535 parâmetros por consulta. 500 dá cerca de 7.000 — folga larga, com dez passos de progresso.
- **`TAMANHO_DO_LOTE` mora em `src/importacao/`, não aqui.** A Tarefa 11 é componente de cliente e precisa dessa constante para fatiar; importá-la de `src/db/importacao.ts` arrastaria `drizzle-orm` e o schema inteiro para o pacote do navegador. Declare em `src/importacao/lotes.ts` e reexporte daqui, se for conveniente.
- `desfazerImportacao` é `delete(lancamentos).where(eq(lancamentos.fonte, 'planilha'))`, devolvendo a contagem apagada.

Uma confirmação útil, já verificada: `ON CONFLICT DO NOTHING` também lida com **duplicata dentro do mesmo `INSERT`** — três linhas com dois `CÓD` distintos inserem duas, sem erro. A estratégia de um `INSERT` por lote com `.returning()` contado está correta mesmo se a entrada repetir.

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
export async function conferirCods(cods: unknown):
  Promise<{ ok: true; jaImportados: number[] } | { ok: false; erro: string }>
export async function gravarLoteAction(lote: unknown):
  Promise<{ ok: true; gravados: number } | { ok: false; erro: string }>
export async function desfazerAction():
  Promise<{ ok: true; apagados: number } | { ok: false; erro: string }>
```

As três devolvem o mesmo formato `{ ok }` para a tela tratar falha de um jeito só.

A Tarefa 11 usa.

- [ ] **Passo 1: escrever o teste de validação que falha**

O esquema Zod é o que protege o banco de um POST direto com tipo errado. Crie `validacao.test.ts` cobrindo: lote válido passa · lote acima de 500 é recusado · `codPlanilha` não inteiro é recusado · `mesFatura` fora do dia 1 é recusado · `qtdParcelas` nulo com `recorrente: false` é recusado · mensagens **em português** (o Zod responde em inglês por padrão).

- [ ] **Passo 2: rodar e ver falhar**

```bash
npx vitest run "src/app/(app)/importar/validacao.test.ts"
```

- [ ] **Passo 3: escrever o esquema**

Em `validacao.ts`, exporte **dois** schemas, com `message` em português em **cada** regra — o Zod responde em inglês por padrão, e um POST direto com tipo errado receberia a mensagem dele:

- **`loteSchema`** — array de `LancamentoDaPlanilha`, espelhando o tipo campo a campo.
- **`codsSchema`** — array de inteiros ≥ 1, também com `.max(TAMANHO_DO_LOTE)`. Sem esse teto, `conferirCods` aceitaria um `inArray` de tamanho arbitrário vindo de fora.

Esses schemas são a única coisa entre um POST forjado e o banco, então os tetos numéricos não são opcionais:

- `valorCentavos`: inteiro entre −2.147.483.647 e 2.147.483.647 (é `integer` no Postgres). O arquivo `src/app/(app)/lancamentos/novo/validacao.ts` já faz isso, com comentário — copie o limite de lá.
- `parcelaAtual` e `qtdParcelas`: inteiros até **32.767** (`smallint`).
- `codPlanilha`: inteiro ≥ 1.
- `mesFatura`: `regex` exigindo `AAAA-MM-01` — o dia 1 é regra do projeto e o `CHECK` do banco também cobra.
- o array: `.max(TAMANHO_DO_LOTE)`.

Atenção ao "siga o padrão": `novo/validacao.ts` exporta uma **função** que devolve erros por campo, porque serve a um formulário. Aqui não há formulário — exporte o schema e use `safeParse` direto.

- [ ] **Passo 4: escrever as três actions**

Em `actions.ts`, **`'use server'` no topo e `await exigirSessao()` na primeira linha de cada action** — inclusive na de conferir, que parece inofensiva mas revela quais `CÓD` existem no banco.

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { exigirSessao } from '@/auth/sessao'
import { obterDb } from '@/db/cliente'
import { codsJaImportados, desfazerImportacao, gravarLote, resolverCadastros } from '@/db/importacao'
import { codsSchema, loteSchema } from './validacao'

export async function conferirCods(cods: unknown) {
  await exigirSessao()
  const validado = codsSchema.safeParse(cods)
  if (!validado.success) return { ok: false as const, erro: validado.error.issues[0].message }
  const existentes = await codsJaImportados(obterDb(), validado.data)
  return { ok: true as const, jaImportados: [...existentes] }
}

export async function gravarLoteAction(lote: unknown) {
  await exigirSessao()
  const validado = loteSchema.safeParse(lote)
  if (!validado.success) {
    return { ok: false as const, erro: validado.error.issues[0].message }
  }
  try {
    const db = obterDb()
    const mapas = await resolverCadastros(
      db,
      validado.data.map((l) => l.pessoa),
      validado.data.map((l) => l.categoria),
    )
    const gravados = await gravarLote(db, validado.data, mapas)
    revalidatePath('/lancamentos')
    return { ok: true as const, gravados }
  } catch {
    // Sem try/catch, uma queda do Neon no lote 5 vira erro não tratado de Server Action
    // e a tela perde a leitura inteira. Assim ela consegue oferecer "tentar de novo".
    return { ok: false as const, erro: 'Não foi possível gravar este lote. Tente de novo.' }
  }
}

export async function desfazerAction() {
  await exigirSessao()
  try {
    const apagados = await desfazerImportacao(obterDb())
    revalidatePath('/lancamentos')
    return { ok: true as const, apagados }
  } catch {
    return { ok: false as const, erro: 'Não foi possível desfazer a importação.' }
  }
}
```

O `revalidatePath` não é enfeite: sem ele, `/lancamentos` continuaria mostrando o cache de rota depois de gravar 4.805 lançamentos. É o que `marcarRecebidos` já faz em `src/app/(app)/lancamentos/actions.ts`.

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
- **Quando um lote falhar** (a action devolve `{ ok: false, erro }`): parar o laço ali, mostrar o `erro` e quantos lotes entraram — "gravados 4 de 10" — e oferecer **retomar**, que refaz do lote 1. Retomar é seguro porque a gravação é idempotente: os lotes que já entraram são ignorados. Nunca continuar para o lote seguinte depois de uma falha.
- **Aviso antes de começar**, com este texto: *"Não feche nem saia desta página durante a importação. A planilha é lida no seu aparelho e não fica guardada em lugar nenhum — se você sair, vai precisar escolher o arquivo de novo."*
- Alvo de toque 44×44px; erro com `aria-invalid` e `aria-describedby`; `aria-live="polite"` na região do progresso.
- **Chip de situação: borda e texto da cor, sem preenchimento tingido.** Use `text-situacao-*` e `border-situacao-*`, nunca `bg-situacao-*` com o texto por cima. Medido na revisão da Tarefa 3: `bg-situacao-X/10` com `text-situacao-X` dá 4,41 a 4,63:1 no tema claro, e A ABATER e PERDOADO ficam **abaixo** do mínimo de 4,5 — em `/15` e `/20` os cinco reprovam. Os tokens foram calibrados contra fundo liso e não sobra folga para servirem de texto sobre tinta da mesma matiz. Sem tinta, o contraste é 5,05 a 5,29:1, e a borda casa com o minimalismo Swiss do `MASTER.md`, que já manda separar superfície por borda em vez de sombra.
- **`lista-do-mes.tsx` tem hoje um segundo vocabulário de cor que discorda dos tokens.** Lá ABATIDO é cinza neutro e PERDOADO é roxo vivo; nos tokens da Tarefa 3 é o contrário. Ao migrar a tela para os tokens, PERDOADO muda de roxo para quase-cinza — isso é intencional, porque PERDOADO é estado encerrado e não deve competir por atenção. Some também a necessidade dos `dark:` repetidos: os tokens se redefinem sozinhos no tema escuro.
- Estado vazio que ensina, não que reclama.
- Ícones `lucide-react`, nunca emoji.
- Para fatiar em lotes, importe `TAMANHO_DO_LOTE` de `src/importacao/lotes.ts` — **não** de `src/db/importacao.ts`, que arrastaria o Drizzle e o schema inteiro para o pacote do navegador.

- [ ] **Passo 3: desfazer importação**

Entrada discreta, **fora do caminho feliz** — no rodapé da etapa 4 ou num menu, nunca ao lado do botão de gravar. Ao tocar, uma confirmação **escrita**: o dono digita a palavra `APAGAR` para liberar o botão, que diz quantos lançamentos serão removidos. Chama `desfazerAction` e mostra o resultado.

É a mitigação do risco nº 1 da spec §15 e o que o critério de aceite 10 verifica. Sem essa tela, `desfazerImportacao` e `desfazerAction` existem e não têm como ser usados: um erro de tradução exigiria apagar o banco à mão.

- [ ] **Passo 4: a navegação**

Em `src/components/navegacao.tsx`, os itens com ícones `lucide-react`: lançamentos (`List`), lançar (`Plus`), importar (`Upload`). O `＋` de texto sai. Mantenha o `pb-[env(safe-area-inset-bottom)]`, que existe por causa da barra de gestos do iPhone.

**Três itens neste plano, não quatro.** O painel ("Início") só nasce no Plano A2: hoje `src/app/page.tsx` apenas redireciona para `/lancamentos`, e como `/` está **fora** do grupo `(app)`, a `Navegacao` nem é renderizada lá — um item "Início" ficaria com `aria-current` que nunca casa. O quarto item entra junto com o painel.

- [ ] **Passo 5: conferir no navegador**

```bash
npm run dev
```

Confira, com a janela estreita (375px) e larga: a barra inferior não cobre conteúdo · dá para percorrer tudo só com o teclado, com foco visível · tema claro e escuro · nenhuma rolagem horizontal. Sem a planilha real ainda — a Tarefa 12 faz isso.

- [ ] **Passo 6: commitar**

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
- avisos: espera-se **433** de arredondamento, **3** de valor zero, e **cerca de 4** de SUBTOTAL.

Sobre o último: se vierem dezenas ou centenas de avisos de SUBTOTAL, o problema é a **tolerância** da Tarefa 6, não a sua planilha — a fórmula do Excel calcula sobre o valor sem arredondar e diverge por centavos em toda linha de mais de duas casas. Nesse caso, pare, ajuste a tolerância e importe depois.

Se os números baterem, confirme.

- [ ] **Passo 3: conferir contra a planilha**

Abra `/lancamentos` no mês corrente e compare o total com o da aba GASTOS filtrada pelo mesmo `VENCIMENTO`. Anote se bateu ao centavo ou se a diferença é exatamente a soma dos arredondamentos daquele mês (critério de aceite 2).

- [ ] **Passo 4: testar o reenvio**

Envie o **mesmo arquivo** de novo. Esperado na etapa 2: **4.805 já importadas, 0 novas**. Confirme e verifique que a contagem de lançamentos no banco não mudou — é o critério de aceite 3.

- [ ] **Passo 5: testar o desfazer**

Antes de desfazer, crie **um lançamento manual** pela tela de lançar, para provar que ele sobrevive.

Use o desfazer importação e confirme: os 4.805 sumiram, o lançamento manual continua lá, e as pessoas e categorias continuam cadastradas (é o combinado da spec §6.7). Depois importe de novo e confira que os 4.805 voltaram. É o critério de aceite 10, e é a única vez que esse caminho é exercitado de ponta a ponta.

- [ ] **Passo 6: testar o "marcar recebido" contra o reenvio**

Marque um lançamento importado como recebido. Envie a planilha de novo. Confirme que ele **continua recebido** — a planilha traz `PAGO?` vazio para essa linha, e é o `DO NOTHING` que impede a sobrescrita. É o critério de aceite 4 e a razão de ser da decisão D1.

- [ ] **Passo 7: testar no celular**

```bash
npm run dev -- --hostname 0.0.0.0
```

Abra pelo IP do computador na mesma rede Wi-Fi. Percorra o assistente com uma mão só.

- [ ] **Passo 8: documentar**

O `ajudante` acrescenta ao `README.md`: como importar a planilha, o que cada etapa mostra, como desfazer, e o comando `--hostname 0.0.0.0` para testar no celular. Sem inventar comportamento: só descrever o que existe.

- [ ] **Passo 9: commitar**

```bash
git add README.md
git commit -m "docs: como importar a planilha e testar no celular"
```

---

## Depois deste plano

O Plano A2 (`docs/superpowers/plans/`, a escrever) traz R7, R10, `db/agregados.ts`, o painel com os quatro gráficos, e o sistema de design nas telas que já existem.

## Revisão

Cada tarefa é revisada pelo `cerebro` (Opus) antes da seguinte começar. Ao fim do plano, revisão final do branch, também pelo `cerebro`.
