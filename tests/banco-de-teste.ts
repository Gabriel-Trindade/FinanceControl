import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import * as schema from '@/db/schema'
import type { Db } from '@/db/tipos'

/**
 * Cria um Postgres de verdade, só que em memória (PGlite), e aplica as mesmas migrações
 * que vão para produção. Cada teste ganha um banco limpo e nada vai para a internet.
 */
export async function criarBancoDeTeste(): Promise<{ db: Db; fechar: () => Promise<void> }> {
  const cliente = new PGlite()
  const db = drizzle({ client: cliente, schema })
  await migrate(db, { migrationsFolder: 'drizzle' })
  return { db, fechar: () => cliente.close() }
}
