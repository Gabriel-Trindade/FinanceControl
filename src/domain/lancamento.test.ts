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
