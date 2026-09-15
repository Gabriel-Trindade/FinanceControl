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
