// renderToStaticMarkup (react-dom/server) em vez de uma vitrine em rota própria — a Rodada de
// correção 1 da Tarefa 11 removeu src/app/importar-preview/ porque ela rodava fora do grupo
// (app) (sem <Navegacao>, sem o pb-24/md:pl-56 do layout) e não afirmava nada, só "não
// explodiu". Isto aqui roda no `environment: 'node'` que o projeto já usa — sem jsdom, sem
// dependência nova — e cada teste é uma afirmação de verdade sobre o HTML gerado.
//
// Limite proposital: renderToStaticMarkup faz um render ÚNICO, sem DOM nem evento — não dá
// para simular clique. Por isso os testes olham o HTML de cada ESTADO (passado por props),
// não uma sequência de interações; é exatamente o que "componente puro" significa aqui.
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { LancamentoDaPlanilha, OcorrenciaDaPlanilha, ResultadoDaTraducao } from '@/domain/planilha'
import {
  AvisoAntesDeComecar,
  Estepe,
  ListaDeOcorrencias,
  PainelDesfazer,
  TelaCarregando,
  TelaErroConferencia,
  TelaErroGravacao,
  TelaEscolher,
  TelaGravando,
  TelaRelatorio,
  TelaRevisao,
} from './componentes'

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

const PROBLEMAS: OcorrenciaDaPlanilha[] = [
  { linha: 10, motivo: 'CÓD ausente, não numérico ou menor que 1' },
  { linha: 88, motivo: 'ITEM vazio' },
]
const AVISOS: OcorrenciaDaPlanilha[] = [{ linha: 12, motivo: 'PARCELA ATUAL era 0, corrigida para 1' }]

const RESULTADO: ResultadoDaTraducao = {
  lancamentos: [lancamento({ codPlanilha: 1 }), lancamento({ codPlanilha: 2 }), lancamento({ codPlanilha: 3 })],
  problemas: PROBLEMAS,
  avisos: AVISOS,
}

function semAcao() {}

describe('Estepe', () => {
  it('marca aria-current="step" só na etapa ativa', () => {
    const html = renderToStaticMarkup(<Estepe atual={1} />)
    // 2 ocorrências de aria-current="step" seria bug (mais de uma etapa "atual" ao mesmo tempo).
    expect(html.match(/aria-current="step"/g)).toHaveLength(1)
  })

  it('cada etapa carrega o nome por extenso para leitor de tela', () => {
    const html = renderToStaticMarkup(<Estepe atual={0} />)
    for (const rotulo of ['Escolher', 'Conferir', 'Gravar', 'Relatório']) {
      expect(html).toContain(rotulo)
    }
  })
})

describe('AvisoAntesDeComecar', () => {
  it('mostra o texto exigido pelo brief, palavra por palavra', () => {
    const html = renderToStaticMarkup(<AvisoAntesDeComecar />)
    expect(html).toContain(
      'Não feche nem saia desta página durante a importação. A planilha é lida no seu aparelho e não fica' +
        ' guardada em lugar nenhum — se você sair, vai precisar escolher o arquivo de novo.',
    )
  })
})

describe('TelaCarregando', () => {
  it('tem role="status" e aria-live="polite", com a mensagem recebida', () => {
    const html = renderToStaticMarkup(<TelaCarregando mensagem="Lendo o arquivo…" />)
    expect(html).toContain('role="status"')
    expect(html).toContain('aria-live="polite"')
    expect(html).toContain('Lendo o arquivo…')
  })
})

describe('TelaErroConferencia', () => {
  it('mostra o erro em role="alert" e o botão de tentar de novo', () => {
    const html = renderToStaticMarkup(
      <TelaErroConferencia erro="Não foi possível conferir os CÓDs. Tente de novo." aoTentarDeNovo={semAcao} />,
    )
    expect(html).toContain('role="alert"')
    expect(html).toContain('Não foi possível conferir os CÓDs. Tente de novo.')
    expect(html).toContain('Tentar de novo')
  })
})

