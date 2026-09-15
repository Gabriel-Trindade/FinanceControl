import { redirect } from 'next/navigation'
import { destinoSeguro } from '@/auth/http'
import { obterSessao } from '@/auth/sessao'
import { FormularioLogin } from './formulario-login'

export default async function PaginaLogin({
  searchParams,
}: {
  searchParams: Promise<{ voltar?: string }>
}) {
  const destino = destinoSeguro((await searchParams).voltar)
  if (await obterSessao()) redirect(destino)

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 p-6">
      <h1 className="text-2xl font-semibold">FinanceControl</h1>
      <FormularioLogin voltar={destino} />
    </main>
  )
}
