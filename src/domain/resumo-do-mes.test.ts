import { describe, expect, it } from 'vitest'
import { calcularTotaisDoMes } from './resumo-do-mes'

describe('calcularTotaisDoMes', () => {
  it('soma tudo, o que falta receber e o que falta abater', () => {
    expect(
      calcularTotaisDoMes([
        { valorCentavos: 10000, pagamento: 'NAO' }, // A RECEBER
        { valorCentavos: 2500, pagamento: 'SIM' }, // RECEBIDO
        { valorCentavos: -1000, pagamento: 'NAO' }, // A ABATER
        { valorCentavos: -500, pagamento: 'SIM' }, // ABATIDO
        { valorCentavos: 3000, pagamento: 'PERDOADO' },
      ]),
    ).toEqual({ total: 14000, aReceber: 10000, aAbater: -1000 })
  })

  it('dá zero em tudo quando o mês está vazio', () => {
    expect(calcularTotaisDoMes([])).toEqual({ total: 0, aReceber: 0, aAbater: 0 })
  })
})
