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
    // 0 e '-0' não passam por `bruto < 0`, então não provam a guarda do ramo
    // número. -0.004 arredonda para zero vindo de um negativo: é o único
    // caminho que exercita essa guarda.
    expect(Object.is(valorParaCentavos(-0.004), 0)).toBe(true)
  })

  it('recusa o que não é número', () => {
    expect(valorParaCentavos('abc')).toBeNull()
    expect(valorParaCentavos('')).toBeNull()
    expect(valorParaCentavos(Number.NaN)).toBeNull()
    // Infinity é finito? Não — e um "centavos" infinito não pode chegar ao banco.
    expect(valorParaCentavos(Infinity)).toBeNull()
    expect(valorParaCentavos(-Infinity)).toBeNull()
  })

  it('tolera espaço, NBSP e BOM nas pontas do texto vindo do Excel', () => {
    // Célula de texto do XLSX costuma vir com espaço sobrando. O NBSP (espaço
    // não separável, U+00A0) é o mais provável dos três na prática: o Excel usa
    // NBSP na formatação de número, e se colar numa célula, só o trim() salva
    // a linha. O BOM (marca de ordem de byte, U+FEFF) aparece em exportações
    // de outras planilhas. trim() remove os três. Geramos NBSP e BOM com
    // fromCharCode em vez de colar o caractere invisível no arquivo, para o
    // teste continuar legível e auditável.
    const bom = String.fromCharCode(0xfeff)
    const nbsp = String.fromCharCode(0x00a0)
    expect(valorParaCentavos('  12.34  ')).toBe(1234)
    expect(valorParaCentavos(' 12.34' + bom)).toBe(1234)
    expect(valorParaCentavos(nbsp + '12.34' + nbsp)).toBe(1234)
  })

  it('cobre os extremos reais da planilha e mais de duas casas decimais', () => {
    // -8.204,99 e 7.000,00 são o mínimo e o máximo medidos nos 4.805 lançamentos.
    expect(valorParaCentavos(-8204.99)).toBe(-820499)
    expect(valorParaCentavos(7000)).toBe(700000)
    // Só a terceira casa decide o arredondamento; a quarta em diante é ignorada.
    expect(valorParaCentavos('1.2345')).toBe(123)
  })
})