describe('TelaRevisao', () => {
  it('mostra os 4 números formatados em pt-BR e as duas listas', () => {
    const grande: ResultadoDaTraducao = {
      lancamentos: Array.from({ length: 4802 }, (_, i) => lancamento({ codPlanilha: i + 1 })),
      problemas: [{ linha: 10, motivo: 'CÓD ausente, não numérico ou menor que 1' }],
      avisos: [{ linha: 12, motivo: 'PARCELA ATUAL era 0, corrigida para 1' }],
    }
    const html = renderToStaticMarkup(<TelaRevisao resultado={grande} jaImportados={new Set()} aoConfirmar={semAcao} />)
    expect(html).toContain('4.803') // lidas = 4802 + 1 problema
    expect(html).toContain('4.802') // novas
    expect(html).toContain('Problemas')
    expect(html).toContain('Avisos')
    expect(html).toContain('Gravar 4.802 lançamentos')
  })

  it('botão fica no singular para 1 lançamento novo', () => {
    const um: ResultadoDaTraducao = { lancamentos: [lancamento({ codPlanilha: 1 })], problemas: [], avisos: [] }
    const html = renderToStaticMarkup(<TelaRevisao resultado={um} jaImportados={new Set()} aoConfirmar={semAcao} />)
    expect(html).toContain('Gravar 1 lançamento')
    expect(html).not.toContain('Gravar 1 lançamentos')
  })

  it('sem lançamentos novos mas com já importados: mensagem de "tudo já importado", sem botão', () => {
    const html = renderToStaticMarkup(
      <TelaRevisao resultado={RESULTADO} jaImportados={new Set([1, 2, 3])} aoConfirmar={semAcao} />,
    )
    expect(html).toContain('já foram importados')
    expect(html).not.toContain('<button')
  })

  it('planilha sem nenhuma linha de dados: mensagem específica, não a de "confira os problemas"', () => {
    const vazio: ResultadoDaTraducao = { lancamentos: [], problemas: [], avisos: [] }
    const html = renderToStaticMarkup(<TelaRevisao resultado={vazio} jaImportados={new Set()} aoConfirmar={semAcao} />)
    expect(html).toContain('não tem nenhuma linha de dados')
  })

  it('todas as linhas com problema: mensagem aponta para a lista, que existe de verdade', () => {
    const soProblemas: ResultadoDaTraducao = {
      lancamentos: [],
      problemas: [{ linha: 5, motivo: 'ITEM vazio' }],
      avisos: [],
    }
    const html = renderToStaticMarkup(
      <TelaRevisao resultado={soProblemas} jaImportados={new Set()} aoConfirmar={semAcao} />,
    )
    expect(html).toContain('confira a lista de problemas acima')
    expect(html).toContain('Problemas')
    expect(html).toContain('ITEM vazio')
  })
})

describe('ListaDeOcorrencias', () => {
  it('sem botão "mostrar todas" quando cabe tudo (até 15)', () => {
    const html = renderToStaticMarkup(<ListaDeOcorrencias titulo="Avisos" tom="aviso" itens={AVISOS} />)
    expect(html).not.toContain('Mostrar todas')
  })

  it('com mais de 15 itens, mostra só 15 e o botão para expandir, com aria-expanded="false"', () => {
    const muitos = Array.from({ length: 22 }, (_, i) => ({ linha: 100 + i, motivo: 'ITEM vazio' }))
    const html = renderToStaticMarkup(<ListaDeOcorrencias titulo="Problemas" tom="problema" itens={muitos} />)
    // "ocorrências", não "linhas": um aviso conta OCORRÊNCIAS, não linhas distintas — uma
    // linha com valor de três casas E SUBTOTAL divergente gera dois avisos (achado da
    // revisão final do branch). "linhas" prometia um número que a lista não entrega.
    expect(html).toContain('Mostrar todas as 22 ocorrências')
    expect(html).not.toContain('linhas')
    expect(html).toContain('aria-expanded="false"')
    expect(html.match(/Linha \d+:/g)).toHaveLength(15)
  })
})

describe('TelaGravando', () => {
  it('loteAtual=0 mostra "Lote 1 de 10" no texto — não "Lote 0 de 10" (Importante 1)', () => {
    const html = renderToStaticMarkup(<TelaGravando loteAtual={0} totalLotes={10} gravados={0} />)
    expect(html).toContain('Lote 1 de 10')
    expect(html).not.toContain('Lote 0 de 10')
  })

  it('loteAtual=9 de 10 (último lote em voo) mostra "Lote 10 de 10", não passa do total', () => {
    const html = renderToStaticMarkup(<TelaGravando loteAtual={9} totalLotes={10} gravados={4500} />)
    expect(html).toContain('Lote 10 de 10')
  })

  it('o <progress> usa loteAtual (concluídos) no value, não o +1 do texto', () => {
    const html = renderToStaticMarkup(<TelaGravando loteAtual={4} totalLotes={10} gravados={2000} />)
    expect(html).toContain('value="4"')
    expect(html).toContain('max="10"')
    expect(html).toContain('2.000')
  })

  it('aria-live/aria-atomic cobrem só o status+progresso — o aviso estático fica fora', () => {
    const html = renderToStaticMarkup(<TelaGravando loteAtual={4} totalLotes={10} gravados={2000} />)
    // [\s\S] em vez de "." com a flag /s (dotAll): o target ES2017 do tsconfig não tem dotAll
    // (só a partir de ES2018) — [\s\S] é o jeito compatível de casar "qualquer caractere,
    // inclusive quebra de linha" sem depender dessa flag.
    const regiaoViva = html.match(/<div role="status"[^>]*>[\s\S]*?<\/div>/)?.[0] ?? ''
    expect(regiaoViva).toContain('aria-live="polite"')
    expect(regiaoViva).toContain('aria-atomic="true"')
    expect(regiaoViva).not.toContain('Não feche')
    expect(html).toContain('Não feche nem saia desta página até terminar.')
  })
})

