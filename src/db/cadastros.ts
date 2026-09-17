import { eq, sql } from 'drizzle-orm'
import { compararNomes } from '@/domain/texto'
import { categorias, pessoas } from './schema'
import type { Db } from './tipos'

export type ItemCadastro = { id: number; nome: string }

/**
 * "  Ana   Maria " → "Ana Maria", já em forma Unicode NFC.
 * O NFC não é enfeite: "é" pode ser gravado como um caractere ou como "e" + acento
 * combinante. São iguais na tela, mas o índice pessoas_nome_unico compara bytes —
 * sem normalizar, o mesmo nome vindo do Excel viraria uma segunda pessoa.
 */
export function normalizarNome(nome: string): string {
  return nome.normalize('NFC').trim().replace(/\s+/g, ' ')
}

/** Pessoas que aparecem nas listas de escolha, em ordem alfabética. */
export async function listarPessoasAtivas(db: Db): Promise<ItemCadastro[]> {
  const linhas = await db
    .select({ id: pessoas.id, nome: pessoas.nome })
    .from(pessoas)
    .where(eq(pessoas.ativo, true))
  // Ordenar aqui, não com ORDER BY: o banco usa collation "C" (ver src/domain/texto.ts).
  return linhas.sort((a, b) => compararNomes(a.nome, b.nome))
}

/** Categorias que aparecem nas listas de escolha, em ordem alfabética. */
export async function listarCategoriasAtivas(db: Db): Promise<ItemCadastro[]> {
  const linhas = await db
    .select({ id: categorias.id, nome: categorias.nome })
    .from(categorias)
    .where(eq(categorias.ativo, true))
  return linhas.sort((a, b) => compararNomes(a.nome, b.nome))
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

/** Devolve a pessoa com esse nome (ignorando maiúsculas) ou cria uma nova. */
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

/** Devolve a categoria com esse nome (ignorando maiúsculas) ou cria uma nova. */
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
