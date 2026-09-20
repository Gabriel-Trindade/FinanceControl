# FinanceControl — A planilha é a porta de entrada · Design

| | |
|---|---|
| **Data** | 2026-09-16 |
| **Versão** | 2 — corrigida após revisão do Cérebro (7 achados bloqueantes, 16 não bloqueantes) |
| **Status** | Aguardando revisão do dono. **D12 precisa de confirmação explícita**: muda o modelo de dados |
| **Origem** | PRD [`2026-09-16-planilha-primeiro.md`](../../prd/2026-09-16-planilha-primeiro.md) |
| **Autoridade anterior** | Spec do Núcleo [`2026-09-14-nucleo-design.md`](2026-09-14-nucleo-design.md). Onde este documento calar, vale ela. §16 lista o que ele **substitui** |
| **Referências** | [`planilha-gastos.md`](../../referencias/planilha-gastos.md) · [`MASTER.md`](../../../design-system/financecontrol/MASTER.md) · [`AJUSTES-DO-PROJETO.md`](../../../design-system/financecontrol/AJUSTES-DO-PROJETO.md) · [`pendencias-plano-2.md`](../../pendencias-plano-2.md) |

## 1. Contexto

O Plano 1 do Núcleo entregou login, regras **R0–R6**, banco, lançamento manual e a lista do mês.
Funciona localmente contra o banco Neon real, com 143 testes verdes. A R7, a R8 e a R9 estão
especificadas na spec do Núcleo §7, mas **não foram implementadas**.

O dono corrigiu o rumo: a primeira tela não devia ser um formulário vazio. A intenção é abrir o app e
**ver os dados dele**, alimentando o sistema pelo **upload do `.xlsx`**.

Este documento resolve as seis perguntas do PRD §5 e desenha o que será construído.

## 2. Objetivo

Que o dono consiga, pelo celular:

1. enviar a planilha `USO_CARTÃO.xlsx` e ver o que o sistema entendeu **antes** de gravar;
2. abrir o app e cair num painel com os números dele, incluindo métricas que a planilha não dá;
3. usar tudo isso numa interface que parece produto, não formulário.

## 3. Decisões

| # | Pergunta | Decisão | Por quê |
|---|---|---|---|
| D1 | Importação: evento único ou rotina? | **Único, com reenvio aditivo.** Migra o histórico uma vez; reenviar depois só acrescenta o que o banco não tem | Preserva o "marcar recebido", que é a ação central do produto |
| D2 | Se rotina, o que vence? | **Nada vence.** Linha já importada é ignorada, sempre | Consequência de D1; elimina política de conflito por campo |
| D3 | Fonte da verdade? | **O app**, a partir da primeira importação | A spec do Núcleo §1 já dizia que o site substitui a aba GASTOS |
| D4 | Tela inicial? | **Painel**: totais do mês, gráficos e atalho para a lista. Busca no histórico fica para o Plano B | Uso principal é celular, em pé |
| D5 | Casos sujos? | Arredondar as 433 casas extras · ignorar e recalcular os 4 SUBTOTAL manuais · **importar os 3 zeros, sinalizando** | Não perder linha é mais importante que banco limpo |
| D6 | Tamanho e tempo? | **Ler no aparelho do dono**; gravar em lotes idempotentes de 500 | O `.xlsx` nunca toca o servidor (critério 5 do PRD) |
| D7 | Biblioteca de leitura | **`read-excel-file` 9.3.10** | Verificado: MIT, publicada em ago/2026, exports separados para navegador e Web Worker, erros tipados. O `xlsx` (SheetJS) no npm está congelado em 2022 com duas falhas graves sem correção; `exceljs` está parado desde dez/2024 e tem 21,8 MB |
| D8 | Biblioteca de gráficos | **Recharts 3.8**, via `npx shadcn add chart` | Verificado: as `peerDependencies` aceitam React 19, e o `ChartContainer` do shadcn gera variáveis de cor por tema |
| D9 | Fonte tipográfica | **IBM Plex Sans**, via `next/font/google` | Fecha a pendência do `AJUSTES-DO-PROJETO.md` §1. É fonte variável no Next 16.3.5 (eixos `wght` 100–700 e `wdth`), então `weight` pode ser omitido e vem um arquivo só |
| D10 | Produção na Vercel | **No Plano B** | Escolha do dono. A migração no banco `dev` vira ensaio: nenhum dado real corre risco enquanto o código muda |
| D11 | E se gravar dados errados? | **Desfazer importação**: apaga só `fonte = 'planilha'` | O `DO NOTHING` protege contra falha no meio, mas impede corrigir dado já gravado |
| **D12** | **Onde guardar o `CÓD`?** | **Coluna nova `cod_planilha`, única, anulável.** O `id` volta a ser só do banco | **Precisa de confirmação do dono.** Ver §3.1 |

