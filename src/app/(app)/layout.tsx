import type { ReactNode } from 'react'
import { exigirSessao } from '@/auth/sessao'
import { Navegacao } from '@/components/navegacao'

export default async function LayoutLogado({ children }: { children: ReactNode }) {
  // Reforço: o proxy já barra quem não tem sessão antes de chegar aqui.
  await exigirSessao()

  return (
    <div className="min-h-dvh pb-24 md:pb-0 md:pl-56">
      <Navegacao />
      <main className="mx-auto max-w-3xl p-4">{children}</main>
    </div>
  )
}
