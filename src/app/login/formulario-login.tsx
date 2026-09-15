'use client'

import { useActionState } from 'react'
import { entrar, type EstadoLogin } from './actions'

const estadoInicial: EstadoLogin = { erro: null }

export function FormularioLogin({ voltar }: { voltar: string }) {
  const [estado, acao, enviando] = useActionState(entrar, estadoInicial)

  return (
    <form action={acao} className="flex flex-col gap-4">
      <input type="hidden" name="voltar" value={voltar} />
      <label className="flex flex-col gap-1 text-sm">
        Usuário
        {/* text-base (16px) evita o zoom automático do iPhone ao tocar no campo */}
        <input name="usuario" autoComplete="username" required className="rounded-md border px-3 py-2 text-base" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Senha
        <input
          name="senha"
          type="password"
          autoComplete="current-password"
          required
          className="rounded-md border px-3 py-2 text-base"
        />
      </label>
      {estado.erro && (
        <p role="alert" className="text-sm text-red-600">
          {estado.erro}
        </p>
      )}
      <button
        type="submit"
        disabled={enviando}
        className="rounded-md bg-neutral-900 px-3 py-2 text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
      >
        {enviando ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  )
}