### 3.1 D12 — por que o `CÓD` não pode ser o `id`

A spec do Núcleo §6.2 mandava gravar `CÓD → id`, e o schema foi feito para isso
(`generatedByDefaultAsIdentity`). A revisão mostrou que isso quebra, em dois momentos:

1. **Agora.** Os lançamentos manuais criados desde o Plano 1 consumiram os ids 1, 2, 3… A planilha traz
   `CÓD` de 1 a 4805. O `ON CONFLICT (id) DO NOTHING` **descartaria em silêncio** as primeiras linhas
   do histórico, contando-as como "repetidas". Perda de dado real, que é exatamente o que a tela de
   conferência existe para impedir.
2. **Para sempre.** Depois da migração a sequência fica em 4806. O próximo lançamento manual vira
   `id = 4806`; meses depois, as linhas novas da planilha também chegam com `CÓD 4806`. **O reenvio
   aditivo — a decisão D1 inteira — quebra no primeiro lançamento manual.**

A causa é uma chave com dois donos: `id` é a numeração do banco, `CÓD` é a do Excel, e são
independentes. Separá-las resolve os dois casos de uma vez:

- `lancamentos.cod_planilha integer NULL`, com índice único **simples**. Não precisa ser parcial: o
  Postgres trata cada `NULL` como distinto dos outros, então muitos lançamentos manuais sem `CÓD`
  convivem sem conflito. Um índice parcial, além de desnecessário, quebraria o `ON CONFLICT`, que só
  reconhece índice parcial se a cláusula `WHERE` dele for repetida — verificado contra o PGlite.
- `id` volta a ser gerado pelo banco, sempre.
- "Já importado" passa a ser testado por `cod_planilha`, e a idempotência vira
  `ON CONFLICT (cod_planilha) DO NOTHING` — a definição exata de D2 em SQL.
- **O `setval` deixa de ser necessário**, e com ele some o passo mais frágil da gravação.

Custo: uma migração Drizzle. Se o dono preferir manter `CÓD → id`, o reenvio aditivo (D1) precisa ser
abandonado e a importação vira estritamente única.

## 4. Escopo

### 4.1 Dentro

- Migração de banco: coluna `cod_planilha` (D12).
- Correção da normalização NFC, **incluindo as linhas já gravadas** (`pendencias-plano-2.md` §1).
- Tokens de cor de situação e de gráfico em `globals.css` (§9.1) — antes de qualquer tela.
- Leitura do `.xlsx` no navegador, tradução pura, tela de conferência, gravação em lotes, desfazer.
- **R7 — Resumo por pessoa** (especificada no Núcleo §7, nunca implementada).
- **R10 — Projeção de compromissos** (nova).
- Consultas de agregação para os gráficos.
- Painel como tela inicial, com os quatro conjuntos de gráficos que o dono pediu.
- Sistema de design aplicado a todas as telas, novas e existentes.
- `error.tsx` e `global-error.tsx` em português (`pendencias-plano-2.md` §2).

### 4.2 Fora (Plano B)

Produção na Vercel (D10) · tela "Quem me deve" própria · extrato pesquisável com lista virtualizada ·
edição e exclusão · filtros na URL · R8 · R9 · Cadastros · CSV · PWA · importação de fatura PDF ·
pendências §3 a §7 de `pendencias-plano-2.md`.

A planilha original nunca é modificada nem devolvida.

## 5. Arquitetura

Módulos novos em **negrito**.

| Caminho | Responsabilidade |
|---|---|
| **`src/domain/planilha.ts`** | Traduz `Celula[][]` em lançamentos, problemas e avisos. Função pura |
| **`src/domain/resumo-por-pessoa.ts`** | R7 |
| **`src/domain/projecao.ts`** | R10 |
| **`src/importacao/ler-xlsx.ts`** | Casca sobre `read-excel-file`: arquivo → `Celula[][]`. Roda no navegador |
| **`src/db/importacao.ts`** | Quais `cod_planilha` já existem · gravar lote · desfazer |
| **`src/db/agregados.ts`** | Agregações para os gráficos (§8.2) |
| **`src/app/(app)/importar/`** | Assistente de importação, quatro etapas |
| **`src/app/(app)/page.tsx`** | O painel. **`src/app/page.tsx` é apagado** — ver abaixo |
| **`src/components/graficos/`** | Componentes de cliente que desenham os gráficos |
| `src/db/cadastros.ts` | **corrigido**: `normalizarNome` aplica NFC |
| `src/db/schema.ts` | **alterado**: coluna `cod_planilha` (D12) |

**Rota `/`.** Hoje `src/app/page.tsx` redireciona para `/lancamentos`. Grupo de rota não cria segmento
de URL, então `src/app/page.tsx` e `src/app/(app)/page.tsx` resolveriam os dois para `/` e o build
quebraria. O arquivo antigo **é apagado**; o painel nasce dentro de `(app)`, herdando `Navegacao` e
`exigirSessao()` do layout.

