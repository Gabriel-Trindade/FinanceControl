import { describe, expect, it } from 'vitest'
import { COLUNAS_ESPERADAS, conferirCabecalho, ErroDeLeitura, mapearErroDeLeitura } from './ler-xlsx'

describe('conferirCabecalho', () => {
  it('aceita o cabeçalho da aba GASTOS', () => {
    expect(() => conferirCabecalho([...COLUNAS_ESPERADAS])).not.toThrow()
  })

  it('ignora espaços e diferença de maiúsculas', () => {
    expect(() => conferirCabecalho(COLUNAS_ESPERADAS.map((c) => ` ${c.toLowerCase()} `))).not.toThrow()
  })

  it('recusa coluna faltando, dizendo qual', () => {
    const semValor = COLUNAS_ESPERADAS.filter((c) => c !== 'VALOR')
    expect(() => conferirCabecalho([...semValor])).toThrow(ErroDeLeitura)
    expect(() => conferirCabecalho([...semValor])).toThrow(/VALOR/)
  })

  it('recusa coluna fora de ordem', () => {
    const trocado = [...COLUNAS_ESPERADAS]
    ;[trocado[5], trocado[6]] = [trocado[6], trocado[5]]
    expect(() => conferirCabecalho(trocado)).toThrow(ErroDeLeitura)
  })

  it('recusa planilha sem nenhuma linha', () => {
    expect(() => conferirCabecalho([])).toThrow(ErroDeLeitura)
  })
})

describe('mapearErroDeLeitura', () => {
  it('traduz cada erro da biblioteca para português', async () => {
    const m = await import('read-excel-file/browser')

    // SheetNotFoundError(sheet, sheets) exige os dois argumentos (ver
    // node_modules/read-excel-file/types/SheetNotFoundError.d.ts) — o brief previu
    // que o construtor real poderia divergir do rascunho e mandou ajustar só aqui.
    expect(mapearErroDeLeitura(new m.SheetNotFoundError('GASTOS', ['OUTRA_ABA']), m).message).toContain('GASTOS')
    expect(mapearErroDeLeitura(new m.InvalidSpreadsheetError('x'), m).message).toContain('senha')
    // InvalidInputError(code) exige um dos códigos de InvalidInputErrorCode, não uma
    // mensagem livre (ver node_modules/read-excel-file/types/InvalidInputError.d.ts).
    expect(mapearErroDeLeitura(new m.InvalidInputError('FILE_NOT_SUPPORTED'), m).message).toContain('.xlsx')
    expect(mapearErroDeLeitura(new Error('desconhecido'), m)).toBeInstanceOf(ErroDeLeitura)
  })

  it('não embrulha um ErroDeLeitura que já veio pronto', async () => {
    const m = await import('read-excel-file/browser')
    const original = new ErroDeLeitura('mensagem original')
    expect(mapearErroDeLeitura(original, m)).toBe(original)
  })
})
