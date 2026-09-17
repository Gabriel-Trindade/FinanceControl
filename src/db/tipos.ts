import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import type * as schema from './schema'

/**
 * Qualquer conexão Drizzle com o nosso schema: Neon em produção, PGlite nos testes.
 * As consultas recebem `db` por parâmetro e não sabem qual dos dois está do outro lado.
 */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>