### 5.1 A separação que sustenta os testes

- **`ler-xlsx.ts`** conhece `read-excel-file`, ZIP e XML. Não conhece regra nenhuma. É quem valida o
  cabeçalho (§6.1), porque é quem sabe o que é "linha 1 da aba".
- **`planilha.ts`** recebe `Celula[][]` e devolve lançamentos, problemas e avisos. Não conhece arquivo,
  banco nem tela.

O contrato entre os dois é um tipo **do projeto**, não da biblioteca:

```ts
export type Celula = string | number | boolean | Date | null
export function traduzirPlanilha(linhas: Celula[][]): ResultadoDaTraducao
```

A biblioteca devolve valores tipados, não texto. Forçar tudo para `string` obrigaria a reparsear:
`VALOR` viraria `"1234.56"`, com ponto decimal, que `paraCentavos` recusa de propósito
(`src/domain/dinheiro.ts`), e a data viraria texto dependente de fuso.

Os testes escrevem a matriz à mão, com `∞`, valor de três casas, zero e `PAGO?` vazio. **Nenhum `.xlsx`
entra no repositório.**

### 5.2 Bibliotecas novas

| Pacote | Onde | Observação |
|---|---|---|
| `read-excel-file` | cliente, via `import()` dinâmico | Importar de **`read-excel-file/browser`**: o pacote não tem export padrão, só `./browser`, `./node`, `./web-worker` e `./universal`. O `import()` é dinâmico para a biblioteca só viajar até o navegador nesta tela. O build `/browser` **já usa Web Worker por dentro** ao ler o arquivo, então as 4.805 linhas não travam a interface — `/web-worker` é o caminho que **não** gera worker, e não serve aqui |
| `recharts` | cliente | Entra com `npx shadcn add chart`, que também cria `src/components/ui/chart.tsx` |

## 6. Importação da planilha

### 6.1 Validação do cabeçalho

Antes de ler qualquer linha, conferir que a primeira linha da aba **GASTOS** tem exatamente as 14
colunas de `planilha-gastos.md`, na ordem. Se não tiver, parar dizendo qual coluna faltou ou sobrou.
Nunca adivinhar.

A aba é lida por nome: `readSheet(arquivo, 'GASTOS')`. A biblioteca lança erros já tipados —
`SheetNotFoundError`, `InvalidSpreadsheetError`, `InvalidInputError` — que a §10 mapeia para mensagens
em português.

### 6.2 Mapa de tradução

| Coluna | Campo | Regra |
|---|---|---|
| CÓD | `cod_planilha` | inteiro ≥ 1; repetido dentro do arquivo é problema |
| VENCIMENTO | `mes_fatura` | `Date` → `AAAA-MM-01` lendo **`getUTCFullYear` e `getUTCMonth`**. Nunca `toISOString()` sobre data local: o dia 5 poderia cair no mês anterior |
| ANO, MÊS | — | **ignorados** (fórmula) |
| CATEGORIA | `categoria_id` | normalizado (NFC + `trim` + colapso de espaços, igual a `normalizarNome`) |
| ITEM | `item` | `.normalize('NFC')` + `trim`; vazio é problema. O NFC alinha o item com pessoa e categoria, que já normalizam — e a R10 (§8.1) agrupa séries por item, onde "Café" em duas formas Unicode não agruparia |
| VALOR | `valor_centavos` | ver 6.3 |
| PARCELA ATUAL | `parcela_atual` | inteiro; `0` é corrigido para `1` com aviso; ausente ou não numérico é problema |
| QTD PARCELAS | `qtd_parcelas` / `recorrente` | `∞` → `recorrente = true`, `qtd_parcelas = null`; número → `recorrente = false`; **vazio ou não numérico é problema** |
| SUBTOTAL | — | **ignorado**; R4 recalcula. Usado só para o aviso (6.4) |
| RESTANTE | — | **ignorado**; R6 recalcula |
| ORIGEM | `pessoa_id` | normalizado como CATEGORIA |
| PAGO? | `pagamento` | `SIM` → `SIM`; vazio → `NAO`; `PERDOADO` → `PERDOADO`; outra coisa é problema |
| SITUAÇÃO | — | **ignorado**; R5 recalcula |
| — | `id` | **gerado pelo banco** (D12) |
| — | `pago_em` | sempre `null`. O `CHECK` permite `pagamento = 'SIM'` sem `pago_em` |
| — | `fonte` | sempre `'planilha'` |
| — | `data_compra` | sempre `null`. A planilha não tem essa informação |

### 6.3 Valor em centavos, sem erro de ponto flutuante

