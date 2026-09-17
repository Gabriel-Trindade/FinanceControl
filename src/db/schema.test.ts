import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { criarBancoDeTeste } from '../../tests/banco-de-teste'
import { categorias, lancamentos, pessoas } from './schema'
import type { Db } from './tipos'

let db: Db
let fechar: () => Promise<void>
let pessoaId: number
let categoriaId: number

beforeEach(async () => {
  ;({ db, fechar } = await criarBancoDeTeste())
  ;[{ id: pessoaId }] = await db.insert(pessoas).values({ nome: 'Pessoa Teste' }).returning({ id: pessoas.id })
  ;[{ id: categoriaId }] = await db
    .insert(categorias)
    .values({ nome: 'Categoria Teste' })
    .returning({ id: categorias.id })
})

afterEach(async () => {
  await fechar()
})

function lancamentoValido() {
  return {
    mesFatura: '2026-09-01',
    pessoaId,
    categoriaId,
    item: 'Compra de teste',
    valorCentavos: 10000,
    parcelaAtual: 1,
    qtdParcelas: 3,
  }
}

describe('schema: restrições do banco', () => {
  it('aceita um lançamento válido com os padrões da spec', async () => {
    const [criado] = await db.insert(lancamentos).values(lancamentoValido()).returning()
    expect(criado.pagamento).toBe('NAO')
    expect(criado.fonte).toBe('manual')
    expect(criado.recorrente).toBe(false)
    expect(criado.pagoEm).toBeNull()
  })

  it('aceita recorrente sem quantidade de parcelas', async () => {
    const [criado] = await db
      .insert(lancamentos)
      .values({ ...lancamentoValido(), recorrente: true, qtdParcelas: null })
      .returning()
    expect(criado.recorrente).toBe(true)
  })

  it.each([
    ['mês da fatura fora do dia 1', { mesFatura: '2026-09-05' }],
    ['parcela maior que a quantidade', { parcelaAtual: 4, qtdParcelas: 3 }],
    ['parcela zero', { parcelaAtual: 0 }],
    ['recorrente com quantidade de parcelas', { recorrente: true, qtdParcelas: 3 }],
    ['não recorrente sem quantidade de parcelas', { qtdParcelas: null }],
    ['pago_em sem pagamento SIM', { pagoEm: '2026-09-14' }],
    ['item vazio', { item: '   ' }],
  ])('recusa %s', async (_, alteracao) => {
    await expect(
      db.insert(lancamentos).values({ ...lancamentoValido(), ...alteracao }),
    ).rejects.toThrow()
  })

  it('recusa pessoa repetida mudando só maiúsculas e minúsculas', async () => {
    await expect(db.insert(pessoas).values({ nome: 'PESSOA TESTE' })).rejects.toThrow()
  })

  it('não deixa excluir pessoa que tem lançamento', async () => {
    await db.insert(lancamentos).values(lancamentoValido())
    await expect(db.delete(pessoas)).rejects.toThrow()
  })
})
