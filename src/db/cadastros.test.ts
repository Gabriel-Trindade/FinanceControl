import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { criarBancoDeTeste } from '../../tests/banco-de-teste'
import {
  listarCategoriasAtivas,
  listarPessoasAtivas,
  normalizarNome,
  obterOuCriarCategoria,
  obterOuCriarPessoa,
} from './cadastros'
import { pessoas } from './schema'
import type { Db } from './tipos'

describe('normalizarNome', () => {
  it('tira espaços das pontas e junta espaços repetidos', () => {
    expect(normalizarNome('  Ana   Maria ')).toBe('Ana Maria')
  })
})

describe('cadastros no banco', () => {
  let db: Db
  let fechar: () => Promise<void>

  beforeEach(async () => {
    ;({ db, fechar } = await criarBancoDeTeste())
  })

  afterEach(async () => {
    await fechar()
  })

  it('cria a pessoa quando o nome ainda não existe', async () => {
    const ana = await obterOuCriarPessoa(db, '  Ana   Maria ')
    expect(ana).toEqual({ id: expect.any(Number), nome: 'Ana Maria' })
  })

  it('reaproveita a pessoa existente ignorando maiúsculas e minúsculas', async () => {
    const primeira = await obterOuCriarPessoa(db, 'Ana')
    const segunda = await obterOuCriarPessoa(db, 'ANA')
    expect(segunda).toEqual(primeira)
    expect(await listarPessoasAtivas(db)).toHaveLength(1)
  })

  it('recusa nome vazio', async () => {
    await expect(obterOuCriarPessoa(db, '   ')).rejects.toThrow('Nome obrigatório')
  })

  it('lista só as pessoas ativas, em ordem alfabética', async () => {
    await obterOuCriarPessoa(db, 'Carlos')
    const bia = await obterOuCriarPessoa(db, 'Bia')
    await obterOuCriarPessoa(db, 'Ana')
    await db.update(pessoas).set({ ativo: false }).where(eq(pessoas.id, bia.id))

    expect((await listarPessoasAtivas(db)).map((p) => p.nome)).toEqual(['Ana', 'Carlos'])
  })

  it('categorias seguem as mesmas regras', async () => {
    const mercado = await obterOuCriarCategoria(db, 'Mercado')
    expect(await obterOuCriarCategoria(db, 'mercado')).toEqual(mercado)
    expect((await listarCategoriasAtivas(db)).map((c) => c.nome)).toEqual(['Mercado'])
  })
})
