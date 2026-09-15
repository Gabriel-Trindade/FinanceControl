import { jwtVerify, SignJWT } from 'jose'

export const VALIDADE_SESSAO_SEGUNDOS = 60 * 60 * 24 * 30

function chave(segredo: string): Uint8Array {
  return new TextEncoder().encode(segredo)
}

export async function criarTokenSessao(
  usuario: string,
  segredo: string,
  agora: Date = new Date(),
): Promise<string> {
  const emitidoEm = Math.floor(agora.getTime() / 1000)
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(usuario)
    .setIssuedAt(emitidoEm)
    .setExpirationTime(emitidoEm + VALIDADE_SESSAO_SEGUNDOS)
    .sign(chave(segredo))
}

/** Devolve o usuário se o token for válido e não expirado; em qualquer outro caso, `null`. */
export async function verificarTokenSessao(
  token: string,
  segredo: string,
  agora: Date = new Date(),
): Promise<{ usuario: string } | null> {
  try {
    const { payload } = await jwtVerify(token, chave(segredo), {
      algorithms: ['HS256'],
      currentDate: agora,
    })
    return typeof payload.sub === 'string' ? { usuario: payload.sub } : null
  } catch {
    return null
  }
}
