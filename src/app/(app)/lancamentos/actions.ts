'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { exigirSessao } from '@/auth/sessao'
import { obterDb } from '@/db/cliente'
import { marcarComoRecebidos } from '@/db/lancamentos'
import { hojeEmSaoPaulo } from '@/domain/datas'

// A action recebe dados de fora (qualquer um pode fazer POST): valida mesmo vindo da nossa tela.
const idsValidos = z.array(z.number().int().positive()).min(1).max(500)

export async function marcarRecebidos(
  ids: number[],
): Promise<{ ok: true; alterados: number } | { ok: false; erro: string }> {
  await exigirSessao()

  const validacao = idsValidos.safeParse(ids)
  if (!validacao.success) return { ok: false, erro: 'Selecione pelo menos um lançamento.' }

  try {
    const alterados = await marcarComoRecebidos(obterDb(), validacao.data, hojeEmSaoPaulo())
    revalidatePath('/lancamentos')
    return { ok: true, alterados }
  } catch (erro) {
    console.error('Falha ao marcar lançamentos como recebidos', erro)
    return { ok: false, erro: 'Não foi possível salvar. Tente de novo.' }
  }
}
