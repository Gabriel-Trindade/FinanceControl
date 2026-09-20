// O número da célula chega como texto ("1234.56", com ponto decimal do XLSX) ou já
// como number. Os dois caminhos existem porque o read-excel-file pode entregar
// qualquer um dos dois, e nenhum dos dois pode perder centavo.
const PADRAO_NUMERO = /^(-)?(\d+)(?:\.(\d+))?$/

/** Valor da planilha → centavos inteiros. `null` quando não é número. */
export function valorParaCentavos(bruto: string | number): number | null {
  if (typeof bruto === 'string') {
    const partes = PADRAO_NUMERO.exec(bruto.trim())
    if (!partes) return null
    const [, sinal, inteiro, decimal = ''] = partes
    // Duas casas exatas: completa com zero, ou arredonda a partir da terceira.
    const centavosSemArredondar = Number(inteiro) * 100 + Number(decimal.slice(0, 2).padEnd(2, '0'))
    const terceira = Number(decimal[2] ?? '0')
    const centavos = centavosSemArredondar + (terceira >= 5 ? 1 : 0)
    // O sinal fica de fora da conta e só é aplicado aqui no fim, sobre a
    // magnitude já arredondada. O "!== 0" evita devolver -0 (ex.: "-0,00" ou
    // um negativo que arredonda para zero), que quebra Object.is e sai como
    // "-0" em JSON.
    return sinal && centavos !== 0 ? -centavos : centavos
  }

  if (!Number.isFinite(bruto)) return null
  // toFixed antes do round limpa o ruído binário: sem ele, 1.005 * 100 é 100.4999...
  const centavos = Math.round(Number((Math.abs(bruto) * 100).toFixed(6)))
  // Arredonda o valor absoluto e só então aplica o sinal: Math.round(-1.5) dá -1,
  // ou seja, na direção do zero, não para longe dele — por isso o sinal fica de
  // fora do Math.round. O "!== 0" evita devolver -0, que quebra Object.is e sai
  // como "-0" em JSON.
  return bruto < 0 && centavos !== 0 ? -centavos : centavos
}