Converter o valor direto do `number` é uma armadilha: `1.005 × 100` vale `100.49999999999999` em ponto
flutuante, então `-1,005` arredondaria para `-100` em vez de `-101`. Com 433 valores de mais de duas
casas e 393 negativos, é um erro que aconteceria de verdade.

`valorParaCentavos` aceita **`string | number`** e trata os dois:

- **Texto** (o número como está escrito no arquivo): conversão decimal pura — separar sinal, parte
  inteira e parte decimal; completar ou arredondar a decimal para dois dígitos, **meio para longe do
  zero**; montar o inteiro. Sem passar por ponto flutuante em momento algum.
- **Número:** limpar o ruído binário antes de arredondar, com
  `Math.round(Number((Math.abs(v) * 100).toFixed(6)))`, e aplicar o sinal depois.

Aceitar os dois formatos é deliberado. O `read-excel-file` tem a opção `parseNumber`, que entregaria
toda célula numérica como texto — o caminho mais exato. Mas ela vale para **todas** as células
numéricas, e no formato XLSX uma data é um número com formato de data: não está verificado se a
detecção de datas sobrevive a um `parseNumber` próprio. O tradutor funcionar nos dois formatos tira
essa incerteza do caminho crítico. Se uma medição futura mostrar que `parseNumber` é seguro, é só
ligá-lo no leitor — o tradutor não muda.

O sinal é aplicado como `v < 0 ? -c : c`, nunca com `Math.sign`, que devolve `-0` e faz
`expect(-0).toBe(0)` falhar no Vitest.

Casos que os testes fixam, nos dois formatos: `-0,125 → -13` · `-1,005 → -101` · `1,005 → 101` ·
`0 → 0` sem `-0` · `1234,56 → 123456`.

### 6.4 Problemas e avisos

**Problema** — a linha não entra; a conferência mostra número da linha e motivo:

`CÓD` ausente, não numérico, ≤ 0 ou repetido no arquivo · `VENCIMENTO` ausente ou não é data ·
`ITEM` vazio · `VALOR` ausente ou não numérico · `CATEGORIA` ou `ORIGEM` vazias ·
`PARCELA ATUAL` ausente, não numérica ou negativa · `QTD PARCELAS` vazia ou não numérica (nem número
nem `∞`) · `QTD PARCELAS` < `PARCELA ATUAL` · `PARCELA ATUAL` ou `QTD PARCELAS` acima de 32.767 ·
`PAGO?` fora de `SIM` / vazio / `PERDOADO`.

Os três últimos existem porque violariam `lancamentos_parcelas_coerentes` ou o `smallint` do schema, e
uma linha assim **derrubaria o lote inteiro**, não só a si mesma.

**Aviso** — a linha entra, e o relatório lista: valor com mais de duas casas (arredondado) · valor zero
· `PARCELA ATUAL = 0` corrigido para 1 · `SUBTOTAL` lido diferente do que a R4 calcula (uma das 4
fórmulas sobrescritas).

Não há aviso de `SITUAÇÃO` divergente: como `PAGO?` e o sinal do valor são importados fielmente, a R5
recalculada só divergiria do cache em casos de `PERDOADO`, que a referência confirma não existirem.

### 6.5 Assistente de importação

1. **Escolher o arquivo.**
2. **Conferir** — "li 4.805 linhas · 4.802 novas · 0 já importadas · 3 com problema", a lista dos
   problemas com número da linha e motivo, e a lista dos avisos. Saber o que já foi importado é uma
   consulta que devolve só `cod_planilha`, nunca as linhas.
3. **Gravar** — progresso por lote ("lote 4 de 10").
4. **Relatório** — o que entrou, o que foi arredondado, o que foi ignorado, e o atalho para o painel.

**Nada é gravado antes da etapa 3.** Desistir na etapa 2 não deixa rastro.

### 6.6 Gravação

1. **Cadastros.** Resolver os nomes distintos de pessoa e categoria — cerca de 44 no total — **uma vez
   cada**, devolvendo um mapa `nome normalizado → id`. `obterOuCriarPessoa` faz 1 a 2 consultas por
   nome; chamá-la dentro do laço das 4.805 linhas seriam ~9.600 idas ao banco.
2. **Lançamentos em lotes de 500**, cada um um `INSERT ... ON CONFLICT (cod_planilha) DO NOTHING`, com
   os ids do mapa do passo 1.

Não há passo 3: com D12, o `id` é gerado pelo banco e não há sequência para ajustar.

**Por que 500.** O `INSERT` grava 13 colunas por linha (`criado_em` e `atualizado_em` têm `default`).
O Postgres aceita 65.535 parâmetros por consulta, então o teto é 5.041 linhas — as 4.805 caberiam num
`INSERT` só, mas sem progresso visível e sem margem para a planilha crescer. 500 dá 6.500 parâmetros,
folga larga e dez passos de progresso.

