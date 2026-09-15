import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { criarBancoDeTeste } from '../../tests/banco-de-teste'
import type { Db } from '@/db/tipos'
import { consultarBloqueio, limparFalhas, registrarFalha } from './bloqueio'

const IP = '203.0.113.7'
const agora = new Date('2026-09-14T12:00:00Z')
const minutosAtras = (minutos: number) => new Date(agora.getTime() - minutos * 60_000)

describe('bloqueio de tentativas de login', () => {
  let db: Db
  let fechar: () => Promise<void>

  beforeEach(async () => {
    ;({ db, fechar } = await criarBancoDeTeste())
  })

  afterEach(async () => {
    await fechar()
  })

  async function falhas(...minutos: number[]) {
    for (const m of minutos) await registrarFalha(db, IP, minutosAtras(m))
  }

  it('não bloqueia com 4 falhas na janela', async () => {
    await falhas(0, 1, 2, 3)
    expect(await consultarBloqueio(db, IP, agora)).toEqual({ bloqueado: false, minutosRestantes: 0 })
  })

  it('bloqueia na 5ª falha e diz quanto falta para liberar', async () => {
    await falhas(10, 8, 6, 4, 2)
    // A 5ª falha mais recente foi há 10 minutos: sai da janela de 15 em 5 minutos.
    expect(await consultarBloqueio(db, IP, agora)).toEqual({ bloqueado: true, minutosRestantes: 5 })
  })

  it('ignora falhas com mais de 15 minutos', async () => {
    await falhas(20, 18, 16, 3, 2)
    expect((await consultarBloqueio(db, IP, agora)).bloqueado).toBe(false)
  })

  it('conta cada IP separadamente', async () => {
    await falhas(0, 1, 2, 3, 4)
    expect((await consultarBloqueio(db, '198.51.100.1', agora)).bloqueado).toBe(false)
  })

  it('limpar as falhas desbloqueia o IP', async () => {
    await falhas(0, 1, 2, 3, 4)
    await limparFalhas(db, IP)
    expect((await consultarBloqueio(db, IP, agora)).bloqueado).toBe(false)
  })
})
