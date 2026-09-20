import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import * as schema from '@/db/schema'
import type { Db } from '@/db/tipos'

/**
 * Cria um Postgres de verdade, só que em memória (PGlite), e aplica as mesmas migrações
 * que vão para produção. Cada teste ganha um banco limpo e nada vai para a internet.
 *
 * `registrarConsultas`: opcional, desligado por padrão (não muda nenhuma chamada
 * existente). Quando ligado, devolve `consultas` com o texto SQL de cada consulta
 * feita **depois** da migração (as da própria migração são descartadas: não são o que
 * o teste quer medir). Existe para provar contagem de idas ao banco — ex.: que
 * resolverCadastros faz uma consulta por nome distinto, não por linha da planilha.
 */
export async function criarBancoDeTeste(
  opcoes: { registrarConsultas?: boolean } = {},
): Promise<{ db: Db; fechar: () => Promise<void>; consultas: string[] }> {
  const consultas: string[] = []
  const cliente = new PGlite()
  const db = drizzle({
    client: cliente,
    schema,
    ...(opcoes.registrarConsultas
      ? { logger: { logQuery: (query: string) => consultas.push(query) } }
      : {}),
  })
  await migrate(db, { migrationsFolder: 'drizzle' })
  consultas.length = 0 // descarta as consultas da própria migração
  return { db, fechar: () => cliente.close(), consultas }
}
