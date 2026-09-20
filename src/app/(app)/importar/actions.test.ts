import { revalidatePath } from 'next/cache'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { exigirSessao } from '@/auth/sessao'
import { codsJaImportados, desfazerImportacao, gravarLote, resolverCadastros } from '@/db/importacao'
import type { LancamentoDaPlanilha } from '@/domain/planilha'
import { conferirCods, desfazerAction, gravarLoteAction } from './actions'

// @/auth/sessao usa next/headers e @/db/cliente abre uma conexão real com o Neon — nenhum
// dos dois roda fora de uma requisição Next.js de verdade. Por isso são mockados: o teste
// verifica só o que actions.ts é responsável por fazer (checar sessão, validar, gravar,
// revalidar o cache, não deixar exceção escapar), não o comportamento de cada dependência,
// que já tem teste próprio (Tarefa 9, src/db/importacao.test.ts).
vi.mock('@/auth/sessao', () => ({ exigirSessao: vi.fn() }))
vi.mock('@/db/cliente', () => ({ obterDb: vi.fn(() => ({})) }))
vi.mock('@/db/importacao', () => ({
  codsJaImportados: vi.fn(),
  resolverCadastros: vi.fn(),
  gravarLote: vi.fn(),
  desfazerImportacao: vi.fn(),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

/** Um lançamento válido; os testes alteram só o campo em questão. */
function lancamentoValido(mudancas: Partial<LancamentoDaPlanilha> = {}): LancamentoDaPlanilha {
  return {
    codPlanilha: 1,
    mesFatura: '2026-09-01',
    pessoa: 'Ana',
    categoria: 'Mercado',
    item: 'Compra',
    valorCentavos: 1000,
    parcelaAtual: 1,
    qtdParcelas: 3,
    recorrente: false,
    pagamento: 'NAO',
    ...mudancas,
  }
}

// Limpa só o histórico de chamadas (quantas vezes, com quê), não a implementação padrão
// configurada acima (ex.: obterDb continua devolvendo {}) — cada teste configura por cima,
// com mockResolvedValueOnce, só o retorno que precisa.
beforeEach(() => {
  vi.clearAllMocks()
})

describe('conferirCods', () => {
  it('exige sessão antes de qualquer coisa — inclusive antes de validar', async () => {
    vi.mocked(codsJaImportados).mockResolvedValueOnce(new Set())

    await conferirCods([1, 2, 3])

    expect(vi.mocked(exigirSessao)).toHaveBeenCalled()
  })

  it('recusa entrada inválida sem consultar o banco', async () => {
    const resultado = await conferirCods([0])

    expect(resultado).toEqual({ ok: false, erro: 'CÓD deve ser no mínimo 1' })
    expect(vi.mocked(codsJaImportados)).not.toHaveBeenCalled()
  })

  it('devolve os CÓDs que já existem no banco', async () => {
    vi.mocked(codsJaImportados).mockResolvedValueOnce(new Set([1, 2]))

    const resultado = await conferirCods([1, 2, 3])

    expect(resultado).toEqual({ ok: true, jaImportados: [1, 2] })
  })
})

describe('gravarLoteAction', () => {
  it('exige sessão antes de qualquer coisa', async () => {
    vi.mocked(resolverCadastros).mockResolvedValueOnce({ pessoas: new Map(), categorias: new Map() })
    vi.mocked(gravarLote).mockResolvedValueOnce(1)

    await gravarLoteAction([lancamentoValido()])

    expect(vi.mocked(exigirSessao)).toHaveBeenCalled()
  })

  it('recusa lote inválido sem gravar', async () => {
    const resultado = await gravarLoteAction([lancamentoValido({ codPlanilha: 0 })])

    expect(resultado).toEqual({ ok: false, erro: 'CÓD deve ser no mínimo 1' })
    expect(vi.mocked(gravarLote)).not.toHaveBeenCalled()
  })

  it('grava um lote válido e revalida /lancamentos', async () => {
    vi.mocked(resolverCadastros).mockResolvedValueOnce({ pessoas: new Map(), categorias: new Map() })
    vi.mocked(gravarLote).mockResolvedValueOnce(2)

    const resultado = await gravarLoteAction([lancamentoValido(), lancamentoValido({ codPlanilha: 2 })])

    expect(resultado).toEqual({ ok: true, gravados: 2 })
    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith('/lancamentos')
  })

  it('devolve erro genérico em português quando o banco falha, sem propagar a exceção', async () => {
    vi.mocked(resolverCadastros).mockRejectedValueOnce(new Error('Neon caiu'))

    const resultado = await gravarLoteAction([lancamentoValido()])

    expect(resultado).toEqual({ ok: false, erro: 'Não foi possível gravar este lote. Tente de novo.' })
    expect(vi.mocked(revalidatePath)).not.toHaveBeenCalled()
  })
})

describe('desfazerAction', () => {
  it('exige sessão antes de qualquer coisa', async () => {
    vi.mocked(desfazerImportacao).mockResolvedValueOnce(4805)

    await desfazerAction()

    expect(vi.mocked(exigirSessao)).toHaveBeenCalled()
  })

  it('apaga e revalida /lancamentos', async () => {
    vi.mocked(desfazerImportacao).mockResolvedValueOnce(4805)

    const resultado = await desfazerAction()

    expect(resultado).toEqual({ ok: true, apagados: 4805 })
    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith('/lancamentos')
  })

  it('devolve erro genérico quando falha, sem propagar a exceção', async () => {
    vi.mocked(desfazerImportacao).mockRejectedValueOnce(new Error('Neon caiu'))

    const resultado = await desfazerAction()

    expect(resultado).toEqual({ ok: false, erro: 'Não foi possível desfazer a importação.' })
    expect(vi.mocked(revalidatePath)).not.toHaveBeenCalled()
  })
})
