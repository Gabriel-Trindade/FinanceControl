# Referência: planilha `USO_CARTÃO.xlsx`, aba GASTOS

> Documento **sem dados pessoais**. A planilha real nunca entra no repositório.
> Medido em 2026-09-14 com um script que só imprime contagens.

## Estrutura da `Tabela2` (intervalo `A1:N4806`)

Notação abreviada: `[@Coluna]` equivale a `Tabela2[[#This Row],[Coluna]]`.

| Coluna | Preenchimento | Fórmula / conteúdo |
|---|---|---|
| CÓD | manual | sequencial (1, 2, 3…) |
| VENCIMENTO | manual | data, **sempre no dia 5**: é só um marcador do mês da fatura |
| ANO | fórmula | `=YEAR(B2)` |
| MÊS | fórmula | `=UPPER(TEXT([@VENCIMENTO],"MMMM"))` |
| CATEGORIA | manual | texto |
| ITEM | manual | texto livre |
| VALOR | manual | número; negativo = crédito/estorno |
| PARCELA ATUAL | manual | número |
| QTD PARCELAS | manual | número, ou `∞` para gasto recorrente |
| SUBTOTAL | fórmula | `=IFERROR([@[QTD PARCELAS]]*[@VALOR],[@VALOR])` |
| RESTANTE | fórmula | `=IF(OR([@[QTD PARCELAS]]="∞",[@[PAGO?]]="SIM"),0,IF(AND(MONTH([@VENCIMENTO])=MONTH(TODAY()),YEAR([@VENCIMENTO])=YEAR(TODAY())),IFERROR([@SUBTOTAL]-([@[PARCELA ATUAL]]*[@VALOR]),[@VALOR]-[@SUBTOTAL]),0))` |
| ORIGEM | manual | pessoa que deve |
| PAGO? | manual | `SIM` ou vazio |
| SITUAÇÃO | fórmula | `=IF(M2="PERDOADO",M2,IF(G2<0,IF(M2<>"SIM","A ABATER","ABATIDO"),IF(M2<>"SIM","A RECEBER","RECEBIDO")))` |

## Perfil dos dados

| Medida | Resultado |
|---|---|
| Linhas | 4.805; CÓD de 1 a 4805, sem duplicados |
| Período | VENCIMENTO de abr/2018 a out/2026 (103 meses); 25 linhas já em out/2026 |
| Volume recente | ~20 a 40 linhas por mês (a fatura tem ~150: a planilha parece registrar só o que outras pessoas devem) |
| Dia do VENCIMENTO | dia 5 em 4.805 de 4.805 linhas |
| CATEGORIA / ORIGEM | 28 e 16 valores distintos, sem variações de grafia, nunca vazios |
| VALOR | 393 negativos, 3 zeros, 433 com mais de 2 casas decimais; mínimo −8.204,99, máximo 7.000,00 |
| PARCELA ATUAL | sempre número |
| QTD PARCELAS | 4.200 números e 605 `∞`; nunca ATUAL > QTD |
| PAGO? | `SIM` (4.777) ou vazio (28); nunca `NÃO` nem `PERDOADO` |
| SITUAÇÃO (valor em cache) | RECEBIDO 4.385 · ABATIDO 392 · A RECEBER 27 · A ABATER 1 |
| Fórmulas sobrescritas | SUBTOTAL digitado à mão em 4 linhas |
| Parcelas | 1 linha por parcela por mês: 1.387 de 1.392 pares de parcelas seguidas caem no mês seguinte |

## Outras abas (fora do escopo do Núcleo)
RESUMO (tabelas dinâmicas), RASCUNHO, CONTAS DO MÊS (`Tabela3` e `Tabela7`: contas pessoais pago/agendado/a pagar),
BASE, CÁLCULOS e Planilha1.
