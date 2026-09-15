'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { sair } from '@/app/login/actions'

const LINKS = [
  { href: '/lancamentos', rotulo: 'Lançamentos' },
  { href: '/lancamentos/novo', rotulo: '＋ Lançar' },
]

export function Navegacao() {
  const caminho = usePathname()

  return (
    <nav
      aria-label="Principal"
      // No celular fica embaixo; a margem respeita a barra de gestos do iPhone.
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      className="fixed inset-x-0 bottom-0 z-10 flex border-t bg-background md:inset-y-0 md:right-auto md:w-56 md:flex-col md:border-t-0 md:border-r md:p-4"
    >
      {LINKS.map((link) => {
        const ativo = caminho === link.href
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={ativo ? 'page' : undefined}
            className={`flex-1 p-4 text-center text-sm md:flex-none md:rounded-md md:px-3 md:py-2 md:text-left ${
              ativo ? 'font-semibold' : 'text-muted-foreground'
            }`}
          >
            {link.rotulo}
          </Link>
        )
      })}
      <form action={sair} className="flex-1 md:mt-auto md:flex-none">
        <button type="submit" className="w-full p-4 text-sm text-muted-foreground md:px-3 md:py-2 md:text-left">
          Sair
        </button>
      </form>
    </nav>
  )
}
