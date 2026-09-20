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
