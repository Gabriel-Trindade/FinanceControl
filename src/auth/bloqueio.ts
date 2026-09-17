import { and, desc, eq, gt } from 'drizzle-orm'
import { tentativasLogin } from '@/db/schema'
import type { Db } from '@/db/tipos'

export const MAX_TENTATIVAS = 5
export const JANELA_MINUTOS = 15

const JANELA_MS = JANELA_MINUTOS * 60_000

export type SituacaoBloqueio = { bloqueado: boolean; minutosRestantes: number }

/** Guarda uma tentativa de login errada vinda deste IP. */
export async function registrarFalha(db: Db, ip: string, agora: Date = new Date()): Promise<void> {
  await db.insert(tentativasLogin).values({ ip, criadoEm: agora })
}

/** Bloqueado enquanto houver 5 falhas nos últimos 15 minutos (janela deslizante). */
export async function consultarBloqueio(
  db: Db,
  ip: string,
  agora: Date = new Date(),
): Promise<SituacaoBloqueio> {
  const recentes = await db
    .select({ criadoEm: tentativasLogin.criadoEm })
    .from(tentativasLogin)
    .where(and(eq(tentativasLogin.ip, ip), gt(tentativasLogin.criadoEm, new Date(agora.getTime() - JANELA_MS))))
    .orderBy(desc(tentativasLogin.criadoEm))
    .limit(MAX_TENTATIVAS)

  if (recentes.length < MAX_TENTATIVAS) return { bloqueado: false, minutosRestantes: 0 }

  // Libera quando a 5ª falha mais recente sair da janela.
  const liberaEm = recentes[MAX_TENTATIVAS - 1].criadoEm.getTime() + JANELA_MS
  return {
    bloqueado: true,
    minutosRestantes: Math.max(1, Math.ceil((liberaEm - agora.getTime()) / 60_000)),
  }
}

/** Apaga as falhas deste IP (chamado depois de um login certo). */
export async function limparFalhas(db: Db, ip: string): Promise<void> {
  await db.delete(tentativasLogin).where(eq(tentativasLogin.ip, ip))
}