**Por que idempotente.** O driver HTTP do Neon não tem transação interativa: se o lote 5 falhar, o banco
fica pela metade. Com `DO NOTHING`, reenviar a planilha inteira refaz só o que falta. O mesmo mecanismo
implementa D2.

Cada lote sai numa Server Action. 500 lançamentos em JSON dão cerca de 100 KB, contra o limite padrão
de 1 MB de corpo de Server Action — confirmado na documentação do Next instalada. Não é preciso criar
Route Handler.

### 6.7 Desfazer importação

`DELETE FROM lancamentos WHERE fonte = 'planilha'`, atrás de confirmação escrita. Não toca em `manual`,
`virada` nem `fatura`. Pessoas e categorias criadas pela importação continuam: são inofensivas e podem
ter recebido lançamentos manuais.

### 6.8 Pré-requisito: normalização NFC

`normalizarNome` (`src/db/cadastros.ts`) faz `trim` e colapso de espaços, mas não normaliza a forma
Unicode. `compararNomes` (`src/domain/texto.ts`) usa `Intl.Collator`, que **normaliza** — então ele
considera NFC e NFD iguais, enquanto o índice `pessoas_nome_unico`, que compara bytes, não. É esse
descompasso que faz "José" virar duas pessoas.

Duas correções, no mesmo commit:

1. `.normalize('NFC')` dentro de `normalizarNome`, com teste que compare as duas formas.
2. `UPDATE pessoas SET nome = normalize(nome, NFC)` e o mesmo para `categorias`, numa migração. Sem
   isso, uma linha já gravada em NFD não seria encontrada pela busca, o `INSERT` passaria pelo índice
   (bytes diferentes) e a segunda pessoa nasceria assim mesmo.

A normalização da §6.2 é **a mesma função**, para não existirem duas regras.

## 7. R7 — Resumo por pessoa

Já especificada na spec do Núcleo §7; falta implementar, em `src/domain/resumo-por-pessoa.ts`.
Considera só `pagamento = 'NAO'`: `aReceber`, `aAbater` (negativo), `saldo = aReceber + aAbater`,
`restante` (soma do R6 com a data de hoje) e `itensEmAberto`. Aparecem as pessoas com `saldo ≠ 0` ou
`restante ≠ 0`, por saldo decrescente.

## 8. R10 — Projeção de compromissos

Função pura em `src/domain/projecao.ts`.

```
projetarCompromissos(lancamentosEmAberto, mesInicial, quantidadeDeMeses) → { mes, centavos }[]
```

Não recebe `hoje`: `mesInicial` ocupa esse lugar, e quem chama passa o mês seguinte ao corrente — a
projeção é sobre o **futuro**, e o mês corrente já aparece nos totais logo acima no painel.

Saída: sempre `quantidadeDeMeses` entradas, em ordem, com `mes` no formato `AAAA-MM-01` (R2) e `0` nos
meses sem nada, porque um gráfico de barras precisa de todas as colunas. Valores negativos entram na
soma e podem produzir barra negativa. Janela fixa em **6 meses**.

Considera só `pagamento = 'NAO'`. Para cada mês da janela soma o que já existe no banco naquele mês,
mais as parcelas ainda não criadas.

### 8.1 Chave da série

Pessoa, categoria, item (sem diferenciar maiúsculas, aplicando `toLocaleLowerCase('pt-BR')` sobre o
nome já em NFC, com acento diferenciando), valor, `qtd_parcelas` e `recorrente`.

**`parcela_atual` não entra na chave, e o mês não entra.** Isto **não** é a chave da R9: a da R9 inclui
`parcela_atual` e é avaliada dentro do mês M+1, porque serve para não duplicar, não para agrupar.

### 8.2 Corridas

Dentro de cada chave, ordenar por mês e **cortar a série a cada salto de mês ou queda de
`parcela_atual`**. Cada pedaço é uma *corrida*, projetada separadamente, com `M` = último mês daquela
corrida e `P` = maior `parcela_atual` dela.

- **Corrida parcelada:** as parcelas `P+1` até `qtd_parcelas` caem em `M+1`, `M+2`, …, com o mesmo valor.
- **Corrida recorrente:** o valor se repete de `M+1` até o fim da janela, **desde que `M` não seja
  anterior a `mesInicial` por mais de 12 meses** — um recorrente esquecido em aberto desde 2019 não
  deve entrar na projeção de 2026.

As corridas existem por causa de dois casos que uma série única não resolve: duas compras iguais em
paralelo (mesma pessoa, item, valor e `qtd`, começando em meses diferentes) seriam projetadas uma só
vez, e a mesma chave reaparecendo em meses não consecutivos deixaria `M` ambíguo.

Partir do **maior** `parcela_atual` de cada corrida é o que evita contar duas vezes uma parcela que a
R9 já tenha criado.

