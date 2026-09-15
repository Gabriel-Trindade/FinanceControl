import { describe, expect, it } from 'vitest'
import {
  ehDataValida,
  formatarMesFatura,
  hojeEmSaoPaulo,
  inicioDoMes,
  lerMes,
  mesmoMes,
  mesParaTexto,
  somarMeses,
  sugerirMesFatura,
} from './datas'

describe('hojeEmSaoPaulo (R0)', () => {
  it('usa o fuso de São Paulo, não o UTC do servidor', () => {
    // 01:30 de 01/10 em UTC ainda é 22:30 de 30/09 em São Paulo (UTC-3).
    expect(hojeEmSaoPaulo(new Date('2026-10-01T01:30:00Z'))).toBe('2026-09-30')
  })

  it('vira o dia à meia-noite de São Paulo', () => {
    expect(hojeEmSaoPaulo(new Date('2026-10-01T03:00:00Z'))).toBe('2026-10-01')
  })
})

describe('inicioDoMes, somarMeses e mesmoMes', () => {
  it('leva a data ao dia 1', () => {
    expect(inicioDoMes('2026-09-14')).toBe('2026-09-01')
  })

  it('soma e subtrai meses virando o ano', () => {
    expect(somarMeses('2026-12-01', 1)).toBe('2027-01-01')
    expect(somarMeses('2026-01-01', -1)).toBe('2025-12-01')
    expect(somarMeses('2026-09-01', 14)).toBe('2027-11-01')
  })

  it('compara mês e ano', () => {
    expect(mesmoMes('2026-09-01', '2026-09-30')).toBe(true)
    expect(mesmoMes('2026-09-01', '2025-09-01')).toBe(false)
  })
})

describe('sugerirMesFatura (R3)', () => {
  it.each([
    ['2026-09-09', '2026-09-01'], // no dia do fechamento: fatura do mês
    ['2026-09-10', '2026-10-01'], // depois do fechamento: mês seguinte
    ['2026-08-20', '2026-09-01'], // igual à fatura real de set/2026
    ['2026-12-15', '2027-01-01'], // virada de ano
    ['2026-01-01', '2026-01-01'],
  ])('compra em %s cai na fatura %s', (compra, fatura) => {
    expect(sugerirMesFatura(compra)).toBe(fatura)
  })

  it('aceita outro dia de fechamento', () => {
    expect(sugerirMesFatura('2026-09-10', 10)).toBe('2026-09-01')
  })
})

describe('formatarMesFatura, lerMes e mesParaTexto (R2)', () => {
  it('formata abreviado em português', () => {
    expect(formatarMesFatura('2026-09-01')).toBe('set/2026')
    expect(formatarMesFatura('2027-01-01')).toBe('jan/2027')
  })

  it('lê o valor de um <input type="month">', () => {
    expect(lerMes('2026-09')).toBe('2026-09-01')
    expect(lerMes('2026-13')).toBeNull()
    expect(lerMes('setembro')).toBeNull()
  })

  it('converte o mês da fatura de volta para o input', () => {
    expect(mesParaTexto('2026-09-01')).toBe('2026-09')
  })
})

describe('ehDataValida', () => {
  it.each(['2026-09-14', '2024-02-29'])('aceita %s', (data) => {
    expect(ehDataValida(data)).toBe(true)
  })

  it.each(['2026-02-30', '2026-13-01', '14/09/2026', ''])('recusa "%s"', (data) => {
    expect(ehDataValida(data)).toBe(false)
  })
})
