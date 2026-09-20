'use server'

import { revalidatePath } from 'next/cache'
import { exigirSessao } from '@/auth/sessao'
import { obterDb } from '@/db/cliente'
import { codsJaImportados, desfazerImportacao, gravarLote, resolverCadastros } from '@/db/importacao'
import { codsSchema, loteSchema } from './validacao'

/**
 * Quais desses CÓD já existem no banco — a etapa "conferir" da spec §6.5, antes de
 * qualquer gravação. Mesmo só lendo, chama exigirSessao(): a lista de CÓDs importados
 * não é pública, e esta action é um POST que qualquer um pode chamar direto.
 */
export async function conferirCods(
  cods: unknown,
): Promise<{ ok: true; jaImportados: number[] } | { ok: false; erro: string }> {
  await exigirSessao()

  const validado = codsSchema.safeParse(cods)
  if (!validado.success) return { ok: false, erro: validado.error.issues[0].message }

  const existentes = await codsJaImportados(obterDb(), validado.data)
  return { ok: true, jaImportados: [...existentes] }
}

/**
 * Grava um lote (spec §6.6): resolve pessoa/categoria uma vez por nome distinto e insere
 * com ON CONFLICT DO NOTHING. Idempotente — reenviar o mesmo lote não duplica.
 */
export async function gravarLoteAction(
  lote: unknown,
): Promise<{ ok: true; gravados: number } | { ok: false; erro: string }> {
  await exigirSessao()

  const validado = loteSchema.safeParse(lote)
  if (!validado.success) return { ok: false, erro: validado.error.issues[0].message }

  try {
    const db = obterDb()
    const mapas = await resolverCadastros(
      db,
      validado.data.map((l) => l.pessoa),
      validado.data.map((l) => l.categoria),
    )
    const gravados = await gravarLote(db, validado.data, mapas)
    // Sem isto, /lancamentos continuaria mostrando o cache da rota depois de gravar
    // até 4.805 lançamentos novos — o dono não veria nada até navegar de outro jeito.
    revalidatePath('/lancamentos')
    return { ok: true, gravados }
  } catch (erro) {
    // O driver HTTP do Neon não tem transação interativa: se o lote 5 falhar, o banco
    // fica pela metade. Sem este try/catch, a exceção vira erro não tratado de Server
    // Action e a tela perde a leitura inteira do arquivo — o dono teria que reescolher
    // o .xlsx. Com ele, a tela consegue oferecer "tentar de novo" a partir daqui.
    console.error('Falha ao gravar lote da importação', erro)
    return { ok: false, erro: 'Não foi possível gravar este lote. Tente de novo.' }
  }
}

/** Desfaz a importação (spec §6.7): apaga só fonte = 'planilha'. Não toca manual/fatura/virada. */
export async function desfazerAction(): Promise<
  { ok: true; apagados: number } | { ok: false; erro: string }
> {
  await exigirSessao()

  try {
    const apagados = await desfazerImportacao(obterDb())
    revalidatePath('/lancamentos')
    return { ok: true, apagados }
  } catch (erro) {
    console.error('Falha ao desfazer a importação', erro)
    return { ok: false, erro: 'Não foi possível desfazer a importação.' }
  }
}
