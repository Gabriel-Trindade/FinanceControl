import { describe, expect, it } from 'vitest'
import { criarBancoDeTeste } from '../../tests/banco-de-teste'
import { obterOuCriarCategoria, obterOuCriarPessoa } from './cadastros'
import { lancamentos } from './schema'
import type { Db } from './tipos'

function valoresDoLancamento(codPlanilha: number | null, pessoaId: number, categoriaId: number) {
  return {
    codPlanilha,
    mesFatura: '2026-09-01',
    pessoaId,
    categoriaId,
    item: 'Compra',
    valorCentavos: 1000,
    parcelaAtual: 1,
    qtdParcelas: 1,
    recorrente: false,
    fonte: 'planilha' as const,
  }
}

async function inserir(db: Db, codPlanilha: number | null) {
  const pessoa = await obterOuCriarPessoa(db, 'Ana')
  const categoria = await obterOuCriarCategoria(db, 'Mercado')
  return db.insert(lancamentos).values(valoresDoLancamento(codPlanilha, pessoa.id, categoria.id))
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

  // Prova o índice em si, não só a constraint: a Tarefa 9 grava em lote com
  // onConflictDoNothing({ target: lancamentos.codPlanilha }), que só funciona se o Postgres
  // achar um índice único cujas colunas casem exatamente com o alvo. Um índice parcial não
  // serve de árbitro aqui (só serviria se a consulta repetisse o WHERE dele), e essa recusa
  // é um erro de execução, não de compilação — os outros dois testes deste arquivo passariam
  // do mesmo jeito com um índice parcial, então só este aqui pega esse regressão.
  it('permite ON CONFLICT (cod_planilha) DO NOTHING — é o que a gravação em lote da Tarefa 9 usa', async () => {
    const { db, fechar } = await criarBancoDeTeste()
    try {
      const pessoa = await obterOuCriarPessoa(db, 'Ana')
      const categoria = await obterOuCriarCategoria(db, 'Mercado')
      await db.insert(lancamentos).values(valoresDoLancamento(42, pessoa.id, categoria.id))

      await db
        .insert(lancamentos)
        .values(valoresDoLancamento(42, pessoa.id, categoria.id))
        .onConflictDoNothing({ target: lancamentos.codPlanilha })

      const linhas = await db.select({ id: lancamentos.id }).from(lancamentos)
      expect(linhas).toHaveLength(1)
    } finally {
      await fechar()
    }
  })

  it('recusa CÓD menor que 1', async () => {
    const { db, fechar } = await criarBancoDeTeste()
    try {
      await expect(inserir(db, 0)).rejects.toMatchObject({
        cause: { constraint: 'lancamentos_cod_planilha_positivo' },
      })
    } finally {
      await fechar()
    }
  })
})
