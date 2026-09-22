import { describe, expect, it } from 'vitest'
import type { LancamentoDaPlanilha } from '@/domain/planilha'
import { TAMANHO_DO_LOTE } from '@/importacao/lotes'
import { codsSchema, loteSchema } from './validacao'

/** Um lançamento válido; os testes alteram só o campo em questão. */
function lancamentoValido(mudancas: Partial<LancamentoDaPlanilha> = {}): LancamentoDaPlanilha {
  return {
    codPlanilha: 1,
    mesFatura: '2026-09-01',
    pessoa: 'Ana',
    categoria: 'Mercado',
    item: 'Compra',
    valorCentavos: 1000,
    parcelaAtual: 1,
    qtdParcelas: 3,
    recorrente: false,
    pagamento: 'NAO',
    ...mudancas,
  }
}

describe('loteSchema', () => {
  it('aceita um lote válido', () => {
    const lote = [lancamentoValido(), lancamentoValido({ codPlanilha: 2 })]
    const resultado = loteSchema.safeParse(lote)
    expect(resultado.success).toBe(true)
    if (resultado.success) expect(resultado.data).toEqual(lote)
  })

  it(`aceita exatamente ${TAMANHO_DO_LOTE} itens (o teto)`, () => {
    const lote = Array.from({ length: TAMANHO_DO_LOTE }, (_, i) => lancamentoValido({ codPlanilha: i + 1 }))
    expect(loteSchema.safeParse(lote).success).toBe(true)
  })

  it(`recusa lote acima de ${TAMANHO_DO_LOTE} itens`, () => {
    const lote = Array.from({ length: TAMANHO_DO_LOTE + 1 }, (_, i) => lancamentoValido({ codPlanilha: i + 1 }))
    const resultado = loteSchema.safeParse(lote)
    expect(resultado.success).toBe(false)
    if (!resultado.success) {
      expect(resultado.error.issues[0].message).toBe(`Lote acima do tamanho máximo de ${TAMANHO_DO_LOTE}`)
    }
  })

  it('recusa codPlanilha não inteiro', () => {
    const resultado = loteSchema.safeParse([lancamentoValido({ codPlanilha: 1.5 })])
    expect(resultado.success).toBe(false)
    if (!resultado.success) expect(resultado.error.issues[0].message).toBe('CÓD deve ser um número inteiro')
  })

  it('recusa codPlanilha menor que 1', () => {
    const resultado = loteSchema.safeParse([lancamentoValido({ codPlanilha: 0 })])
    expect(resultado.success).toBe(false)
    if (!resultado.success) expect(resultado.error.issues[0].message).toBe('CÓD deve ser no mínimo 1')
  })

  it('recusa CÓD de tipo errado com mensagem em português, não a padrão do zod', () => {
    const resultado = loteSchema.safeParse([lancamentoValido({ codPlanilha: 'abc' as unknown as number })])
    expect(resultado.success).toBe(false)
    if (!resultado.success) {
      const mensagem = resultado.error.issues[0].message
      expect(mensagem).toBe('CÓD deve ser um número')
      expect(mensagem.toLowerCase()).not.toContain('expected')
    }
  })

  it('recusa codPlanilha acima do limite do integer do Postgres', () => {
    const resultado = loteSchema.safeParse([lancamentoValido({ codPlanilha: 2_147_483_648 })])
    expect(resultado.success).toBe(false)
    if (!resultado.success) {
      expect(resultado.error.issues[0].message).toBe('CÓD acima do limite do banco (máximo 2.147.483.647)')
    }
  })

  it('aceita codPlanilha exatamente no limite do integer do Postgres', () => {
    expect(loteSchema.safeParse([lancamentoValido({ codPlanilha: 2_147_483_647 })]).success).toBe(true)
  })

  it('recusa mesFatura fora do dia 1', () => {
    const resultado = loteSchema.safeParse([lancamentoValido({ mesFatura: '2026-09-05' })])
    expect(resultado.success).toBe(false)
    if (!resultado.success) {
      expect(resultado.error.issues[0].message).toBe('Mês da fatura deve estar no formato AAAA-MM-01')
    }
  })

  it('recusa mesFatura em formato totalmente diferente', () => {
    expect(loteSchema.safeParse([lancamentoValido({ mesFatura: '01/09/2026' })]).success).toBe(false)
  })

  it('recusa mesFatura com mês que não existe (13)', () => {
    // A coluna é `date`: "2026-13-01" passa por um regex que só confere o dia (^\d{4}-\d{2}-01$)
    // e só estoura no banco ("date/time field value out of range"), derrubando o lote inteiro.
    const resultado = loteSchema.safeParse([lancamentoValido({ mesFatura: '2026-13-01' })])
    expect(resultado.success).toBe(false)
    if (!resultado.success) {
      expect(resultado.error.issues[0].message).toBe('Mês da fatura deve estar no formato AAAA-MM-01')
    }
  })

  it('recusa mesFatura com mês 00', () => {
    expect(loteSchema.safeParse([lancamentoValido({ mesFatura: '2026-00-01' })]).success).toBe(false)
  })

  it('aceita mesFatura em dezembro (fronteira alta do mês)', () => {
    expect(loteSchema.safeParse([lancamentoValido({ mesFatura: '2026-12-01' })]).success).toBe(true)
  })

  it('recusa valorCentavos acima do limite do integer do Postgres', () => {
    const resultado = loteSchema.safeParse([lancamentoValido({ valorCentavos: 2_147_483_648 })])
    expect(resultado.success).toBe(false)
    if (!resultado.success) {
      expect(resultado.error.issues[0].message).toBe('Valor acima do limite de R$ 21.474.836,47')
    }
  })

  it('aceita valorCentavos exatamente no limite superior', () => {
    expect(loteSchema.safeParse([lancamentoValido({ valorCentavos: 2_147_483_647 })]).success).toBe(true)
  })

  it('recusa valorCentavos abaixo do limite inferior', () => {
    const resultado = loteSchema.safeParse([lancamentoValido({ valorCentavos: -2_147_483_648 })])
    expect(resultado.success).toBe(false)
    if (!resultado.success) {
      expect(resultado.error.issues[0].message).toBe('Valor abaixo do limite de -R$ 21.474.836,47')
    }
  })

  it('recusa parcelaAtual acima do limite do smallint', () => {
    const resultado = loteSchema.safeParse([
      lancamentoValido({ parcelaAtual: 32_768, qtdParcelas: 32_768 }),
    ])
    expect(resultado.success).toBe(false)
    if (!resultado.success) {
      expect(resultado.error.issues[0].message).toBe('Parcela atual acima do limite de 32767')
    }
  })

  it('recusa qtdParcelas acima do limite do smallint', () => {
    const resultado = loteSchema.safeParse([lancamentoValido({ qtdParcelas: 32_768 })])
    expect(resultado.success).toBe(false)
    if (!resultado.success) {
      expect(resultado.error.issues[0].message).toBe('Quantidade de parcelas acima do limite de 32767')
    }
  })

  it('recusa parcelaAtual menor que 1', () => {
    const resultado = loteSchema.safeParse([lancamentoValido({ parcelaAtual: 0, qtdParcelas: 3 })])
    expect(resultado.success).toBe(false)
    if (!resultado.success) expect(resultado.error.issues[0].message).toBe('Parcela atual deve ser no mínimo 1')
  })

  it('recusa qtdParcelas nulo quando recorrente é false', () => {
    const resultado = loteSchema.safeParse([lancamentoValido({ recorrente: false, qtdParcelas: null })])
    expect(resultado.success).toBe(false)
    if (!resultado.success) {
      expect(resultado.error.issues[0].message).toBe('QTD PARCELAS incoerente com PARCELA ATUAL/RECORRENTE')
    }
  })

  it('aceita qtdParcelas nulo quando recorrente é true', () => {
    expect(loteSchema.safeParse([lancamentoValido({ recorrente: true, qtdParcelas: null })]).success).toBe(
      true,
    )
  })

  it('recusa qtdParcelas não nulo quando recorrente é true', () => {
    const resultado = loteSchema.safeParse([lancamentoValido({ recorrente: true, qtdParcelas: 3 })])
    expect(resultado.success).toBe(false)
  })

  it('recusa qtdParcelas menor que parcelaAtual', () => {
    const resultado = loteSchema.safeParse([
      lancamentoValido({ recorrente: false, parcelaAtual: 5, qtdParcelas: 3 }),
    ])
    expect(resultado.success).toBe(false)
  })

  it('recusa qtdParcelas abaixo de 1, com a mensagem do piso (não a do refine)', () => {
    const resultado = loteSchema.safeParse([lancamentoValido({ qtdParcelas: 0 })])
    expect(resultado.success).toBe(false)
    if (!resultado.success) {
      expect(resultado.error.issues[0].message).toBe('Quantidade de parcelas deve ser no mínimo 1')
    }
  })

  it('recusa pagamento fora do enum', () => {
    const resultado = loteSchema.safeParse([lancamentoValido({ pagamento: 'TALVEZ' as unknown as 'NAO' })])
    expect(resultado.success).toBe(false)
    if (!resultado.success) {
      expect(resultado.error.issues[0].message).toBe('Pagamento deve ser NAO, SIM ou PERDOADO')
    }
  })

  it('recusa pessoa vazia', () => {
    const resultado = loteSchema.safeParse([lancamentoValido({ pessoa: '   ' })])
    expect(resultado.success).toBe(false)
    if (!resultado.success) expect(resultado.error.issues[0].message).toBe('Informe a pessoa')
  })

  it('recusa pessoa acima de 200 caracteres (índice único não engole qualquer tamanho)', () => {
    const resultado = loteSchema.safeParse([lancamentoValido({ pessoa: 'a'.repeat(201) })])
    expect(resultado.success).toBe(false)
    if (!resultado.success) {
      expect(resultado.error.issues[0].message).toBe('Pessoa acima do limite de 200 caracteres')
    }
  })

  it('recusa categoria acima de 200 caracteres', () => {
    const resultado = loteSchema.safeParse([lancamentoValido({ categoria: 'a'.repeat(201) })])
    expect(resultado.success).toBe(false)
    if (!resultado.success) {
      expect(resultado.error.issues[0].message).toBe('Categoria acima do limite de 200 caracteres')
    }
  })

  it('recusa lote que não é uma lista, com mensagem em português (não a padrão do zod)', () => {
    const resultado = loteSchema.safeParse(undefined)
    expect(resultado.success).toBe(false)
    if (!resultado.success) {
      const mensagem = resultado.error.issues[0].message
      expect(mensagem).toBe('Lote deve ser uma lista de lançamentos')
      expect(mensagem.toLowerCase()).not.toContain('expected')
    }
  })

  it('recusa elemento que não é um objeto, com mensagem em português (não a padrão do zod)', () => {
    const resultado = loteSchema.safeParse([null])
    expect(resultado.success).toBe(false)
    if (!resultado.success) {
      const mensagem = resultado.error.issues[0].message
      expect(mensagem).toBe('Lançamento deve ser um objeto')
      expect(mensagem.toLowerCase()).not.toContain('expected')
    }
  })
})

