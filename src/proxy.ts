import { NextResponse, type NextRequest } from 'next/server'
import { COOKIE_SESSAO } from '@/auth/cookie'
import { verificarTokenSessao } from '@/auth/token'
import { obterEnv } from '@/env'

// No Next 16 o antigo "middleware" se chama "proxy": roda antes de cada rota do matcher.
export async function proxy(requisicao: NextRequest) {
  const token = requisicao.cookies.get(COOKIE_SESSAO)?.value
  const env = obterEnv()
  const sessao = token ? await verificarTokenSessao(token, env.AUTH_SEGREDO) : null
  if (sessao?.usuario === env.AUTH_USUARIO) return NextResponse.next()

  const destino = requisicao.nextUrl.clone()
  destino.pathname = '/login'
  destino.search = `?voltar=${encodeURIComponent(requisicao.nextUrl.pathname + requisicao.nextUrl.search)}`
  return NextResponse.redirect(destino)
}

export const config = {
  // Tudo, menos a tela de login, os arquivos internos do Next e arquivos com extensão (ícones etc.).
  matcher: ['/((?!login|_next/static|_next/image|favicon.ico|.*\\.\\w+$).*)'],
}
