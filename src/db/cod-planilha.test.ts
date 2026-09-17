import { describe, expect, it } from 'vitest'
import { criarBancoDeTeste } from '../../tests/banco-de-teste'
import { obterOuCriarCategoria, obterOuCriarPessoa } from './cadastros'
import { lancamentos } from './schema'
import type { Db } from './tipos'

async function inserir(db: Db, codPlanilha: number | null) {
  const pessoa = await obterOuCriarPessoa(db, 'Ana')
  const categoria = await obterOuCriarCategoria(db, 'Mercado')
  return db.insert(lancamentos).values({
    codPlanilha,
    mesFatura: '2026-09-01',
    pessoaId: pessoa.id,
    categoriaId: categoria.id,
    item: 'Compra',
    valorCentavos: 1000,
    parcelaAtual: 1,
    qtdParcelas: 1,
    recorrente: false,
    fonte: 'planilha',
  })
}

describe('cod_planilha', () => {
  it('recusa dois lançamentos com o mesmo CÓD', async () => {
    const { db, fechar } = await criarBancoDeTeste()
    try {
      await inserir(db, 42)
      await expect(inserir(db, 42)).rejects.toMatchObject({
        cause: { constraint: 'lancamentos_cod_planilha_unico' },
      })
    } finally {
      await fechar()
    }
  })

  it('aceita vários lançamentos manuais sem CÓD', async () => {
    const { db, fechar } = await criarBancoDeTeste()
    try {
      await inserir(db, null)
      await inserir(db, null)
      const linhas = await db.select({ id: lancamentos.id }).from(lancamentos)
      expect(linhas).toHaveLength(2)
    } finally {
      await fechar()
    }
  })
})