describe('codsSchema', () => {
  it('aceita um array de CÓDs válidos', () => {
    expect(codsSchema.safeParse([1, 2, 3]).success).toBe(true)
  })

  it(`aceita exatamente ${TAMANHO_DO_LOTE} itens (o teto)`, () => {
    const cods = Array.from({ length: TAMANHO_DO_LOTE }, (_, i) => i + 1)
    expect(codsSchema.safeParse(cods).success).toBe(true)
  })

  it(`recusa array acima de ${TAMANHO_DO_LOTE} itens`, () => {
    const cods = Array.from({ length: TAMANHO_DO_LOTE + 1 }, (_, i) => i + 1)
    const resultado = codsSchema.safeParse(cods)
    expect(resultado.success).toBe(false)
    if (!resultado.success) {
      expect(resultado.error.issues[0].message).toBe(`Lote acima do tamanho máximo de ${TAMANHO_DO_LOTE}`)
    }
  })

  it('recusa item não inteiro', () => {
    expect(codsSchema.safeParse([1.5]).success).toBe(false)
  })

  it('recusa item menor que 1', () => {
    const resultado = codsSchema.safeParse([0])
    expect(resultado.success).toBe(false)
    if (!resultado.success) expect(resultado.error.issues[0].message).toBe('CÓD deve ser no mínimo 1')
  })

  it('recusa item acima do limite do integer do Postgres', () => {
    const resultado = codsSchema.safeParse([2_147_483_648])
    expect(resultado.success).toBe(false)
    if (!resultado.success) {
      expect(resultado.error.issues[0].message).toBe('CÓD acima do limite do banco (máximo 2.147.483.647)')
    }
  })

  it('aceita item exatamente no limite do integer do Postgres', () => {
    expect(codsSchema.safeParse([2_147_483_647]).success).toBe(true)
  })

  it('recusa entrada que não é uma lista, com mensagem em português (não a padrão do zod)', () => {
    const resultado = codsSchema.safeParse(undefined)
    expect(resultado.success).toBe(false)
    if (!resultado.success) {
      const mensagem = resultado.error.issues[0].message
      expect(mensagem).toBe('CÓDs devem ser uma lista de números')
      expect(mensagem.toLowerCase()).not.toContain('expected')
    }
  })
})