## 9. Painel

### 9.1 Cor: o que existe e o que falta

`globals.css` hoje tem `--chart-1` a `--chart-5` como `oklch(L 0 0)` — **croma zero, cinco cinzas**, nos
dois temas. O único token com cor é `--destructive`. Não existe token para A RECEBER, RECEBIDO,
A ABATER, ABATIDO ou PERDOADO, que a spec do Núcleo §8 exige como chips coloridos.

**Entregável, antes de qualquer tela:** uma tabela de tokens em `globals.css`, em `oklch`, cobrindo as
cinco situações e as séries de gráfico, nos temas claro e escuro, com contraste **medido**. Sem isso o
critério de aceite 11 não é verificável e cada tela inventaria a própria cor.

Duas réguas diferentes, e confundi-las tem consequência:

- **`--situacao-*`: 4,5:1.** São texto, e caem na WCAG 1.4.3.
- **`--chart-*`: 3:1.** São preenchimento, e caem na WCAG **1.4.11** (componente não textual). Exigir
  4,5:1 aqui espreme as cinco cores numa faixa estreita de luminosidade — foi o que produziu colisão
  sob daltonismo na primeira tentativa.

**Distinguibilidade sob daltonismo** se testa com simulação de **protanopia e deuteranopia** (cerca de
8% dos homens), pelas matrizes de Machado et al. 2009. **Não** use `filter: grayscale(1)`: aquilo
simula acromatopsia, que atinge 1 em 30.000 pessoas, e quem tem protanopia **enxerga luminância
normalmente** — degrau de brilho não resolve nada para essas pessoas.

Mesmo com a paleta otimizada, nenhum par de séries chega a 3:1 de luminância **entre si** — medido:
de 1,03:1 a 3,02:1. Isso tem consequência formal: a **WCAG 1.4.11 também exige 3:1 entre objetos
gráficos adjacentes**, então duas séries que se tocam (barra empilhada, fatias vizinhas de rosca) não
cumprem o critério só pela cor. Os gráficos do Plano A2 precisam entregar o segundo sinal — hachura por
série, ou um traço separador entre áreas adjacentes. **Sem isso o gráfico reprova**, por mais bem
escolhida que a paleta esteja.

Aviso para quem mexer nos tokens depois: `--chart-3` no tema claro está **na borda do gamute sRGB**
(canal azul linear em 0,00003). Qualquer ajuste que aumente o croma ou baixe a luminosidade o joga
para fora, o navegador faz mapeamento de gamute por conta própria, e todos os números medidos deixam
de valer.

**O chip de situação não leva preenchimento tingido.** Borda e texto na cor, fundo do cartão por baixo.
Medido: `bg-situacao-X/10` com `text-situacao-X` dá 4,41 a 4,63:1 no tema claro, e dois dos cinco ficam
abaixo do mínimo; sem tinta, dá 5,05 a 5,29:1. Os tokens são calibrados contra fundo liso e não sobra
folga para servirem de texto sobre tinta da mesma matiz.

### 9.2 Ordem da tela

Celular, de cima para baixo: cabeçalho do mês com navegação · três totais · cartão do compromisso
futuro · quem me deve (R7) · evolução dos últimos 12 meses · por categoria · custo fixo e saúde da
cobrança · atalho para a lista do mês. No computador, o mesmo em duas colunas. Nunca rolagem
horizontal.

Navegação com quatro itens e ícones `lucide-react`: início, lançamentos, lançar, importar. O `＋` de
texto sai.

### 9.3 Onde cada número é calculado

Regra: **as regras de negócio existem só em `src/domain`**. O SQL agrega por dimensões cruas; nunca
reimplementa regra.

| Gráfico | SQL | `src/domain` |
|---|---|---|
| Evolução mensal | `SUM(valor_centavos) GROUP BY mes_fatura`, últimos 12 meses | — |
| Por categoria | `SUM ... GROUP BY categoria_id`, **últimos 12 meses** | — |
| Quem me deve | lançamentos em aberto | R5, R6, R7 |
| Compromisso futuro | lançamentos em aberto | R10 |
| Custo fixo | `SUM ... GROUP BY recorrente, (qtd_parcelas > 1)` | rótulo das três fatias |
| Saúde da cobrança | `SUM ... GROUP BY mes_fatura, pagamento, (valor_centavos < 0)` | `calcularSituacao` uma vez por grupo |

As duas últimas linhas são o ponto delicado. "Recorrente / parcelado / avulso" e "recebido vs a
receber" **são** regra (R5 e a mesma condição de `descreverParcela`). Escrevê-las como `CASE WHEN` no
SQL duplicaria a R5; carregar as 4.805 linhas contrariaria o princípio. A saída é o SQL agrupar por
colunas cruas — `pagamento` e o sinal do valor — e o `domain` rodar `calcularSituacao` uma vez por
grupo: no máximo 103 × 3 × 2 grupos, e nenhuma regra desce para o banco.

