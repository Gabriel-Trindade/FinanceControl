import { describe, expect, it } from 'vitest'
import { lerEnv } from './env'

const valido = {
  DATABASE_URL: 'postgresql://usuario:senha@host.neon.tech/neondb?sslmode=require',
  AUTH_USUARIO: 'dono',
  AUTH_SENHA_HASH: 'scrypt:65536:8:1:abc:def',
  AUTH_SEGREDO: 'x'.repeat(32),
}

describe('lerEnv', () => {
  it('aceita variáveis válidas', () => {
    expect(lerEnv(valido)).toEqual(valido)
  })

  it('explica cada variável com problema na mesma mensagem', () => {
    let mensagem = ''
    try {
      lerEnv({ ...valido, AUTH_SEGREDO: 'curto', AUTH_USUARIO: undefined })
    } catch (erro) {
      mensagem = (erro as Error).message
    }
    expect(mensagem).toContain('AUTH_SEGREDO')
    expect(mensagem).toContain('AUTH_USUARIO')
  })

  it('recusa hash de senha que não é scrypt', () => {
    expect(() => lerEnv({ ...valido, AUTH_SENHA_HASH: 'bcrypt-abc' })).toThrow('scrypt:')
  })

  it('recusa hash de senha scrypt incompleto', () => {
    expect(() => lerEnv({ ...valido, AUTH_SENHA_HASH: 'scrypt:65536:8:1:abc' })).toThrow('AUTH_SENHA_HASH')
  })
})
