'use client'

import Link from 'next/link'
import { unstable_rethrow } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { ROTULO_SITUACAO, type Situacao } from '@/domain/lancamento'
import { marcarRecebidos } from './actions'

export type LinhaDoMes = { id: number; item: string; detalhe: string; valor: string; situacao: Situacao }

// Cor ajuda a bater o olho, mas o chip sempre mostra o texto: nunca informação só por cor.
const COR_SITUACAO: Record<Situacao, string> = {
  A_RECEBER: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
  RECEBIDO: 'bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-200',
  A_ABATER: 'bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-200',
  ABATIDO: 'bg-neutral-200 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200',
  PERDOADO: 'bg-purple-100 text-purple-900 dark:bg-purple-950 dark:text-purple-200',
}

export function ListaDoMes({ linhas }: { linhas: LinhaDoMes[] }) {
  const [selecionados, setSelecionados] = useState<Set<number>>(new Set())
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, iniciarEnvio] = useTransition()

  if (linhas.length === 0) {
    return (
      <p className="text-muted-foreground">
        Nenhum lançamento nesta fatura.{' '}
        <Link href="/lancamentos/novo" className="underline">
          Lançar agora
        </Link>
      </p>
    )
  }

  function alternar(id: number) {
    setSelecionados((atual) => {
      const novo = new Set(atual)
      if (novo.has(id)) novo.delete(id)
      else novo.add(id)
      return novo
    })
  }

  function marcar() {
    iniciarEnvio(async () => {
      try {
        const resultado = await marcarRecebidos([...selecionados])
        if (resultado.ok) {
          setSelecionados(new Set())
          setErro(null)
        } else {
          setErro(resultado.erro)
        }
      } catch (erro) {
        // O redirect da sessão expirada (exigirSessao, dentro de marcarRecebidos) atravessa a Server
        // Action como um erro especial do Next; unstable_rethrow reconhece esse erro e o relança para
        // o Next terminar a navegação. Qualquer outro erro (rede caiu, deploy novo no ar) segue adiante,
        // sem limpar a seleção: o dono tenta de novo sem perder o que já tinha marcado.
        unstable_rethrow(erro)
        setErro('Não foi possível salvar. Tente de novo.')
        return
      }
    })
  }

  const quantidade = selecionados.size

  return (
    <div className="flex flex-col gap-3">
      <ul className="divide-y rounded-md border">
        {linhas.map((linha) => {
          const emAberto = linha.situacao === 'A_RECEBER' || linha.situacao === 'A_ABATER'
          return (
            <li key={linha.id} className="flex items-center gap-3 p-3">
              <input
                type="checkbox"
                className="size-5"
                aria-label={`Selecionar ${linha.item}`}
                disabled={!emAberto}
                checked={selecionados.has(linha.id)}
                onChange={() => alternar(linha.id)}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{linha.item}</p>
                <p className="truncate text-sm text-muted-foreground">{linha.detalhe}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="font-medium tabular-nums">{linha.valor}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${COR_SITUACAO[linha.situacao]}`}>
                  {ROTULO_SITUACAO[linha.situacao]}
                </span>
              </div>
            </li>
          )
        })}
      </ul>

      {erro && (
        <p role="alert" className="text-sm text-destructive">
          {erro}
        </p>
      )}

      <Button onClick={marcar} disabled={quantidade === 0 || enviando}>
        {enviando ? 'Salvando…' : `Marcar ${quantidade} como recebido${quantidade === 1 ? '' : 's'}`}
      </Button>
    </div>
  )
}
