import { z } from 'zod'
import { ehDataValida, lerMes } from '@/domain/datas'
import { paraCentavos } from '@/domain/dinheiro'

export type CampoFormulario =
  | 'pessoa'
  | 'categoria'
  | 'item'
  | 'valor'
  | 'dataCompra'
  | 'mesFatura'
  | 'parcelaAtual'
  | 'qtdParcelas'

export type LancamentoValidado = {
  pessoa: string
  categoria: string
  item: string
  valorCentavos: number
  dataCompra: string
  mesFatura: string
  parcelaAtual: number
  qtdParcelas: number | null
  recorrente: boolean
  pagamento: 'NAO' | 'SIM'
  pagoEm: string | null
}

type Erros = Partial<Record<CampoFormulario, string>>

const esquema = z.object({
  pessoa: z.string().trim().min(1, 'Informe a pessoa'),
  categoria: z.string().trim().min(1, 'Informe a categoria'),
  item: z.string().trim().min(1, 'Informe o item'),
  valor: z.string().refine((texto) => {
    const centavos = paraCentavos(texto)
    return centavos !== null && centavos !== 0
  }, 'Valor inválido: use o formato 1.234,56'),
  credito: z.string().optional(),
  dataCompra: z.string().refine(ehDataValida, 'Data da compra inválida'),
  mesFatura: z.string().refine((texto) => lerMes(texto) !== null, 'Mês da fatura inválido'),
  parcelaAtual: z.coerce.number().int('Use um número inteiro').min(1, 'A parcela começa em 1').max(99, 'No máximo 99'),
  qtdParcelas: z.coerce.number().int('Use um número inteiro').min(1, 'No mínimo 1').max(99, 'No máximo 99').optional(),
  recorrente: z.string().optional(),
  recebido: z.string().optional(),
})

/** Recebe os campos do formulário (texto) e devolve os dados prontos para o banco, ou os erros por campo. */
export function validarFormularioLancamento(
  entrada: Record<string, FormDataEntryValue | undefined>,
  hoje: string,
): { ok: true; dados: LancamentoValidado } | { ok: false; erros: Erros } {
  const resultado = esquema.safeParse(entrada)
  const erros: Erros = {}

  if (!resultado.success) {
    for (const problema of resultado.error.issues) {
      const campo = problema.path[0] as CampoFormulario
      erros[campo] ??= problema.message
    }
    return { ok: false, erros }
  }

  const d = resultado.data
  const recorrente = d.recorrente === 'on'
  if (!recorrente && d.qtdParcelas === undefined) erros.qtdParcelas = 'Informe a quantidade de parcelas'
  if (!recorrente && d.qtdParcelas !== undefined && d.parcelaAtual > d.qtdParcelas) {
    erros.parcelaAtual = 'A parcela não pode passar da quantidade'
  }
  if (Object.keys(erros).length > 0) return { ok: false, erros }

  // O refine acima já garantiu que estes valores existem.
  const centavos = paraCentavos(d.valor) as number
  const recebido = d.recebido === 'on'

  return {
    ok: true,
    dados: {
      pessoa: d.pessoa,
      categoria: d.categoria,
      item: d.item,
      valorCentavos: d.credito === 'on' ? -Math.abs(centavos) : centavos,
      dataCompra: d.dataCompra,
      mesFatura: lerMes(d.mesFatura) as string,
      parcelaAtual: d.parcelaAtual,
      qtdParcelas: recorrente ? null : (d.qtdParcelas as number),
      recorrente,
      pagamento: recebido ? 'SIM' : 'NAO',
      pagoEm: recebido ? hoje : null,
    },
  }
}
