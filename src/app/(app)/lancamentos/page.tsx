import Link from 'next/link'
import { exigirSessao } from '@/auth/sessao'
import { obterDb } from '@/db/cliente'
import { listarLancamentosDoMes } from '@/db/lancamentos'
import { formatarMesFatura, hojeEmSaoPaulo, inicioDoMes, lerMes, mesParaTexto, somarMeses } from '@/domain/datas'
import { formatarReais } from '@/domain/dinheiro'
import { calcularSituacao, descreverParcela } from '@/domain/lancamento'
import { calcularTotaisDoMes } from '@/domain/resumo-do-mes'
import { ListaDoMes, type LinhaDoMes } from './lista-do-mes'

export default async function PaginaLancamentos({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>
}) {
  await exigirSessao()

  // O mês fica na URL (?mes=2026-09): o botão voltar funciona e o link pode ser salvo.
  const mes = lerMes((await searchParams).mes ?? '') ?? inicioDoMes(hojeEmSaoPaulo())
  const lancamentos = await listarLancamentosDoMes(obterDb(), mes)
  const totais = calcularTotaisDoMes(lancamentos)

  const linhas: LinhaDoMes[] = lancamentos.map((l) => ({
    id: l.id,
    item: l.item,
    detalhe: [l.pessoa, l.categoria, descreverParcela(l)].filter(Boolean).join(' · '),
    valor: formatarReais(l.valorCentavos),
    situacao: calcularSituacao(l),
  }))

  const linkDoMes = (deslocamento: number) => `/lancamentos?mes=${mesParaTexto(somarMeses(mes, deslocamento))}`

  return (
    <>
      <header className="mb-4 flex items-center justify-between gap-2">
        <Link href={linkDoMes(-1)} aria-label="Fatura anterior" className="rounded-md px-3 py-2 text-lg">
          ‹
        </Link>
        <h1 className="text-xl font-semibold">Fatura {formatarMesFatura(mes)}</h1>
        <Link href={linkDoMes(1)} aria-label="Próxima fatura" className="rounded-md px-3 py-2 text-lg">
          ›
        </Link>
      </header>

      <dl className="mb-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-md border p-2">
          <dt className="text-xs text-muted-foreground">Total</dt>
          <dd className="font-semibold tabular-nums">{formatarReais(totais.total)}</dd>
        </div>
        <div className="rounded-md border p-2">
          <dt className="text-xs text-muted-foreground">A receber</dt>
          <dd className="font-semibold tabular-nums">{formatarReais(totais.aReceber)}</dd>
        </div>
        <div className="rounded-md border p-2">
          <dt className="text-xs text-muted-foreground">A abater</dt>
          <dd className="font-semibold tabular-nums">{formatarReais(totais.aAbater)}</dd>
        </div>
      </dl>

      {/* key={mes}: ao trocar de mês, a seleção de caixas começa do zero */}
      <ListaDoMes key={mes} linhas={linhas} />
    </>
  )
}