O que exige regra linha a linha opera sobre lançamentos em aberto: **28 nos dados reais** (`PAGO?`
vazio em 28 de 4.805).

Os componentes Recharts são de cliente e recebem números prontos por props. **Nenhuma conta acontece no
navegador.**

### 9.4 Os quatro gráficos, em ordem de prioridade

1. **Compromisso futuro** — barras dos próximos 6 meses (R10).
2. **Evolução mensal** — barras dos últimos 12 meses, mês corrente destacado, com a variação contra o
   mês anterior em texto.
3. **Quem me deve e por categoria** — barras horizontais; crédito em cor distinta.
4. **Custo fixo e saúde da cobrança** — recorrente / parcelado / avulso, e recebido vs a receber ao
   longo do tempo.

Se faltar tempo, corta-se de baixo para cima.

### 9.5 Estado vazio

Banco sem lançamentos: o painel não diz "vazio". Mostra o convite para enviar a planilha, com o botão
para a tela de importação, e a alternativa de lançar à mão.

## 10. Interface

| Item | Decisão |
|---|---|
| Estilo | Minimalismo / Swiss; densidade alta; movimento 2/10 com `prefers-reduced-motion` |
| Tipografia | IBM Plex Sans (D9), pesos explícitos, `tabular-nums` em **todo** valor monetário |
| Cor | Tokens de §9.1, mapeados por papel. Tema claro e escuro seguindo o sistema |
| Superfícies | Borda de 1px e luminosidade; sombra só em elemento flutuante |
| Alvo de toque | **44×44px** com 8px de folga. Os campos de hoje têm 32px |
| Listas | Cartão no celular, tabela no computador |
| Ícones | `lucide-react`, nunca emoji nem caractere de texto |
| Acessibilidade | `aria-invalid` e `aria-describedby` em campo com erro; foco visível; contraste 4.5:1 |

## 11. Erros e casos-limite

| Situação | Comportamento |
|---|---|
| Arquivo que não é `.xlsx` | `InvalidInputError` → recusa antes de ler, em português |
| Aba GASTOS ausente | `SheetNotFoundError` → recusa dizendo qual aba era esperada |
| Arquivo corrompido ou com senha | `InvalidSpreadsheetError` → recusa com mensagem clara. Senha de arquivo não é tratada neste sub-projeto |
| Cabeçalho diferente | Recusa dizendo qual coluna faltou ou sobrou (6.1) |
| Banco indisponível durante a gravação | A tela informa o último lote concluído e oferece "tentar de novo", seguro por ser idempotente |
| Banco fora do ar em qualquer tela | `error.tsx` e `global-error.tsx` em português |
| Sessão expirada no meio da gravação | `exigirSessao()` redireciona para `/login`. A matriz só existe na memória do navegador, então o dono precisa reescolher o arquivo ao voltar — nada corrompe, mas a tela avisa disso antes de começar |

## 12. Segurança e privacidade

- `exigirSessao()` na primeira linha de toda Server Action e Route Handler protegido.
- O `.xlsx` é lido no aparelho do dono e **nunca** sobe para o servidor, nem temporariamente.
- Nada de dado real versionado: `.env*`, `*.xlsx`, `*.csv` e `*.pdf` seguem no `.gitignore`.
- Testes usam matrizes fictícias escritas no próprio teste.

## 13. Testes e verificação

`npm test && npm run lint && npm run typecheck && npm run build`.

O CI precisa passar a rodar `npm run build` (`pendencias-plano-2.md` §5), senão o critério 11 é falso.

| Módulo | O que os testes cobrem |
|---|---|
| `domain/planilha.ts` | cada coluna de 6.2 · `∞` · `PAGO?` vazio · **valores fixos do arredondamento**: `-0,125 → -13`, `-1,005 → -101`, `0 → 0` sem `-0` · `CÓD` repetido · cada problema e cada aviso de 6.4 · data lida em UTC |
| `importacao/ler-xlsx.ts` | as quatro recusas da §11, uma a uma |
| `domain/resumo-por-pessoa.ts` | R7: saldo, crédito, restante, ordenação, filtro de saldo e restante zerados |
| `domain/projecao.ts` | parcela no meio · última parcela · recorrente · virada de ano · duas corridas paralelas (não pode contar de menos) · mesma chave em meses não consecutivos · recorrente velho demais (fica de fora) · valor negativo · mês vazio devolve 0 · série com R9 já aplicada (não pode contar duas vezes) |
| `db/cadastros.ts` | mesmo nome em NFC e NFD resolve para **uma** pessoa; migração de normalização |
| `db/importacao.ts` | lote idempotente (duas vezes não duplica) · `cod_planilha` não colide com lançamento manual · retomada depois de lote falhar · consulta de "o que já existe" · **gravação usa `fonte = 'planilha'`** · desfazer apaga só isso |
| `db/agregados.ts` | cada agregação de 9.3 contra dados PGlite conhecidos |

