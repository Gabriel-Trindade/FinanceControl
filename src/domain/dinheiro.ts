// Parte inteira: "1.234.567" (milhares com ponto) ou "1234567" (sem ponto).
// Parte decimal opcional: vírgula + 1 ou 2 dígitos.
// "1234.56" é recusado de propósito: no Brasil o ponto separa milhar, não centavos.
const PADRAO = /^(-)?(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?$/

export function paraCentavos(texto: string): number | null {
  const limpo = texto.replace(/R\$/g, '').replace(/\s/g, '')
  const partes = PADRAO.exec(limpo)
  if (!partes) return null

  const [, sinal, inteiro, decimal = ''] = partes
  const centavos = Number(inteiro.replaceAll('.', '')) * 100 + Number(decimal.padEnd(2, '0'))
  // Evita devolver -0 para "-0,00".
  return sinal && centavos !== 0 ? -centavos : centavos
}

const FORMATO_BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export function formatarReais(centavos: number): string {
  // O Intl usa espaço não separável (U+00A0) depois de "R$"; trocamos por espaço comum
  // para o texto sair igual em testes, CSV e mensagens copiadas.
  return FORMATO_BRL.format(centavos / 100).replace(/\u00A0/g, ' ')
}
