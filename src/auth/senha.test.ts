import { describe, expect, it } from 'vitest'
import { gerarHashSenha, verificarSenha } from './senha'

describe('senha', () => {
  it('gera hash no formato scrypt:N:r:p:sal:hash, sem o caractere $', async () => {
    const hash = await gerarHashSenha('senha-de-teste')
    expect(hash).toMatch(/^scrypt:\d+:\d+:\d+:[\w-]+:[\w-]+$/)
    expect(hash).not.toContain('$')
  })

  it('aceita a senha certa e recusa a errada', async () => {
    const hash = await gerarHashSenha('senha-de-teste')
    expect(await verificarSenha('senha-de-teste', hash)).toBe(true)
    expect(await verificarSenha('senha-errada', hash)).toBe(false)
  })

  it('usa um sal diferente a cada hash', async () => {
    expect(await gerarHashSenha('mesma-senha')).not.toBe(await gerarHashSenha('mesma-senha'))
  })

  it.each(['', 'texto-qualquer', 'bcrypt:1:2:3:abc:def', 'scrypt:x:8:1:abc:def'])(
    'recusa hash malformado "%s"',
    async (hash) => {
      expect(await verificarSenha('qualquer', hash)).toBe(false)
    },
  )
})