describe('TelaErroGravacao', () => {
  it('mostra quantos foram gravados, em qual lote, e o botão Retomar', () => {
    const html = renderToStaticMarkup(
      <TelaErroGravacao
        totalLotes={10}
        loteAtual={4}
        gravados={2000}
        erro="Não foi possível gravar este lote. Tente de novo."
        aoRetomar={semAcao}
      />,
    )
    expect(html).toContain('role="alert"')
    expect(html).toContain('2.000')
    expect(html).toContain('Retomar')
  })
})

describe('TelaRelatorio', () => {
  it('link "Ver lançamentos" aponta para /lancamentos', () => {
    const html = renderToStaticMarkup(
      <TelaRelatorio
        gravados={4802}
        problemas={[]}
        avisos={[]}
        estadoDesfazer={{ tipo: 'ocioso' }}
        aoConfirmarDesfazer={semAcao}
      />,
    )
    expect(html).toContain('href="/lancamentos"')
    expect(html).toContain('4.802')
  })
})

describe('TelaEscolher', () => {
  it('erro do seletor de arquivo liga aria-invalid e aria-describedby ao id da mensagem', () => {
    const html = renderToStaticMarkup(
      <TelaEscolher
        erro='A planilha não tem a aba "GASTOS".'
        aoEscolherArquivo={semAcao}
        estadoDesfazer={{ tipo: 'ocioso' }}
        aoConfirmarDesfazer={semAcao}
      />,
    )
    expect(html).toContain('aria-invalid="true"')
    expect(html).toContain('aria-describedby="erro-arquivo"')
    expect(html).toContain('id="erro-arquivo"')
  })
})

describe('PainelDesfazer', () => {
  it('fechado por padrão: só o gatilho discreto, sem o campo APAGAR', () => {
    const html = renderToStaticMarkup(<PainelDesfazer estado={{ tipo: 'ocioso' }} aoConfirmar={semAcao} />)
    expect(html).toContain('Desfazer importação')
    expect(html).not.toContain('confirmar-apagar')
  })

  it('aberto: mostra o campo APAGAR, o texto honesto (sem número) e o rótulo genérico do botão', () => {
    const html = renderToStaticMarkup(
      <PainelDesfazer estado={{ tipo: 'ocioso' }} aoConfirmar={semAcao} abertoInicial />,
    )
    expect(html).toContain('id="confirmar-apagar"')
    expect(html).toContain('Não dá para saber o número exato antes de confirmar')
    expect(html).toContain('Apagar os lançamentos importados')
    // Nenhum número de lançamentos prometido antes de confirmar (Importante 4).
    expect(html).not.toMatch(/Apagar \d/)
  })

  it('estado apagando: botão desabilitado mesmo com "APAGAR" (não dá para simular digitação, mas o disabled já é por apagando)', () => {
    const html = renderToStaticMarkup(
      <PainelDesfazer estado={{ tipo: 'apagando' }} aoConfirmar={semAcao} abertoInicial />,
    )
    expect(html).toContain('Apagando…')
    expect(html).toContain('disabled=""')
  })

  it('estado erro: mostra role="alert" com a mensagem', () => {
    const html = renderToStaticMarkup(
      <PainelDesfazer
        estado={{ tipo: 'erro', erro: 'Não foi possível desfazer a importação.' }}
        aoConfirmar={semAcao}
        abertoInicial
      />,
    )
    expect(html).toContain('role="alert"')
    expect(html).toContain('Não foi possível desfazer a importação.')
  })

  it('estado apagado: mostra o resultado real em role="status", sem o campo APAGAR', () => {
    const html = renderToStaticMarkup(
      <PainelDesfazer estado={{ tipo: 'apagado', apagados: 4805 }} aoConfirmar={semAcao} />,
    )
    expect(html).toContain('role="status"')
    expect(html).toContain('4.805 lançamentos apagados')
    expect(html).not.toContain('confirmar-apagar')
  })
})

describe('regressão: nenhum bg-situacao- em nenhuma tela', () => {
  it('chip de situação é borda+texto, nunca preenchimento tingido (Tarefa 3)', () => {
    const telas = [
      renderToStaticMarkup(<TelaRevisao resultado={RESULTADO} jaImportados={new Set()} aoConfirmar={semAcao} />),
      renderToStaticMarkup(<TelaGravando loteAtual={4} totalLotes={10} gravados={2000} />),
      renderToStaticMarkup(
        <TelaRelatorio
          gravados={4802}
          problemas={PROBLEMAS}
          avisos={AVISOS}
          estadoDesfazer={{ tipo: 'ocioso' }}
          aoConfirmarDesfazer={semAcao}
        />,
      ),
    ].join('\n')
    expect(telas).not.toContain('bg-situacao-')
  })
})
