import { z } from 'zod'
import { NOME_MAXIMO } from '@/domain/planilha'
// De @/importacao/lotes, não de @/db/importacao: esse módulo arrastaria o Drizzle e o
// schema inteiro para o pacote do cliente quando a tela de importação (Tarefa 11)
// importar TAMANHO_DO_LOTE para fatiar o arquivo antes de mandar cada lote pra cá.
import { TAMANHO_DO_LOTE } from '@/importacao/lotes'

/**
 * As duas únicas barreiras entre um POST forjado (qualquer um pode chamar uma Server
 * Action direto, sem passar pela tela) e um INSERT que estoura um limite do banco e
 * derruba o lote inteiro de 500, com uma mensagem que não diz qual linha causou. Por
 * isso todo teto numérico aqui é obrigatório, não estético — e toda mensagem é escrita
 * em português, inclusive as de "isto nem é um objeto/lista" do zod (`z.object`/`z.array`
 * respondem em inglês por padrão): um POST com tipo errado receberia a mensagem dele em
 * vez desta, e a Tarefa 11 mostra `erro` direto na tela.
 */

// Limite do `integer` do Postgres (2^31 - 1). cod_planilha e valor_centavos são `integer`
// no schema — o mesmo teto de src/domain/planilha.ts (MAX_INTEGER) e de
// src/app/(app)/lancamentos/novo/validacao.ts (CENTAVOS_MAXIMOS), copiado aqui para não
// acoplar os três por import.
const INTEGER_MAXIMO = 2_147_483_647

// Limite do `smallint` do Postgres. parcela_atual e qtd_parcelas usam esse tipo de coluna.
const SMALLINT_MAXIMO = 32_767

/**
 * CÓD da planilha: inteiro ≥ 1 e dentro do `integer` do Postgres. Compartilhado entre
 * `loteSchema` (campo `codPlanilha`) e `codsSchema` (os CÓDs que `conferirCods` manda
 * verificar) — a revisão de código encontrou os dois tetos desalinhados (um sem `.max()`,
 * o outro nunca existiu) quando eram duas cópias da mesma regra; uma só evita que
 * desalinhem de novo.
 */
const codSchema = z
  .number('CÓD deve ser um número')
  .int('CÓD deve ser um número inteiro')
  .min(1, 'CÓD deve ser no mínimo 1')
  .max(INTEGER_MAXIMO, 'CÓD acima do limite do banco (máximo 2.147.483.647)')

// Nomes têm índice único (pessoas_nome_unico / categorias_nome_unico, sobre lower(nome)).
// Um índice btree do Postgres recusa gravar uma entrada acima de ~8191 bytes ("index row
// requires ... maximum size is 8191") — sem este teto, um nome absurdamente longo (POST
// forjado, não a planilha real) estouraria isso na hora de obterOuCriarPessoa/Categoria,
// e não seria um erro por linha, e sim uma exceção no meio da resolução de cadastros.
//
// NOME_MAXIMO vem de @/domain/planilha (importado acima), não é redeclarado aqui: o leitor
// (src/domain/planilha.ts) já recusa CATEGORIA/ORIGEM acima deste tamanho como problema por
// linha, antes de o lote chegar aqui. As duas cópias independentes do mesmo número já
// desalinharam uma vez (achado da revisão final do branch) — uma só evita que desalinhem
// de novo, o mesmo raciocínio do codSchema compartilhado logo abaixo.

/** Espelha LancamentoDaPlanilha (src/domain/planilha.ts) campo a campo. */
const lancamentoSchema = z
  .object(
    {
      codPlanilha: codSchema,
      mesFatura: z
        .string('Mês da fatura deve ser texto')
        // O dia é sempre 01 (regra do projeto) e o mês precisa existir de verdade: sem o
        // (0[1-9]|1[0-2]), "2026-13-01" e "9999-99-01" passavam no zod e só estouravam no
        // banco ("date/time field value out of range"), derrubando o lote inteiro.
        .regex(/^\d{4}-(0[1-9]|1[0-2])-01$/, 'Mês da fatura deve estar no formato AAAA-MM-01'),
      pessoa: z
        .string('Pessoa deve ser texto')
        .trim()
        .min(1, 'Informe a pessoa')
        .max(NOME_MAXIMO, `Pessoa acima do limite de ${NOME_MAXIMO} caracteres`),
      categoria: z
        .string('Categoria deve ser texto')
        .trim()
        .min(1, 'Informe a categoria')
        .max(NOME_MAXIMO, `Categoria acima do limite de ${NOME_MAXIMO} caracteres`),
      item: z.string('Item deve ser texto').trim().min(1, 'Informe o item'),
      valorCentavos: z
        .number('Valor deve ser um número')
        .int('Valor deve ser um número inteiro de centavos')
        .min(-INTEGER_MAXIMO, 'Valor abaixo do limite de -R$ 21.474.836,47')
        .max(INTEGER_MAXIMO, 'Valor acima do limite de R$ 21.474.836,47'),
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
        // Redundante com o .refine abaixo quando recorrente é false (que já exige
        // qtdParcelas >= parcelaAtual >= 1), mas deixa o piso do smallint explícito aqui
        // ao lado do teto, em vez de depender de um .refine que existe por outro motivo.
        .min(1, 'Quantidade de parcelas deve ser no mínimo 1')
        .max(SMALLINT_MAXIMO, `Quantidade de parcelas acima do limite de ${SMALLINT_MAXIMO}`)
        .nullable(),
      recorrente: z.boolean('Recorrente deve ser verdadeiro ou falso'),
      pagamento: z.enum(['NAO', 'SIM', 'PERDOADO'], 'Pagamento deve ser NAO, SIM ou PERDOADO'),
    },
    'Lançamento deve ser um objeto',
  )
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
  .array(lancamentoSchema, 'Lote deve ser uma lista de lançamentos')
  .max(TAMANHO_DO_LOTE, `Lote acima do tamanho máximo de ${TAMANHO_DO_LOTE}`)

/** CÓDs a conferir contra o banco, para conferirCods. Mesmo teto do lote: sem ele,
 * conferirCods aceitaria um `inArray` de tamanho arbitrário vindo de fora. */
export const codsSchema = z
  .array(codSchema, 'CÓDs devem ser uma lista de números')
  .max(TAMANHO_DO_LOTE, `Lote acima do tamanho máximo de ${TAMANHO_DO_LOTE}`)
