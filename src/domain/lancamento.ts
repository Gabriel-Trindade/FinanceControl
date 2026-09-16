import { mesmoMes } from './datas'

export type Pagamento = 'NAO' | 'SIM' | 'PERDOADO'
export type Situacao = 'A_RECEBER' | 'RECEBIDO' | 'A_ABATER' | 'ABATIDO' | 'PERDOADO'

export const ROTULO_SITUACAO: Record<Situacao, string> = {
  A_RECEBER: 'A RECEBER',
  RECEBIDO: 'RECEBIDO',
  A_ABATER: 'A ABATER',
  ABATIDO: 'ABATIDO',
  PERDOADO: 'PERDOADO',
}

/** Os campos de um lançamento de que as regras precisam. */
export type DadosDaRegra = {
  mesFatura: string
  valorCentavos: number
  parcelaAtual: number
  qtdParcelas: number | null
  recorrente: boolean
  pagamento: Pagamento
}

/** R4 */
export function calcularSubtotal(
  l: Pick<DadosDaRegra, 'valorCentavos' | 'qtdParcelas' | 'recorrente'>,
): number {
  if (l.recorrente || l.qtdParcelas === null) return l.valorCentavos
  return l.qtdParcelas * l.valorCentavos
}

/** R5 */
export function calcularSituacao(l: Pick<DadosDaRegra, 'valorCentavos' | 'pagamento'>): Situacao {
  if (l.pagamento === 'PERDOADO') return 'PERDOADO'
  const pago = l.pagamento === 'SIM'
  if (l.valorCentavos < 0) return pago ? 'ABATIDO' : 'A_ABATER'
  return pago ? 'RECEBIDO' : 'A_RECEBER'
}

/**
 * R6: quanto ainda vai ser cobrado desta compra depois da parcela atual.
 * Só conta na linha do mês de hoje, para a mesma compra não somar várias vezes
 * (cada parcela é uma linha nova por mês). Diferente da planilha, PERDOADO também zera.
 */
export function calcularRestante(l: DadosDaRegra, hoje: string): number {
  if (l.pagamento !== 'NAO' || l.recorrente || l.qtdParcelas === null) return 0
  if (!mesmoMes(l.mesFatura, hoje)) return 0
  return (l.qtdParcelas - l.parcelaAtual) * l.valorCentavos
}

/** Texto curto da parcela para listas: "mensal", "3/10", ou nada para compra à vista. */
export function descreverParcela(
  l: Pick<DadosDaRegra, 'parcelaAtual' | 'qtdParcelas' | 'recorrente'>,
): string {
  if (l.recorrente) return 'mensal'
  if (l.qtdParcelas === null || l.qtdParcelas <= 1) return ''
  return `${l.parcelaAtual}/${l.qtdParcelas}`
}
