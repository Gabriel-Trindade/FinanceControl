import { and, asc, eq, inArray, sql } from 'drizzle-orm'
import type { Pagamento } from '@/domain/lancamento'
import { categorias, lancamentos, pessoas } from './schema'
import type { Db } from './tipos'

export type NovoLancamento = {
  mesFatura: string
  dataCompra: string | null
  pessoaId: number
  categoriaId: number
  item: string
  valorCentavos: number
  parcelaAtual: number
  qtdParcelas: number | null
  recorrente: boolean
  pagamento: 'NAO' | 'SIM'
  pagoEm: string | null
}

export type LancamentoDoMes = {
  id: number
  mesFatura: string
  dataCompra: string | null
  pessoaId: number
  pessoa: string
  categoriaId: number
  categoria: string
  item: string
  valorCentavos: number
  parcelaAtual: number
  qtdParcelas: number | null
  recorrente: boolean
  pagamento: Pagamento
  pagoEm: string | null
}

export async function criarLancamento(db: Db, dados: NovoLancamento): Promise<{ id: number }> {
  const [criado] = await db
    .insert(lancamentos)
    .values({ ...dados, fonte: 'manual' })
    .returning({ id: lancamentos.id })
  return criado
}

export async function listarLancamentosDoMes(db: Db, mesFatura: string): Promise<LancamentoDoMes[]> {
  return db
    .select({
      id: lancamentos.id,
      mesFatura: lancamentos.mesFatura,
      dataCompra: lancamentos.dataCompra,
      pessoaId: lancamentos.pessoaId,
      pessoa: pessoas.nome,
      categoriaId: lancamentos.categoriaId,
      categoria: categorias.nome,
      item: lancamentos.item,
      valorCentavos: lancamentos.valorCentavos,
      parcelaAtual: lancamentos.parcelaAtual,
      qtdParcelas: lancamentos.qtdParcelas,
      recorrente: lancamentos.recorrente,
      pagamento: lancamentos.pagamento,
      pagoEm: lancamentos.pagoEm,
    })
    .from(lancamentos)
    .innerJoin(pessoas, eq(lancamentos.pessoaId, pessoas.id))
    .innerJoin(categorias, eq(lancamentos.categoriaId, categorias.id))
    .where(eq(lancamentos.mesFatura, mesFatura))
    .orderBy(asc(pessoas.nome), asc(lancamentos.id))
}

/** Um único UPDATE para todos os ids: o driver HTTP do Neon não faz transação interativa. */
export async function marcarComoRecebidos(db: Db, ids: number[], hoje: string): Promise<number> {
  if (ids.length === 0) return 0
  const alterados = await db
    .update(lancamentos)
    .set({ pagamento: 'SIM', pagoEm: hoje, atualizadoEm: sql`now()` })
    .where(and(inArray(lancamentos.id, ids), eq(lancamentos.pagamento, 'NAO')))
    .returning({ id: lancamentos.id })
  return alterados.length
}
