import { describe, expect, it } from 'vitest'
import { formatarReais, paraCentavos } from './dinheiro'

describe('paraCentavos', () => {
  it.each([
    ['1.234,56', 123456],
    ['1234,56', 123456],
    ['1.234', 123400],
    ['1234', 123400],
    ['0,5', 50],
    ['  12,3 ', 1230],
    ['R$ 99,90', 9990],
    ['-10,00', -1000],
    ['-0,00', 0],
  ])('converte "%s" em %i centavos', (texto, esperado) => {
    expect(paraCentavos(texto)).toBe(esperado)
  })

  it.each(['', 'abc', '12,345', '1.2.3,4', '12,', ',5', '1234.56', '12.5'])(
    'recusa "%s"',
    (texto) => {
      expect(paraCentavos(texto)).toBeNull()
    },
  )
})

describe('formatarReais', () => {
  it.each([
    [123456, 'R$ 1.234,56'],
    [5, 'R$ 0,05'],
    [0, 'R$ 0,00'],
    [-1000, '-R$ 10,00'],
  ])('formata %i centavos como "%s"', (centavos, esperado) => {
    expect(formatarReais(centavos)).toBe(esperado)
  })
})
