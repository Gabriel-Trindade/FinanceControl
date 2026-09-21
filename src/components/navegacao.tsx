'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { List, Plus, Upload } from 'lucide-react'
import { cn } from 'cn'
import { sair } from '@/app/login/actions'

// Três itens neste plano (Plano A1) — não quatro. O painel ("Início") só nasce no Plano A2:
// hoje src/app/page.tsx apenas redireciona para /lancamentos, e como "/" fica FORA do grupo
// (app), esta barra nem é renderizada lá — um item "Início" ficaria com aria-current que
// nunca casa com nada (brief da Tarefa 11, Passo 4).
const LINKS = [
  { href: '/lancamentos', rotulo: 'Lançamentos', Icone: List },
  { href: '/lancamentos/novo', rotulo: 'Lançar', Icone: Plus },
  { href: '/importar', rotulo: 'Importar', Icone: Upload },
] as const

export function Navegacao() {
  const caminho = usePathname()

  return (
    <nav
      aria-label="Principal"
      // No celular fica embaixo; o pb- respeita a barra de gestos do iPhone (precisa de classe, não
      // style inline: style sempre venceria o md:pb-4 e colaria o "Sair" na borda no computador).
      className="fixed inset-x-0 bottom-0 z-10 flex border-t bg-background pb-[env(safe-area-inset-bottom)] md:inset-y-0 md:right-auto md:w-56 md:flex-col md:border-t-0 md:border-r md:p-4 md:pb-4"
    >
      {LINKS.map(({ href, rotulo, Icone }) => {
        const ativo = caminho === href
        return (
          <Link
            key={href}
            href={href}
            aria-current={ativo ? 'page' : undefined}
            // Ícone em cima do texto no celular (padrão de barra inferior), lado a lado no
            // computador. min-h-11: alvo de toque 44px mesmo com padding pequeno (p-2).
            // Ativo se distingue por peso da fonte E cor, nunca só cor (MASTER.md).
            className={cn(
              'flex min-h-11 flex-1 flex-col items-center justify-center gap-1 p-2 text-center text-xs',
              'md:flex-none md:flex-row md:justify-start md:gap-2 md:rounded-md md:px-3 md:py-2 md:text-left md:text-sm',
              ativo ? 'font-semibold text-foreground' : 'text-muted-foreground',
            )}
          >
            <Icone aria-hidden="true" className="size-5 md:size-4" />
            {rotulo}
          </Link>
        )
      })}
      <form action={sair} className="flex-1 md:mt-auto md:flex-none">
        <button
          type="submit"
          // cursor-pointer: <button> nativo não herda a "mão" do navegador como <a> herda
          // (medido na Tarefa 11) — sem isto o botão fica sem sinal de que é clicável.
          className="min-h-11 w-full cursor-pointer p-4 text-sm text-muted-foreground md:px-3 md:py-2 md:text-left"
        >
          Sair
        </button>
      </form>
    </nav>
  )
}
