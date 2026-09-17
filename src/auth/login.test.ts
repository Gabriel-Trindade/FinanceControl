import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { criarBancoDeTeste } from '../../tests/banco-de-teste'
import { tentativasLogin } from '@/db/schema'
import type { Db } from '@/db/tipos'
import { consultarBloqueio, registrarFalha } from './bloqueio'
import { autenticar } from './login'
import { gerarHashSenha } from './senha'

const IP = '203.0.113.7'

describe('autenticar', () => {
  let db: Db
  let fechar: () => Promise<void>
  let esperado: { usuario: string; senhaHash: string }

  beforeAll(async () => {
    esperado = { usuario: 'dono', senhaHash: await gerarHashSenha('senha-certa-123') }
  })

  beforeEach(async () => {
    ;({ db, fechar } = await criarBancoDeTeste())
  })

  afterEach(async () => {
    await fechar()
  })

  it('entra com usuário e senha certos e apaga as falhas anteriores', async () => {
    await registrarFalha(db, IP)

    expect(await autenticar(db, { usuario: 'dono', senha: 'senha-certa-123' }, esperado, IP)).toEqual({ ok: true })

    // Se a falha antiga não tivesse sido apagada, estas 4 completariam 5 e bloqueariam.
    for (let i = 0; i < 4; i++) await registrarFalha(db, IP)
    expect((await consultarBloqueio(db, IP)).bloqueado).toBe(false)
  })

  it.each([
    ['senha errada', { usuario: 'dono', senha: 'senha-errada' }],
    ['usuário errado', { usuario: 'outro', senha: 'senha-certa-123' }],
  ])('recusa %s com mensagem genérica e registra a falha', async (_, credenciais) => {
    expect(await autenticar(db, credenciais, esperado, IP)).toEqual({
      ok: false,
      erro: 'Usuário ou senha incorretos.',
    })
    expect(await db.select().from(tentativasLogin)).toHaveLength(1)
  })

  it('bloqueia depois de 5 falhas, mesmo com a senha certa', async () => {
    for (let i = 0; i < 5; i++) {
      await autenticar(db, { usuario: 'dono', senha: 'senha-errada' }, esperado, IP)
    }

    expect(await autenticar(db, { usuario: 'dono', senha: 'senha-certa-123' }, esperado, IP)).toEqual({
      ok: false,
      erro: 'Muitas tentativas. Tente de novo em 15 minutos.',
    })
  })
})