Testes de banco afirmam o **nome da restrição** (`cause.constraint`), não `.rejects.toThrow()` genérico.

Verificação manual, com a planilha real fora do repositório: enviar, conferir a contagem, comparar os
totais do mês corrente com os da planilha.

Para testar no celular sem produção: `npm run dev -- --hostname 0.0.0.0` e abrir pelo IP do computador
na mesma rede. Vai para o README.

## 14. Critérios de aceite

1. Enviar a planilha real e ver, **antes de gravar**, quantas linhas entram, quantas já foram
   importadas e quantas têm problema, com o motivo de cada uma.
2. Depois de confirmar, os totais do mês corrente batem com os da planilha, **com as diferenças de
   arredondamento listadas no relatório** — se nenhuma linha arredondada cair no mês corrente, batem ao
   centavo.
3. Reenviar a mesma planilha não cria nenhuma linha nova e não altera nenhuma existente.
4. Um lançamento marcado como recebido no app continua recebido depois de um reenvio.
5. Um lançamento manual criado depois da migração não impede um reenvio futuro (D12).
6. Abrir o app e cair no painel, sem passar por formulário.
7. Lançar à mão continua possível em no máximo dois toques a partir do painel.
8. O compromisso futuro confere com a conta feita à mão para uma série escolhida.
9. Nenhum arquivo do dono fica no servidor.
10. Desfazer importação remove só o que veio da planilha.
11. Todas as telas passam no checklist do sistema de design: contraste, alvo de toque, foco visível,
    tema claro e escuro, movimento reduzido.
12. `npm test`, `lint`, `typecheck` e `build` verdes; CI verde, **rodando `build`**.

## 15. Riscos

| Risco | Mitigação |
|---|---|
| Tradução com erro grava 4.805 linhas erradas | Desfazer importação (6.7) e conferência obrigatória |
| `CÓD` colidindo com `id` de lançamento manual | D12: `cod_planilha` separada |
| Nomes em formas Unicode diferentes viram duas pessoas | NFC na função e nas linhas já gravadas (6.8) |
| Erro de ponto flutuante no valor | Texto bruto via `parseNumber`, conversão decimal (6.3) |
| Dupla contagem ou contagem a menos na projeção | Corridas (8.2), com teste para cada caso |
| Linha inválida derrubando o lote inteiro | A lista de problemas (6.4) cobre tudo que viola `CHECK` ou `smallint` |
| Biblioteca de leitura pesando no pacote | `import()` dinâmico só na tela de importação |
| Leitura travando a interface no celular | Resolvido pela própria biblioteca: o build `/browser` lê o arquivo dentro de um Web Worker |
| Cor inventada por tela | Tokens fixados antes de qualquer tela (9.1) |
| Migração feita duas vezes (dev e produção) | Consequência aceita de D10; a primeira é ensaio e o procedimento é idempotente |

## 16. O que este documento substitui na spec do Núcleo

| Spec do Núcleo | Substituição | Onde |
|---|---|---|
| §6.2: `id` recebe o `CÓD` da planilha | `cod_planilha` separada; `id` sempre gerado | D12 |
| §12: migração por `scripts/migrar-planilha.ts` rodado localmente | Upload no navegador, dentro do app | D6 |
| §8: navegação "Início · Lançamentos · ＋ Lançar · Cadastros" | "Início · Lançamentos · Lançar · Importar"; Cadastros vai para o Plano B | §9.2 |

A numeração **R10** é a próxima livre: o Núcleo vai de R0 a R9.

## 17. Entrega

O Plano A foi quebrado em dois: juntos, passavam de vinte tarefas, e a §9.4 já admitia corte por tempo.

| Plano | Nome | Conteúdo | Resultado |
|---|---|---|---|
| **A1** | A planilha entra | NFC (função e dados) · migração `cod_planilha` · tokens de cor, fonte e `error.tsx` · tradutor puro com TDD · leitor · assistente de 4 etapas · gravação em lotes · desfazer · migração real no banco `dev` | O dono abre o app e vê os dados dele. Já cumpre o objetivo do PRD |
| **A2** | O painel | R7 · R10 · `db/agregados.ts` · painel com os quatro gráficos · sistema de design nas telas que já existem | O app fica melhor que o Excel |
| **B** | Núcleo completo | Produção na Vercel (D10) · Quem me deve · extrato pesquisável · edição e exclusão · filtros na URL · R8 · R9 · Cadastros · CSV · PWA · pendências restantes |

O Plano A1 é escrito logo em seguida, com a skill `writing-plans`.
