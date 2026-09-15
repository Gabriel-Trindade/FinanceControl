import 'server-only'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { obterEnv } from '@/env'
import * as schema from './schema'
import type { Db } from './tipos'

let db: Db | undefined

/** Conexão HTTP com o Neon, criada na primeira vez que alguém precisa dela. */
export function obterDb(): Db {
  db ??= drizzle({ client: neon(obterEnv().DATABASE_URL), schema })
  return db
}
