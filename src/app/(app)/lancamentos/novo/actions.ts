'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { exigirSessao } from '@/auth/sessao'
import { obterOuCriarCategoria, obterOuCriarPessoa } from '@/db/cadastros'
import { obterDb } from '@/db/cliente'
import { criarLancamento } from '@/db/lancamentos'
import { hojeEmSaoPaulo, mesParaTexto } from '@/domain/datas'
import { validarFormularioLancamento, type CampoFormulario } from './validacao'

export type ResultadoSalvar =
  | { ok: true }
  | { ok: false; erros: Partial<Record<CampoFormulario, string>>; erroGeral?: string }

export async function salvarLancamento(dados: FormData): Promise<ResultadoSalvar> {
  await exigirSessao()

  const validacao = validarFormularioLancamento(Object.fromEntries(dados), hojeEmSaoPaulo())
  if (!validacao.ok) return { ok: false, erros: validacao.erros }

  const { pessoa, categoria, ...lancamento } = validacao.dados
  try {
    const db = obterDb()
    const [{ id: pessoaId }, { id: categoriaId }] = await Promise.all([
      obterOuCriarPessoa(db, pessoa),
      obterOuCriarCategoria(db, categoria),
    ])
    await criarLancamento(db, { ...lancamento, pessoaId, categoriaId })
  } catch (erro) {
    console.error('Falha ao salvar lançamento', erro)
    return { ok: false, erros: {}, erroGeral: 'Não foi possível salvar. Tente de novo.' }
  }

  revalidatePath('/lancamentos')
  if (dados.get('depois') === 'outro') return { ok: true }
  // redirect fica fora do try: ele funciona lançando uma exceção especial do Next.
  redirect(`/lancamentos?mes=${mesParaTexto(lancamento.mesFatura)}`)
}
