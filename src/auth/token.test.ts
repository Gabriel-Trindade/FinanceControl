import { describe, expect, it } from 'vitest'
import { criarTokenSessao, verificarTokenSessao } from './token'

const SEGREDO = 'segredo-de-teste-com-mais-de-32-caracteres'

describe('token de sessão', () => {
  it('cria e verifica o token do usuário', async () => {
    const token = await criarTokenSessao('dono', SEGREDO)
    expect(await verificarTokenSessao(token, SEGREDO)).toEqual({ usuario: 'dono' })
  })

  it('recusa token assinado com outro segredo', async () => {
    const token = await criarTokenSessao('dono', 'outro-segredo-com-mais-de-32-caracteres!!')
    expect(await verificarTokenSessao(token, SEGREDO)).toBeNull()
  })

  it('recusa token com o conteúdo adulterado', async () => {
    const [cabecalho, , assinatura] = (await criarTokenSessao('dono', SEGREDO)).split('.')
    const conteudoFalso = Buffer.from(
      JSON.stringify({ sub: 'invasor', iat: 0, exp: 9999999999 }),
    ).toString('base64url')
    expect(await verificarTokenSessao(`${cabecalho}.${conteudoFalso}.${assinatura}`, SEGREDO)).toBeNull()
  })

  it('vale por 30 dias e depois expira', async () => {
    const token = await criarTokenSessao('dono', SEGREDO, new Date('2026-09-01T12:00:00Z'))
    expect(await verificarTokenSessao(token, SEGREDO, new Date('2026-09-30T12:00:00Z'))).toEqual({
      usuario: 'dono',
    })
    expect(await verificarTokenSessao(token, SEGREDO, new Date('2026-10-02T12:00:00Z'))).toBeNull()
  })

  it('recusa texto que não é token', async () => {
    expect(await verificarTokenSessao('isto-nao-e-um-jwt', SEGREDO)).toBeNull()
  })
})
