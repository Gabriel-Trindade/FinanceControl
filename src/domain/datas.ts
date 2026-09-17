export const FUSO_HORARIO = 'America/Sao_Paulo'
export const DIA_FECHAMENTO = 9

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const PADRAO_DATA = /^(\d{4})-(\d{2})-(\d{2})$/
const PADRAO_MES = /^(\d{4})-(\d{2})$/

function separar(data: string): { ano: number; mes: number; dia: number } {
  const partes = PADRAO_DATA.exec(data)
  if (!partes) throw new Error(`Data inválida: "${data}" (esperado AAAA-MM-DD)`)
  return { ano: Number(partes[1]), mes: Number(partes[2]), dia: Number(partes[3]) }
}

function montar(ano: number, mes: number, dia: number): string {
  return `${String(ano).padStart(4, '0')}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

/** R0: a data de hoje no fuso de São Paulo. O servidor roda em UTC e erraria o dia à noite. */
export function hojeEmSaoPaulo(agora: Date = new Date()): string {
  const partes = new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO_HORARIO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(agora)
  const pegar = (tipo: 'year' | 'month' | 'day') => partes.find((p) => p.type === tipo)?.value ?? ''
  return `${pegar('year')}-${pegar('month')}-${pegar('day')}`
}

/** "2026-09-14" → "2026-09-01". */
export function inicioDoMes(data: string): string {
  const { ano, mes } = separar(data)
  return montar(ano, mes, 1)
}

/** Soma (ou subtrai, com número negativo) meses a um mês de fatura "AAAA-MM-01". */
export function somarMeses(mesFatura: string, quantidade: number): string {
  const { ano, mes } = separar(mesFatura)
  // Conta tudo em "meses desde o ano zero" para a virada de ano sair de graça.
  const total = ano * 12 + (mes - 1) + quantidade
  return montar(Math.floor(total / 12), (((total % 12) + 12) % 12) + 1, 1)
}

/** true quando as duas datas caem no mesmo mês do mesmo ano. */
export function mesmoMes(a: string, b: string): boolean {
  return inicioDoMes(a) === inicioDoMes(b)
}

/** R3: compra até o dia do fechamento cai na fatura do mês; depois dele, na do mês seguinte. */
export function sugerirMesFatura(dataCompra: string, diaFechamento: number = DIA_FECHAMENTO): string {
  const { dia } = separar(dataCompra)
  const mes = inicioDoMes(dataCompra)
  return dia <= diaFechamento ? mes : somarMeses(mes, 1)
}

/** R2: "2026-09-01" → "set/2026". */
export function formatarMesFatura(mesFatura: string): string {
  const { ano, mes } = separar(mesFatura)
  return `${MESES[mes - 1]}/${ano}`
}

/** Valor de um <input type="month"> ("2026-09") → mês da fatura ("2026-09-01"); inválido → null. */
export function lerMes(texto: string): string | null {
  const partes = PADRAO_MES.exec(texto)
  if (!partes) return null
  const mes = Number(partes[2])
  if (mes < 1 || mes > 12) return null
  return `${partes[1]}-${partes[2]}-01`
}

/** Mês da fatura ("2026-09-01") → valor para <input type="month"> e URLs ("2026-09"). */
export function mesParaTexto(mesFatura: string): string {
  return mesFatura.slice(0, 7)
}

/** true só para datas "AAAA-MM-DD" que existem no calendário (30/02 é recusado). */
export function ehDataValida(texto: string): boolean {
  const partes = PADRAO_DATA.exec(texto)
  if (!partes) return false
  const [ano, mes, dia] = [Number(partes[1]), Number(partes[2]), Number(partes[3])]
  // O Date "conserta" datas impossíveis (30/02 vira 02/03); se mudou, era inválida.
  const data = new Date(Date.UTC(ano, mes - 1, dia))
  return data.getUTCFullYear() === ano && data.getUTCMonth() === mes - 1 && data.getUTCDate() === dia
}
