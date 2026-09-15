import { asc, eq, sql } from 'drizzle-orm'
import { categorias, pessoas } from './schema'
import type { Db } from './tipos'

export type ItemCadastro = { id: number; nome: string }

/** "  Ana   Maria " → "Ana Maria". */
export function normalizarNome(nome: string): string {
  return nome.trim().replace(/\s+/g, ' ')
}

export async function listarPessoasAtivas(db: Db): Promise<ItemCadastro[]> {
  return db
    .select({ id: pessoas.id, nome: pessoas.nome })
    .from(pessoas)
    .where(eq(pessoas.ativo, true))
    .orderBy(asc(pessoas.nome))
}

export async function listarCategoriasAtivas(db: Db): Promise<ItemCadastro[]> {
  return db
    .select({ id: categorias.id, nome: categorias.nome })
    .from(categorias)
    .where(eq(categorias.ativo, true))
    .orderBy(asc(categorias.nome))
}

/**
 * Busca pelo nome (sem diferenciar maiúsculas); se não achar, cria.
 * O `onConflictDoNothing` + nova busca cobre o caso raro de duas requisições
 * criarem o mesmo nome ao mesmo tempo: o índice único impede a duplicata.
 */
async function obterOuCriar(
  nome: string,
  buscar: (nome: string) => Promise<ItemCadastro | undefined>,
  inserir: (nome: string) => Promise<ItemCadastro | undefined>,
): Promise<ItemCadastro> {
  const limpo = normalizarNome(nome)
  if (!limpo) throw new Error('Nome obrigatório')

  const encontrado = (await buscar(limpo)) ?? (await inserir(limpo)) ?? (await buscar(limpo))
  if (!encontrado) throw new Error(`Não foi possível obter ou criar "${limpo}"`)
  return encontrado
}

export function obterOuCriarPessoa(db: Db, nome: string): Promise<ItemCadastro> {
  return obterOuCriar(
    nome,
    async (limpo) =>
      (
        await db
          .select({ id: pessoas.id, nome: pessoas.nome })
          .from(pessoas)
          .where(sql`lower(${pessoas.nome}) = lower(${limpo})`)
          .limit(1)
      )[0],
    async (limpo) =>
      (
        await db
          .insert(pessoas)
          .values({ nome: limpo })
          .onConflictDoNothing()
          .returning({ id: pessoas.id, nome: pessoas.nome })
      )[0],
  )
}

export function obterOuCriarCategoria(db: Db, nome: string): Promise<ItemCadastro> {
  return obterOuCriar(
    nome,
    async (limpo) =>
      (
        await db
          .select({ id: categorias.id, nome: categorias.nome })
          .from(categorias)
          .where(sql`lower(${categorias.nome}) = lower(${limpo})`)
          .limit(1)
      )[0],
    async (limpo) =>
      (
        await db
          .insert(categorias)
          .values({ nome: limpo })
          .onConflictDoNothing()
          .returning({ id: categorias.id, nome: categorias.nome })
      )[0],
  )
}
