'use client'

import { useEffect, useRef, useState } from 'react'
import { unstable_rethrow } from 'next/navigation'
import { lerPlanilha } from '@/importacao/ler-xlsx'
import { TAMANHO_DO_LOTE } from '@/importacao/lotes'
import { traduzirPlanilha, type ResultadoDaTraducao } from '@/domain/planilha'
import { conferirCods, desfazerAction, gravarLoteAction } from './actions'
import {
  Estepe,
  TelaCarregando,
  TelaEscolher,
  TelaErroConferencia,
  TelaErroGravacao,
  TelaGravando,
  TelaRelatorio,
  TelaRevisao,
} from './componentes'
import {
  aguardarPintura,
  conferirEmGrupos,
  etapaDaFase,
  fatiar,
  gravarEmSequencia,
  lerEProcessarArquivo,
  proximoEstadoAoRetomar,
  separarNovos,
  type EstadoDesfazer,
  type Fase,
  type FaseErroGravacao,
  type FaseGravando,
} from './logica'

const TITULOS: Record<Fase['tipo'], string> = {
  escolher: 'Escolher arquivo',
  lendo: 'Lendo o arquivo',
  conferindo: 'Conferindo',
  'erro-conferencia': 'Não foi possível conferir',
  revisao: 'Conferir antes de gravar',
  gravando: 'Gravando',
  'erro-gravacao': 'Não foi possível gravar um lote',
  relatorio: 'Relatório',
}

