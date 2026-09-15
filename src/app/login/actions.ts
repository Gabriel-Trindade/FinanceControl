'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { destinoSeguro, obterIp } from '@/auth/http'
import { autenticar } from '@/auth/login'
import { encerrarSessao, iniciarSessao } from '@/auth/sessao'
import { obterDb } from '@/db/cliente'
import { obterEnv } from '@/env'

export type EstadoLogin = { erro: string | null }

// entrar e sair são as únicas actions sem exigirSessao(): entrar cria a sessão, sair a encerra.
export async function entrar(_anterior: EstadoLogin, dados: FormData): Promise<EstadoLogin> {
  const env = obterEnv()
  const usuario = String(dados.get('usuario') ?? '').trim()
  const resultado = await autenticar(
    obterDb(),
    { usuario, senha: String(dados.get('senha') ?? '') },
    { usuario: env.AUTH_USUARIO, senhaHash: env.AUTH_SENHA_HASH },
    obterIp(await headers()),
  )
  if (!resultado.ok) return { erro: resultado.erro }

  await iniciarSessao(usuario)
  redirect(destinoSeguro(String(dados.get('voltar') ?? '')))
}

export async function sair(): Promise<void> {
  await encerrarSessao()
  redirect('/login')
}
