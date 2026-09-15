import 'server-only'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { obterEnv } from '@/env'
import { COOKIE_SESSAO } from './cookie'
import { criarTokenSessao, VALIDADE_SESSAO_SEGUNDOS, verificarTokenSessao } from './token'

export async function iniciarSessao(usuario: string): Promise<void> {
  const token = await criarTokenSessao(usuario, obterEnv().AUTH_SEGREDO)
  const loja = await cookies()
  loja.set(COOKIE_SESSAO, token, {
    httpOnly: true, // o JavaScript da página não consegue ler o cookie
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: VALIDADE_SESSAO_SEGUNDOS,
  })
}

export async function encerrarSessao(): Promise<void> {
  const loja = await cookies()
  loja.delete(COOKIE_SESSAO)
}

export async function obterSessao(): Promise<{ usuario: string } | null> {
  const token = (await cookies()).get(COOKIE_SESSAO)?.value
  if (!token) return null
  const env = obterEnv()
  const sessao = await verificarTokenSessao(token, env.AUTH_SEGREDO)
  // Se o usuário do .env mudar, sessões antigas deixam de valer.
  return sessao?.usuario === env.AUTH_USUARIO ? sessao : null
}

/**
 * Primeira linha de toda Server Action e de todo Route Handler protegido.
 * O proxy protege as páginas, mas uma action é um POST que pode ser chamado direto.
 */
export async function exigirSessao(): Promise<{ usuario: string }> {
  const sessao = await obterSessao()
  if (!sessao) redirect('/login')
  return sessao
}
