import { calcularSituacao, type DadosDaRegra } from './lancamento'

export type TotaisDoMes = { total: number; aReceber: number; aAbater: number }

/** Totais de uma fatura. `aAbater` sai negativo, porque créditos são valores negativos. */
export function calcularTotaisDoMes(
  lancamentos: Pick<DadosDaRegra, 'valorCentavos' | 'pagamento'>[],
): TotaisDoMes {
  const totais: TotaisDoMes = { total: 0, aReceber: 0, aAbater: 0 }
  for (const lancamento of lancamentos) {
    totais.total += lancamento.valorCentavos
    const situacao = calcularSituacao(lancamento)
    if (situacao === 'A_RECEBER') totais.aReceber += lancamento.valorCentavos
    if (situacao === 'A_ABATER') totais.aAbater += lancamento.valorCentavos
  }
  return totais
}
