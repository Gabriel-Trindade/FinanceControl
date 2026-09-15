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

  it('lista só as pessoas ativas, em ordem alfabética em português', async () => {
    // "Carlos" fica inativo no meio da lista; os outros provam que o banco (collation "C")
    // não decide a ordem: "Álvaro" (acentuado) não pode ir para o fim, "bia" (minúsculo)
    // não pode ir para o fim, e "Zé" precisa ficar depois de "bia" mesmo assim.
    const carlos = await obterOuCriarPessoa(db, 'Carlos')
    await obterOuCriarPessoa(db, 'Zé')
    await obterOuCriarPessoa(db, 'bia')
    await obterOuCriarPessoa(db, 'Ana')
    await obterOuCriarPessoa(db, 'Álvaro')
    await db.update(pessoas).set({ ativo: false }).where(eq(pessoas.id, carlos.id))

    expect((await listarPessoasAtivas(db)).map((p) => p.nome)).toEqual([
      'Álvaro',
      'Ana',
      'bia',
      'Zé',
    ])
  })

  it('categorias seguem as mesmas regras', async () => {
    const mercado = await obterOuCriarCategoria(db, 'Mercado')
    expect(await obterOuCriarCategoria(db, 'mercado')).toEqual(mercado)
    expect((await listarCategoriasAtivas(db)).map((c) => c.nome)).toEqual(['Mercado'])
  })
})
