import { describe, expect, it } from 'vitest'
import type { LancamentoDaPlanilha, ResultadoDaTraducao } from '@/domain/planilha'
import { etapaDaFase, fatiar, formatarNumero, montarResumo, separarNovos } from './logica'

/** Um lançamento válido; os testes alteram só o campo em questão — mesmo padrão de
 *  actions.test.ts (Tarefa 10), para os dois arquivos lerem parecido. */
function lancamento(mudancas: Partial<LancamentoDaPlanilha> = {}): LancamentoDaPlanilha {
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

describe('fatiar', () => {
  it('devolve lista vazia para entrada vazia', () => {
    expect(fatiar([], 500)).toEqual([])
  })

  it('não cria um pedaço vazio quando o total é múltiplo exato do tamanho', () => {
    const itens = Array.from({ length: 1000 }, (_, i) => i)
    const partes = fatiar(itens, 500)
    expect(partes).toHaveLength(2)
    expect(partes[0]).toHaveLength(500)
    expect(partes[1]).toHaveLength(500)
  })

  it('o último pedaço fica menor quando sobra resto', () => {
    const itens = Array.from({ length: 4805 }, (_, i) => i)
    const partes = fatiar(itens, 500)
    expect(partes).toHaveLength(10)
    expect(partes.slice(0, 9).every((p) => p.length === 500)).toBe(true)
    expect(partes[9]).toHaveLength(305)
  })

  it('preserva a ordem original dentro e entre os pedaços', () => {
    expect(fatiar([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
  })

  it('recusa tamanho zero ou negativo — evitaria um laço infinito em fatiar', () => {
    expect(() => fatiar([1], 0)).toThrow(RangeError)
    expect(() => fatiar([1], -1)).toThrow(RangeError)
  })
})

describe('separarNovos', () => {
  it('mantém só os lançamentos cujo CÓD não está no conjunto de já importados', () => {
    const lancamentos = [lancamento({ codPlanilha: 1 }), lancamento({ codPlanilha: 2 }), lancamento({ codPlanilha: 3 })]

    const novos = separarNovos(lancamentos, new Set([2]))

    expect(novos.map((l) => l.codPlanilha)).toEqual([1, 3])
  })

  it('com o conjunto vazio, devolve todos os lançamentos', () => {
    const lancamentos = [lancamento({ codPlanilha: 1 }), lancamento({ codPlanilha: 2 })]
    expect(separarNovos(lancamentos, new Set())).toHaveLength(2)
  })
})

describe('formatarNumero', () => {
  it('usa ponto como separador de milhar, como o exemplo da spec §6.5', () => {
    expect(formatarNumero(4805)).toBe('4.805')
  })

  it('não adiciona separador abaixo de mil', () => {
    expect(formatarNumero(305)).toBe('305')
  })

  it('funciona para zero', () => {
    expect(formatarNumero(0)).toBe('0')
  })
})

describe('montarResumo', () => {
  it('reproduz o exemplo da spec §6.5: "li 4.805 linhas · 4.802 novas · 0 já importadas · 3 com problema"', () => {
    const resultado: ResultadoDaTraducao = {
      lancamentos: Array.from({ length: 4802 }, (_, i) => lancamento({ codPlanilha: i + 1 })),
      problemas: [
        { linha: 10, motivo: 'CÓD ausente, não numérico ou menor que 1' },
        { linha: 88, motivo: 'ITEM vazio' },
        { linha: 4200, motivo: 'VALOR ausente ou não numérico' },
      ],
      avisos: [],
    }

    const resumo = montarResumo(resultado, new Set())

    expect(resumo).toEqual({ lidas: 4805, novas: 4802, jaImportadas: 0, comProblema: 3 })
  })

  it('linhas com CÓD já no banco contam em jaImportadas e saem de novas', () => {
    const resultado: ResultadoDaTraducao = {
      lancamentos: [lancamento({ codPlanilha: 1 }), lancamento({ codPlanilha: 2 }), lancamento({ codPlanilha: 3 })],
      problemas: [],
      avisos: [],
    }

    const resumo = montarResumo(resultado, new Set([1, 2]))

    expect(resumo).toEqual({ lidas: 3, novas: 1, jaImportadas: 2, comProblema: 0 })
  })
})

describe('etapaDaFase', () => {
  it('mapeia cada fase interna para uma das 4 etapas visíveis do <Estepe>', () => {
    expect(etapaDaFase('escolher')).toBe(0)
    expect(etapaDaFase('lendo')).toBe(0)
    expect(etapaDaFase('conferindo')).toBe(1)
    expect(etapaDaFase('erro-conferencia')).toBe(1)
    expect(etapaDaFase('revisao')).toBe(1)
    expect(etapaDaFase('gravando')).toBe(2)
    expect(etapaDaFase('erro-gravacao')).toBe(2)
    expect(etapaDaFase('relatorio')).toBe(3)
  })
})
