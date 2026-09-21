import { describe, expect, it, vi } from 'vitest'
import { ErroDeLeitura } from '@/importacao/ler-xlsx'
import type { Celula, LancamentoDaPlanilha, ResultadoDaTraducao } from '@/domain/planilha'
import {
  aguardarPintura,
  conferirEmGrupos,
  etapaDaFase,
  fatiar,
  formatarNumero,
  gravarEmSequencia,
  lerEProcessarArquivo,
  montarResumo,
  proximoEstadoAoRetomar,
  separarNovos,
  type FaseErroGravacao,
  type RespostaDaConferencia,
  type RespostaDoLote,
} from './logica'

/** Um lançamento válido; os testes alteram só o campo em questão — mesmo padrão de
 *  actions.test.ts (Tarefa 10), para os dois arquivos lerem parecido. */
function lancamento(mudancas: Partial<LancamentoDaPlanilha> = {}): LancamentoDaPlanilha {
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

describe('fatiar', () => {
  it('devolve lista vazia para entrada vazia', () => {
    expect(fatiar([], 500)).toEqual([])
  })

  it('não cria um pedaço vazio quando o total é múltiplo exato do tamanho', () => {
    const itens = Array.from({ length: 1000 }, (_, i) => i)
    const partes = fatiar(itens, 500)
    expect(partes).toHaveLength(2)
    expect(partes[0]).toHaveLength(500)
    expect(partes[1]).toHaveLength(500)
  })

  it('o último pedaço fica menor quando sobra resto', () => {
    const itens = Array.from({ length: 4805 }, (_, i) => i)
    const partes = fatiar(itens, 500)
    expect(partes).toHaveLength(10)
    expect(partes.slice(0, 9).every((p) => p.length === 500)).toBe(true)
    expect(partes[9]).toHaveLength(305)
  })

  it('preserva a ordem original dentro e entre os pedaços', () => {
    expect(fatiar([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
  })

  it('recusa tamanho zero ou negativo — evitaria um laço infinito em fatiar', () => {
    expect(() => fatiar([1], 0)).toThrow(RangeError)
    expect(() => fatiar([1], -1)).toThrow(RangeError)
  })
})

describe('separarNovos', () => {
  it('mantém só os lançamentos cujo CÓD não está no conjunto de já importados', () => {
    const lancamentos = [lancamento({ codPlanilha: 1 }), lancamento({ codPlanilha: 2 }), lancamento({ codPlanilha: 3 })]

    const novos = separarNovos(lancamentos, new Set([2]))

    expect(novos.map((l) => l.codPlanilha)).toEqual([1, 3])
  })

  it('com o conjunto vazio, devolve todos os lançamentos', () => {
    const lancamentos = [lancamento({ codPlanilha: 1 }), lancamento({ codPlanilha: 2 })]
    expect(separarNovos(lancamentos, new Set())).toHaveLength(2)
  })
})

describe('formatarNumero', () => {
  it('usa ponto como separador de milhar, como o exemplo da spec §6.5', () => {
    expect(formatarNumero(4805)).toBe('4.805')
  })

  it('não adiciona separador abaixo de mil', () => {
    expect(formatarNumero(305)).toBe('305')
  })

  it('funciona para zero', () => {
    expect(formatarNumero(0)).toBe('0')
  })
})

describe('montarResumo', () => {
  it('reproduz o exemplo da spec §6.5: "li 4.805 linhas · 4.802 novas · 0 já importadas · 3 com problema"', () => {
    const resultado: ResultadoDaTraducao = {
      lancamentos: Array.from({ length: 4802 }, (_, i) => lancamento({ codPlanilha: i + 1 })),
      problemas: [
        { linha: 10, motivo: 'CÓD ausente, não numérico ou menor que 1' },
        { linha: 88, motivo: 'ITEM vazio' },
        { linha: 4200, motivo: 'VALOR ausente ou não numérico' },
      ],
      avisos: [],
    }

    const resumo = montarResumo(resultado, new Set())

    expect(resumo).toEqual({ lidas: 4805, novas: 4802, jaImportadas: 0, comProblema: 3 })
  })

  it('linhas com CÓD já no banco contam em jaImportadas e saem de novas', () => {
    const resultado: ResultadoDaTraducao = {
      lancamentos: [lancamento({ codPlanilha: 1 }), lancamento({ codPlanilha: 2 }), lancamento({ codPlanilha: 3 })],
      problemas: [],
      avisos: [],
    }

    const resumo = montarResumo(resultado, new Set([1, 2]))

    expect(resumo).toEqual({ lidas: 3, novas: 1, jaImportadas: 2, comProblema: 0 })
  })
})

describe('etapaDaFase', () => {
  it('mapeia cada fase interna para uma das 4 etapas visíveis do <Estepe>', () => {
    expect(etapaDaFase('escolher')).toBe(0)
    expect(etapaDaFase('lendo')).toBe(0)
    expect(etapaDaFase('conferindo')).toBe(1)
    expect(etapaDaFase('erro-conferencia')).toBe(1)
    expect(etapaDaFase('revisao')).toBe(1)
    expect(etapaDaFase('gravando')).toBe(2)
    expect(etapaDaFase('erro-gravacao')).toBe(2)
    expect(etapaDaFase('relatorio')).toBe(3)
  })
})

// ===== Rodada de correção 1: os laços, testados com dublês (sem sessão, sem banco, sem DOM) =====

describe('conferirEmGrupos', () => {
  it('chama uma vez por grupo, na ordem — não para depois do 1º grupo mesmo quando todos vão bem', async () => {
    // 1.200 CÓDs / 500 por grupo = 3 grupos. Uma mutação que trocasse o laço por "só o
    // primeiro grupo" (ex.: um `break` sem condição) passaria despercebida se o teste só
    // checasse o RESULTADO; por isso a asserção é sobre QUANTAS VEZES `chamar` foi chamado.
    const cods = Array.from({ length: 1200 }, (_, i) => i + 1)
    const chamadas: number[][] = []
    const chamar = vi.fn(async (grupo: number[]): Promise<RespostaDaConferencia> => {
      chamadas.push(grupo)
      return { ok: true, jaImportados: [] }
    })

    const resultado = await conferirEmGrupos(cods, chamar)

    expect(chamar).toHaveBeenCalledTimes(3)
    expect(chamadas.map((g) => g.length)).toEqual([500, 500, 200])
    expect(resultado).toEqual({ ok: true, jaImportados: new Set() })
  })

  it('junta os jaImportados de todos os grupos num Set só', async () => {
    const cods = Array.from({ length: 1000 }, (_, i) => i + 1)
    let chamada = 0
    const chamar = vi.fn(async (): Promise<RespostaDaConferencia> => {
      chamada += 1
      return chamada === 1 ? { ok: true, jaImportados: [1, 2] } : { ok: true, jaImportados: [501, 2] }
    })

    const resultado = await conferirEmGrupos(cods, chamar)

    expect(resultado).toEqual({ ok: true, jaImportados: new Set([1, 2, 501]) })
  })

  it('para no grupo que falhar e NÃO chama os grupos seguintes', async () => {
    const cods = Array.from({ length: 1500 }, (_, i) => i + 1) // 3 grupos
    const chamar = vi.fn(async (grupo: number[]): Promise<RespostaDaConferencia> => {
      if (grupo[0] === 501) return { ok: false, erro: 'Não foi possível conferir os CÓDs. Tente de novo.' }
      return { ok: true, jaImportados: [] }
    })

    const resultado = await conferirEmGrupos(cods, chamar)

    expect(chamar).toHaveBeenCalledTimes(2) // o 1º (ok) e o 2º (falha) — nunca o 3º
    expect(resultado).toEqual({ ok: false, erro: 'Não foi possível conferir os CÓDs. Tente de novo.' })
  })

  it('exceção (ex.: sessão expirada) vira {ok:false} com a exceção crua anexada, não propaga', async () => {
    const excecaoOriginal = new Error('NEXT_REDIRECT')
    const chamar = vi.fn(async (): Promise<RespostaDaConferencia> => {
      throw excecaoOriginal
    })

    const resultado = await conferirEmGrupos([1, 2, 3], chamar)

    expect(resultado.ok).toBe(false)
    expect(resultado as { excecao?: unknown }).toMatchObject({ excecao: excecaoOriginal })
  })
})

describe('gravarEmSequencia', () => {
  function lote(codPlanilha: number): LancamentoDaPlanilha[] {
    return [lancamento({ codPlanilha })]
  }

  it('para no lote que falhar e NÃO continua para o próximo (nunca "continue" depois de erro)', async () => {
    const lotes = [lote(1), lote(2), lote(3)]
    const chamar = vi.fn(async (l: LancamentoDaPlanilha[]): Promise<RespostaDoLote> => {
      if (l[0].codPlanilha === 2) return { ok: false, erro: 'Não foi possível gravar este lote. Tente de novo.' }
      return { ok: true, gravados: 1 }
    })
    const progresso: Array<[number, number]> = []

    const resultado = await gravarEmSequencia(lotes, 0, 0, chamar, (loteAtual, gravados) =>
      progresso.push([loteAtual, gravados]),
    )

    expect(chamar).toHaveBeenCalledTimes(2) // lote 1 (ok) e lote 2 (falha) — nunca o lote 3
    expect(resultado).toEqual({
      ok: false,
      loteAtual: 1,
      gravados: 1,
      erro: 'Não foi possível gravar este lote. Tente de novo.',
    })
    expect(progresso).toEqual([[1, 1]]) // só o progresso do lote 1, que teve sucesso
  })

  it('retomar não perde o que já tinha entrado antes da falha — o bug crítico da revisão', async () => {
    // Cenário exato da revisão: 10 lotes, falha no 5º com 2.000 já gravados (lotes 1-4,
    // 500 cada). Ao retomar do lote 1 com jaGravados=2000 (não zerado), os lotes 1-4 batem
    // no ON CONFLICT DO NOTHING e devolvem 0 cada; só o 5º em diante soma de verdade.
    const lotes = Array.from({ length: 10 }, (_, i) => lote(i + 1))
    const chamar = vi.fn(async (l: LancamentoDaPlanilha[]): Promise<RespostaDoLote> => {
      const indice = l[0].codPlanilha - 1
      return { ok: true, gravados: indice < 4 ? 0 : 500 } // lotes 0-3 já estavam lá; 4-9 são novos
    })

    const resultado = await gravarEmSequencia(lotes, 0, 2000, chamar, () => {})

    expect(resultado).toEqual({ ok: true, gravados: 2000 + 500 * 6 }) // 5.000, não 3.000
  })

  it('exceção vira {ok:false} com loteAtual/gravados até ali, sem propagar', async () => {
    const lotes = [lote(1), lote(2)]
    const excecaoOriginal = new Error('Neon caiu')
    const chamar = vi.fn(async (l: LancamentoDaPlanilha[]): Promise<RespostaDoLote> => {
      if (l[0].codPlanilha === 2) throw excecaoOriginal
      return { ok: true, gravados: 1 }
    })

    const resultado = await gravarEmSequencia(lotes, 0, 0, chamar, () => {})

    expect(resultado).toMatchObject({ ok: false, loteAtual: 1, gravados: 1, excecao: excecaoOriginal })
  })

  it('sem nenhum lote (novas = 0 nunca chega aqui na prática, mas a função não deve travar)', async () => {
    const resultado = await gravarEmSequencia([], 0, 0, vi.fn(), () => {})
    expect(resultado).toEqual({ ok: true, gravados: 0 })
  })
})

describe('lerEProcessarArquivo', () => {
  it('espera a pintura ANTES de ler o arquivo — nunca depois (mutação: remover o await)', async () => {
    // O `await Promise.resolve()` dentro do dublê de aguardarPintura não é enfeite: sem uma
    // pausa assíncrona de verdade aqui, uma função async sem `await` interno roda até o fim
    // de forma SÍNCRONA ao ser chamada, e "esqueceram o await" no chamador não mudaria a
    // ordem observada — a 1ª versão deste teste passava mesmo com a mutação aplicada por
    // esse motivo exato (confirmado rodando a mutação de verdade).
    const ordem: string[] = []
    const deps = {
      aguardarPintura: async () => {
        await Promise.resolve()
        ordem.push('pintura')
      },
      lerPlanilha: async () => {
        ordem.push('leitura')
        return [] as Celula[][]
      },
      traduzirPlanilha: () => ({ lancamentos: [], problemas: [], avisos: [] }) as ResultadoDaTraducao,
    }

    await lerEProcessarArquivo(new File([], 'planilha.xlsx'), deps)

    expect(ordem).toEqual(['pintura', 'leitura'])
  })

  it('sucesso: devolve o resultado de traduzirPlanilha aplicado às linhas lidas', async () => {
    const linhasFalsas: Celula[][] = [[1, 'x']]
    const resultadoFalso: ResultadoDaTraducao = { lancamentos: [lancamento()], problemas: [], avisos: [] }
    const deps = {
      aguardarPintura: async () => {},
      lerPlanilha: async () => linhasFalsas,
      traduzirPlanilha: vi.fn((linhas: Celula[][]) => {
        expect(linhas).toBe(linhasFalsas)
        return resultadoFalso
      }),
    }

    const resultado = await lerEProcessarArquivo(new File([], 'planilha.xlsx'), deps)

    expect(resultado).toEqual({ ok: true, resultado: resultadoFalso })
    expect(deps.traduzirPlanilha).toHaveBeenCalledTimes(1)
  })

  it('ErroDeLeitura vira a mensagem pronta para exibir, já em português', async () => {
    const deps = {
      aguardarPintura: async () => {},
      lerPlanilha: async () => {
        throw new ErroDeLeitura('A planilha não tem a aba "GASTOS".')
      },
      traduzirPlanilha: () => ({ lancamentos: [], problemas: [], avisos: [] }) as ResultadoDaTraducao,
    }

    const resultado = await lerEProcessarArquivo(new File([], 'planilha.xlsx'), deps)

    expect(resultado).toEqual({ ok: false, erro: 'A planilha não tem a aba "GASTOS".' })
  })

  it('erro inesperado (não ErroDeLeitura) vira mensagem genérica', async () => {
    const deps = {
      aguardarPintura: async () => {},
      lerPlanilha: async () => {
        throw new Error('qualquer coisa')
      },
      traduzirPlanilha: () => ({ lancamentos: [], problemas: [], avisos: [] }) as ResultadoDaTraducao,
    }

    const resultado = await lerEProcessarArquivo(new File([], 'planilha.xlsx'), deps)

    expect(resultado).toEqual({ ok: false, erro: 'Não foi possível ler o arquivo.' })
  })
})

describe('aguardarPintura', () => {
  it('só resolve depois de DOIS requestAnimationFrame — o 1º roda antes da pintura, o 2º depois', async () => {
    const callbacks: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      callbacks.push(cb)
      return callbacks.length
    })

    let resolvida = false
    void aguardarPintura().then(() => {
      resolvida = true
    })

    await Promise.resolve()
    expect(callbacks).toHaveLength(1)
    expect(resolvida).toBe(false)

    callbacks[0](0) // dispara o 1º rAF — agenda o 2º
    await Promise.resolve()
    expect(callbacks).toHaveLength(2)
    expect(resolvida).toBe(false) // ainda não: só o 2º rAF resolve a promise

    callbacks[1](0) // dispara o 2º rAF
    await Promise.resolve()
    expect(resolvida).toBe(true)

    vi.unstubAllGlobals()
  })
})

// ===== Rodada de correção 2: a decisão de "retomar" =====

describe('proximoEstadoAoRetomar', () => {
  function estadoComErro(mudancas: Partial<FaseErroGravacao> = {}): FaseErroGravacao {
    return {
      tipo: 'erro-gravacao',
      resultado: { lancamentos: [], problemas: [], avisos: [] },
      jaImportados: new Set(),
      lotes: [[lancamento({ codPlanilha: 1 })], [lancamento({ codPlanilha: 2 })]],
      loteAtual: 4,
      gravados: 2000,
      erro: 'Não foi possível gravar este lote. Tente de novo.',
      ...mudancas,
    }
  }

  it('preserva `gravados` — é o total confirmado antes da falha, não pode voltar a zerar', () => {
    // Este é o teste que faltava na Rodada 1: gravarEmSequencia (testada acima) prova que a
    // SOMA está certa quando jaGravados chega certo; este prova que quem monta o próximo
    // estado de "retomar" PASSA o valor certo. Sem ele, devolver `gravados: 0` para dentro de
    // retomar (assistente.tsx) — o bug crítico original — não derruba teste nenhum, como a
    // re-revisão confirmou rodando essa mutação de verdade.
    const proxima = proximoEstadoAoRetomar(estadoComErro({ gravados: 2000 }))

    expect(proxima.gravados).toBe(2000)
  })

  it('zera loteAtual (refaz do lote 1) e não deixa "erro" pendurado no novo estado', () => {
    const proxima = proximoEstadoAoRetomar(estadoComErro({ loteAtual: 4 }))

    expect(proxima.tipo).toBe('gravando')
    expect(proxima.loteAtual).toBe(0)
    // Não é `{ ...estadoComErro, tipo: 'gravando' }`: um spread levaria o campo `erro` junto
    // (FaseGravando não o declara, mas o objeto em tempo de execução teria o campo do mesmo
    // jeito — achado "Menor" da Rodada 1). O objeto novo, com só os 6 campos que FaseGravando
    // declara, não tem essa sobra.
    expect('erro' in proxima).toBe(false)
  })

  it('mantém resultado, jaImportados e lotes intactos — só loteAtual e o "tipo" mudam', () => {
    const resultado: ResultadoDaTraducao = { lancamentos: [lancamento()], problemas: [], avisos: [] }
    const jaImportados = new Set([1, 2])
    const lotes = [[lancamento({ codPlanilha: 9 })]]

    const proxima = proximoEstadoAoRetomar(estadoComErro({ resultado, jaImportados, lotes }))

    expect(proxima.resultado).toBe(resultado)
    expect(proxima.jaImportados).toBe(jaImportados)
    expect(proxima.lotes).toBe(lotes)
  })
})
