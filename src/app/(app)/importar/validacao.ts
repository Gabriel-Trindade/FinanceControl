import { z } from 'zod'
// De @/importacao/lotes, não de @/db/importacao: esse módulo arrastaria o Drizzle e o
// schema inteiro para o pacote do cliente quando a tela de importação (Tarefa 11)
// importar TAMANHO_DO_LOTE para fatiar o arquivo antes de mandar cada lote pra cá.
import { TAMANHO_DO_LOTE } from '@/importacao/lotes'

// Limite do `integer` do Postgres (2^31 - 1). valorCentavos é `integer` no schema; o
// mesmo teto de src/app/(app)/lancamentos/novo/validacao.ts (CENTAVOS_MAXIMOS), copiado
// aqui para não acoplar os dois formulários por import.
const CENTAVOS_MAXIMOS = 2_147_483_647

// Limite do `smallint` do Postgres. parcela_atual e qtd_parcelas usam esse tipo de coluna.
const SMALLINT_MAXIMO = 32_767

/**
 * As duas únicas barreiras entre um POST forjado (qualquer um pode chamar uma Server
 * Action direto, sem passar pela tela) e um INSERT que estoura um limite do banco e
 * derruba o lote inteiro de 500, com uma mensagem que não diz qual linha causou. Por
 * isso todo teto numérico aqui é obrigatório, não estético — e toda mensagem é escrita
 * em português: o zod responde em inglês por padrão, e um POST com tipo errado
 * receberia a mensagem dele em vez desta.
 */

/** Espelha LancamentoDaPlanilha (src/domain/planilha.ts) campo a campo. */
const lancamentoSchema = z
  .object({
    codPlanilha: z
      .number('CÓD deve ser um número')
      .int('CÓD deve ser um número inteiro')
      .min(1, 'CÓD deve ser no mínimo 1'),
    mesFatura: z
      .string('Mês da fatura deve ser texto')
      .regex(/^\d{4}-\d{2}-01$/, 'Mês da fatura deve estar no formato AAAA-MM-01'),
    pessoa: z.string('Pessoa deve ser texto').trim().min(1, 'Informe a pessoa'),
    categoria: z.string('Categoria deve ser texto').trim().min(1, 'Informe a categoria'),
    item: z.string('Item deve ser texto').trim().min(1, 'Informe o item'),
    valorCentavos: z
      .number('Valor deve ser um número')
      .int('Valor deve ser um número inteiro de centavos')
      .min(-CENTAVOS_MAXIMOS, 'Valor abaixo do limite de -R$ 21.474.836,47')
      .max(CENTAVOS_MAXIMOS, 'Valor acima do limite de R$ 21.474.836,47'),
    // O CHECK lancamentos_parcela_atual_positiva (src/db/schema.ts) já exige >= 1; sem
    // este .min aqui, um POST com 0 ou negativo passaria pelo zod e só estouraria lá,
    // derrubando o lote inteiro em vez de recusar só esta linha antes de gravar.
    parcelaAtual: z
      .number('Parcela atual deve ser um número')
      .int('Parcela atual deve ser um número inteiro')
      .min(1, 'Parcela atual deve ser no mínimo 1')
      .max(SMALLINT_MAXIMO, `Parcela atual acima do limite de ${SMALLINT_MAXIMO}`),
    qtdParcelas: z
      .number('Quantidade de parcelas deve ser um número')
      .int('Quantidade de parcelas deve ser um número inteiro')
      .max(SMALLINT_MAXIMO, `Quantidade de parcelas acima do limite de ${SMALLINT_MAXIMO}`)
      .nullable(),
    recorrente: z.boolean('Recorrente deve ser verdadeiro ou falso'),
    pagamento: z.enum(['NAO', 'SIM', 'PERDOADO'], 'Pagamento deve ser NAO, SIM ou PERDOADO'),
  })
  .refine(
    (l) => (l.recorrente ? l.qtdParcelas === null : l.qtdParcelas !== null && l.qtdParcelas >= l.parcelaAtual),
    // Espelha o CHECK lancamentos_parcelas_coerentes (src/db/schema.ts): recorrente não
    // tem QTD PARCELAS; quem não é recorrente precisa de QTD PARCELAS >= PARCELA ATUAL.
    {
      message: 'QTD PARCELAS incoerente com PARCELA ATUAL/RECORRENTE',
      path: ['qtdParcelas'],
    },
  )

/** Um lote inteiro vindo da tela de importação (Tarefa 11), para gravarLoteAction. */
export const loteSchema = z
  .array(lancamentoSchema)
  .max(TAMANHO_DO_LOTE, `Lote acima do tamanho máximo de ${TAMANHO_DO_LOTE}`)

/** CÓDs a conferir contra o banco, para conferirCods. Mesmo teto do lote: sem ele,
 * conferirCods aceitaria um `inArray` de tamanho arbitrário vindo de fora. */
export const codsSchema = z
  .array(z.number('CÓD deve ser um número').int('CÓD deve ser um número inteiro').min(1, 'CÓD deve ser no mínimo 1'))
  .max(TAMANHO_DO_LOTE, `Lote acima do tamanho máximo de ${TAMANHO_DO_LOTE}`)
