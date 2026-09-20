import { strToU8, zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { COLUNAS_ESPERADAS, conferirCabecalho, ErroDeLeitura, lerPlanilha, mapearErroDeLeitura } from './ler-xlsx'

describe('conferirCabecalho', () => {
  it('aceita o cabeçalho da aba GASTOS', () => {
    expect(() => conferirCabecalho([...COLUNAS_ESPERADAS])).not.toThrow()
  })

  it('ignora espaços e diferença de maiúsculas', () => {
    expect(() => conferirCabecalho(COLUNAS_ESPERADAS.map((c) => ` ${c.toLowerCase()} `))).not.toThrow()
  })

  // Excel de macOS grava o cabeçalho com acento decomposto (NFD: "E" + acento agudo
  // separado, em vez do caractere único "É"). Derivado em execução de propósito — um
  // literal NFD escrito à mão se recompõe sozinho para NFC ao salvar o arquivo, e o
  // teste pararia de provar o que diz provar sem ninguém perceber (apagar o
  // `.normalize('NFC')` de conferirCabecalho deixava os outros 7 testes verdes).
  it('aceita cabeçalho com acento decomposto (NFD)', () => {
    expect(() => conferirCabecalho(COLUNAS_ESPERADAS.map((c) => c.normalize('NFD')))).not.toThrow()
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

  // read-excel-file preenche TODA linha (cabeçalho incluso) até a maior coluna usada em
  // QUALQUER linha da planilha inteira — uma célula solta na coluna O da aba GASTOS faz
  // o cabeçalho chegar com 15 posições. A spec §6.1 manda recusar dizendo o que sobrou.
  it('recusa coluna a mais depois de SITUAÇÃO, dizendo qual', () => {
    const comExtra = [...COLUNAS_ESPERADAS, 'OBSERVAÇÃO']
    expect(() => conferirCabecalho(comExtra)).toThrow(ErroDeLeitura)
    expect(() => conferirCabecalho(comExtra)).toThrow(/OBSERVAÇÃO/)
  })

  it('aceita coluna extra vazia (preenchimento da biblioteca, sem conteúdo real)', () => {
    expect(() => conferirCabecalho([...COLUNAS_ESPERADAS, null])).not.toThrow()
  })

  it('recusa planilha sem nenhuma linha', () => {
    expect(() => conferirCabecalho([])).toThrow(ErroDeLeitura)
    expect(() => conferirCabecalho([])).toThrow(/vazia/)
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

    // Mesma ideia de travar a mensagem (não só o tipo) aplicada ao erro desconhecido: sem
    // isso, uma mutação que trocasse ou esvaziasse o texto do fallback sobreviveria.
    const generico = mapearErroDeLeitura(new Error('desconhecido'), m)
    expect(generico).toBeInstanceOf(ErroDeLeitura)
    expect(generico.message).toBe('Não foi possível ler o arquivo.')
  })

  it('não embrulha um ErroDeLeitura que já veio pronto', async () => {
    const m = await import('read-excel-file/browser')
    const original = new ErroDeLeitura('mensagem original')
    expect(mapearErroDeLeitura(original, m)).toBe(original)
  })
})

// ===== lerPlanilha =====
//
// Monta um .xlsx MÍNIMO em memória (nunca em disco, nunca no repositório) com `fflate` —
// o zipador que o próprio read-excel-file usa por dentro para descompactar
// (node_modules/read-excel-file/commonjs/zip/unzipFromArrayBuffer.js) — contendo só as 3
// partes que node_modules/read-excel-file/commonjs/xlsx/parseSpreadsheetContents.js
// realmente lê: `xl/workbook.xml` e `xl/_rels/workbook.xml.rels` (obrigatórios — sem eles
// cai em InvalidSpreadsheetError, "file not found inside the .xlsx file") e a aba em
// `xl/worksheets/sheet1.xml`. `sharedStrings.xml` e `styles.xml` são opcionais (têm
// fallback no próprio código-fonte: `[]` e `{}`) — por isso as células de texto abaixo
// usam `t="inlineStr"` (string embutida na própria célula) em vez de índice de shared
// string, e nenhuma célula usa formatação de data. `[Content_Types].xml` nem chega a ser
// lido por essa biblioteca (só pelo Excel de verdade), então também fica de fora.
//
// Rodar `readSheet` de `/browser` até o fim é possível em Node puro: apesar do nome, o
// parâmetro de worker em parseSpreadsheetContents.js está documentado como "Not used" na
// 9.3.10 (o README do pacote marca a frase antiga sobre Web Worker como "Previous
// inaccurate statement") — o caminho é síncrono. As classes de erro importadas de
// `read-excel-file/browser` são os mesmos arquivos-fonte que a biblioteca lança por
// dentro (conferido em node_modules/read-excel-file/browser/index.js), então
// `mapearErroDeLeitura` reconhece o erro real, não só o erro construído à mão nos testes
// de cima.

function escaparXml(texto: string): string {
  return texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function letraDaColuna(indiceBase0: number): string {
  return String.fromCharCode(65 + indiceBase0) // A-Z: até 26 colunas, mais que as 14 da GASTOS.
}

function linhaParaXml(valores: Array<string | number>, numeroDaLinhaExcel: number): string {
  const celulas = valores
    .map((valor, indice) => {
      const ref = `${letraDaColuna(indice)}${numeroDaLinhaExcel}`
      // Sem célula é tipo "n" (número) por padrão — igual à planilha real, onde CÓD é
      // numérico. Texto vai como inlineStr, sem depender de sharedStrings.xml.
      if (typeof valor === 'number') return `<c r="${ref}"><v>${valor}</v></c>`
      return `<c r="${ref}" t="inlineStr"><is><t>${escaparXml(valor)}</t></is></c>`
    })
    .join('')
  return `<row r="${numeroDaLinhaExcel}">${celulas}</row>`
}

/** Monta um .xlsx válido mínimo — só o que read-excel-file precisa para ler uma aba. */
function construirXlsxMinimo(opcoes: { nomeDaAba: string; linhas: Array<Array<string | number>> }): File {
  const linhasXml = opcoes.linhas.map((linha, indice) => linhaParaXml(linha, indice + 1)).join('')

  const workbookXml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    `<sheets><sheet name="${escaparXml(opcoes.nomeDaAba)}" sheetId="1" r:id="rId1"/></sheets>` +
    '</workbook>'

  const workbookRelsXml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" ' +
    'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" ' +
    'Target="worksheets/sheet1.xml"/>' +
    '</Relationships>'

  const sheetXml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    `<sheetData>${linhasXml}</sheetData>` +
    '</worksheet>'

  const zip = zipSync({
    'xl/workbook.xml': strToU8(workbookXml),
    'xl/_rels/workbook.xml.rels': strToU8(workbookRelsXml),
    'xl/worksheets/sheet1.xml': strToU8(sheetXml),
  })

  return new File([zip], 'teste.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

describe('lerPlanilha', () => {
  it('lê a aba GASTOS e devolve só as linhas de dados, sem o cabeçalho', async () => {
    const arquivo = construirXlsxMinimo({
      nomeDaAba: 'GASTOS',
      linhas: [[...COLUNAS_ESPERADAS], [1, 'primeira linha'], [2, 'segunda linha']],
    })

    const dados = await lerPlanilha(arquivo)

    expect(dados).toHaveLength(2)
    expect(dados[0]?.[0]).toBe(1)
    expect(dados[1]?.[0]).toBe(2)
  })

  it('aba com outro nome recusa dizendo qual aba era esperada', async () => {
    const arquivo = construirXlsxMinimo({ nomeDaAba: 'OUTRA_ABA', linhas: [[...COLUNAS_ESPERADAS]] })

    await expect(lerPlanilha(arquivo)).rejects.toThrow(ErroDeLeitura)
    await expect(lerPlanilha(arquivo)).rejects.toThrow(/GASTOS/)
  })

  it('arquivo que não é .xlsx recusa dizendo que precisa ser .xlsx', async () => {
    const arquivo = new File(['isto não é um arquivo .xlsx'], 'fatura.pdf', { type: 'application/pdf' })

    await expect(lerPlanilha(arquivo)).rejects.toThrow(ErroDeLeitura)
    await expect(lerPlanilha(arquivo)).rejects.toThrow(/\.xlsx/)
  })
})