export function Assistente() {
  const [fase, setFase] = useState<Fase>({ tipo: 'escolher', erro: null })
  const [estadoDesfazer, setEstadoDesfazer] = useState<EstadoDesfazer>({ tipo: 'ocioso' })

  // Move o foco para o título da etapa nova a cada TROCA de etapa — não no carregamento da
  // página (atrapalharia quem já ia tabular direto até o seletor de arquivo) nem a cada
  // "tick" de progresso do gravando (loteAtual muda, mas fase.tipo continua "gravando": o
  // efeito é disparado por fase.tipo, não pelo objeto fase inteiro, então não repete).
  const tituloRef = useRef<HTMLHeadingElement>(null)
  const primeiraRenderizacao = useRef(true)
  useEffect(() => {
    if (primeiraRenderizacao.current) {
      primeiraRenderizacao.current = false
      return
    }
    tituloRef.current?.focus()
  }, [fase.tipo])

  async function conferir(resultado: ResultadoDaTraducao) {
    // Sequencial de propósito: o codsSchema aceita no máximo TAMANHO_DO_LOTE (500) CÓDs por
    // chamada, e os 4.805 da planilha real não cabem numa só (revisão da Tarefa 10). Também
    // não valeria paralelizar com Promise.all — o Next despacha Server Actions uma de cada vez
    // por cliente (node_modules/next/dist/docs/01-app/02-guides/server-actions.md, "Sequential
    // dispatch on the client") — conferirEmGrupos (logica.ts) já faz isso sequencialmente.
    const resposta = await conferirEmGrupos(resultado.lancamentos.map((l) => l.codPlanilha), conferirCods)
    if (!resposta.ok) {
      // unstable_rethrow deixa o erro especial de sessão expirada (next/navigation) atravessar
      // para o Next terminar o redirect; qualquer outro erro (rede caiu) só vira a tela de erro.
      unstable_rethrow(resposta.excecao)
      setFase({ tipo: 'erro-conferencia', resultado, erro: resposta.erro })
      return
    }
    setFase({ tipo: 'revisao', resultado, jaImportados: resposta.jaImportados })
  }

  function reconferir(resultado: ResultadoDaTraducao) {
    setFase({ tipo: 'conferindo', resultado })
    void conferir(resultado)
  }

  async function aoEscolherArquivo(arquivo: File) {
    // Reinicia o painel de desfazer: sem isto, desfazer na etapa 1 e depois escolher um
    // arquivo novo deixaria "4.802 apagados" (ou um erro velho) preso na tela até o relatório
    // seguinte, contando uma história que não é mais a de agora.
    setEstadoDesfazer({ tipo: 'ocioso' })
    setFase({ tipo: 'lendo' })

    const processado = await lerEProcessarArquivo(arquivo, { aguardarPintura, lerPlanilha, traduzirPlanilha })
    if (!processado.ok) {
      setFase({ tipo: 'escolher', erro: processado.erro })
      return
    }

    setFase({ tipo: 'conferindo', resultado: processado.resultado })
    await conferir(processado.resultado)
  }

  async function gravarLotes(inicial: FaseGravando) {
    const resultado = await gravarEmSequencia(
      inicial.lotes,
      inicial.loteAtual,
      inicial.gravados,
      gravarLoteAction,
      (loteAtual, gravados) => setFase({ ...inicial, loteAtual, gravados }),
    )
    if (!resultado.ok) {
      unstable_rethrow(resultado.excecao)
      setFase({
        ...inicial,
        tipo: 'erro-gravacao',
        loteAtual: resultado.loteAtual,
        gravados: resultado.gravados,
        erro: resultado.erro,
      })
      return
    }
    setFase({ tipo: 'relatorio', resultado: inicial.resultado, jaImportados: inicial.jaImportados, gravados: resultado.gravados })
  }

  function confirmarGravacao(resultado: ResultadoDaTraducao, jaImportados: Set<number>) {
    // Só os NOVOS entram no lote: reenviar quem já está no banco seria inofensivo (ON
    // CONFLICT DO NOTHING), mas o número no botão ("Gravar N lançamentos") deixaria de bater
    // com o que de fato é gravado.
    const lotes = fatiar(separarNovos(resultado.lancamentos, jaImportados), TAMANHO_DO_LOTE)
    const proxima: FaseGravando = {
      tipo: 'gravando',
      resultado,
      jaImportados,
      lotes,
      loteAtual: 0,
      gravados: 0,
    }
    setFase(proxima)
    void gravarLotes(proxima)
  }

  function retomar(estadoComErro: FaseErroGravacao) {
    // A decisão (sempre do lote 1, gravados PRESERVADO, sem o campo erro sobrando) mora em
    // proximoEstadoAoRetomar (logica.ts) — é lá que o teste garante que "gravados: 0" não
    // volta a se esconder aqui sem que nada acuse (Crítico da Rodada 1, sem teste até a
    // Rodada 2: gravarEmSequencia prova que a SOMA está certa, não que retomar chama ela com
    // o valor certo).
    const proxima = proximoEstadoAoRetomar(estadoComErro)
    setFase(proxima)
    void gravarLotes(proxima)
  }

  async function confirmarDesfazer() {
    setEstadoDesfazer({ tipo: 'apagando' })
    try {
      const resposta = await desfazerAction()
      setEstadoDesfazer(
        resposta.ok ? { tipo: 'apagado', apagados: resposta.apagados } : { tipo: 'erro', erro: resposta.erro },
      )
    } catch (erro) {
      unstable_rethrow(erro)
      setEstadoDesfazer({ tipo: 'erro', erro: 'Não foi possível desfazer a importação.' })
    }
  }

  return (
    <div>
      <Estepe atual={etapaDaFase(fase.tipo)} />
      <h2 ref={tituloRef} tabIndex={-1} className="mb-4 text-lg font-semibold outline-none">
        {TITULOS[fase.tipo]}
      </h2>

      {fase.tipo === 'escolher' && (
        <TelaEscolher
          erro={fase.erro}
          aoEscolherArquivo={aoEscolherArquivo}
          estadoDesfazer={estadoDesfazer}
          aoConfirmarDesfazer={confirmarDesfazer}
        />
      )}

      {fase.tipo === 'lendo' && <TelaCarregando mensagem="Lendo o arquivo…" />}

      {fase.tipo === 'conferindo' && <TelaCarregando mensagem="Conferindo o que já foi importado…" />}

      {fase.tipo === 'erro-conferencia' && (
        <TelaErroConferencia erro={fase.erro} aoTentarDeNovo={() => reconferir(fase.resultado)} />
      )}

      {fase.tipo === 'revisao' && (
        <TelaRevisao
          resultado={fase.resultado}
          jaImportados={fase.jaImportados}
          aoConfirmar={() => confirmarGravacao(fase.resultado, fase.jaImportados)}
        />
      )}

      {fase.tipo === 'gravando' && (
        <TelaGravando loteAtual={fase.loteAtual} totalLotes={fase.lotes.length} gravados={fase.gravados} />
      )}

      {fase.tipo === 'erro-gravacao' && (
        <TelaErroGravacao
          totalLotes={fase.lotes.length}
          loteAtual={fase.loteAtual}
          gravados={fase.gravados}
          erro={fase.erro}
          aoRetomar={() => retomar(fase)}
        />
      )}

      {fase.tipo === 'relatorio' && (
        <TelaRelatorio
          gravados={fase.gravados}
          problemas={fase.resultado.problemas}
          avisos={fase.resultado.avisos}
          estadoDesfazer={estadoDesfazer}
          aoConfirmarDesfazer={confirmarDesfazer}
        />
      )}
    </div>
  )
}
