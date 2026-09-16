import { NextRequest } from 'next/server'
import { describe, expect, it, vi } from 'vitest'
import { COOKIE_SESSAO } from '@/auth/cookie'
import { criarTokenSessao } from '@/auth/token'
import { proxy } from './proxy'

// obterEnv() lê e valida process.env na primeira chamada e guarda em cache (src/env.ts). Essa
// primeira chamada acontece dentro de proxy(), então as variáveis precisam existir antes dela —
// por isso vi.stubEnv aqui no topo do arquivo, fora de qualquer `it`/`beforeAll`.
const AUTH_USUARIO = 'dono-teste'
const AUTH_SEGREDO = 'segredo-ficticio-de-teste-com-mais-de-32-caracteres'

vi.stubEnv('DATABASE_URL', 'postgresql://ficticio:ficticio@localhost:5432/ficticio')
vi.stubEnv('AUTH_USUARIO', AUTH_USUARIO)
vi.stubEnv('AUTH_SENHA_HASH', 'scrypt:65536:8:1:c2FsLWZpY3RpY2lv:aGFzaC1maWN0aWNpbw')
vi.stubEnv('AUTH_SEGREDO', AUTH_SEGREDO)

describe('proxy', () => {
  it('sem cookie de sessão redireciona para /login com o destino original', async () => {
    const requisicao = new NextRequest('http://localhost/lancamentos')

    const resposta = await proxy(requisicao)

    expect(resposta.status).toBe(307)
    expect(resposta.headers.get('location')).toContain('/login?voltar=%2Flancamentos')
  })

  it('cookie com token válido do usuário certo deixa passar', async () => {
    const token = await criarTokenSessao(AUTH_USUARIO, AUTH_SEGREDO)
    const requisicao = new NextRequest('http://localhost/lancamentos', {
      headers: { cookie: `${COOKIE_SESSAO}=${token}` },
    })

    const resposta = await proxy(requisicao)

    // NextResponse.next() (node_modules/next/dist/server/web/spec-extension/response.js) marca a
    // resposta com este cabeçalho interno para o runtime do Next saber que deve seguir para a
    // rota pedida, em vez de responder com o conteúdo desta resposta.
    expect(resposta.headers.get('x-middleware-next')).toBe('1')
  })

  it('token válido assinado com outro usuário redireciona para /login', async () => {
    const token = await criarTokenSessao('outro-usuario', AUTH_SEGREDO)
    const requisicao = new NextRequest('http://localhost/lancamentos', {
      headers: { cookie: `${COOKIE_SESSAO}=${token}` },
    })

    const resposta = await proxy(requisicao)

    expect(resposta.status).toBe(307)
    expect(new URL(resposta.headers.get('location') as string).pathname).toBe('/login')
  })
})
