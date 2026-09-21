'use client'

import { useEffect, useRef, useState } from 'react'
import { unstable_rethrow } from 'next/navigation'
import { ErroDeLeitura, lerPlanilha } from '@/importacao/ler-xlsx'
import { TAMANHO_DO_LOTE } from '@/importacao/lotes'
import { traduzirPlanilha, type Celula, type ResultadoDaTraducao } from '@/domain/planilha'
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
import { etapaDaFase, fatiar, separarNovos, type EstadoDesfazer, type Fase } from './logica'

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

/**
 * Garante que "Lendo o arquivo…" CHEGOU a pintar antes de lerPlanilha travar a thread
 * principal (~119ms medidos com 4.806 linhas em desktop, sem Web Worker — item 2 das
 * observações da Tarefa 11). Um requestAnimationFrame roda ANTES do navegador pintar; o
 * segundo, agendado de DENTRO do primeiro, só roda no quadro seguinte — quando a pintura do
 * primeiro já aconteceu. Um `await` de frame só não bastaria sempre: é a técnica padrão
 * ("double rAF") para ter certeza de que o navegador pintou, não só que agendou a pintura.
 */
function aguardarPintura(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  })
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
    // não valeria paralelizar com Promise.all — o Next despacha Server Actions uma de cada
    // vez por cliente (node_modules/next/dist/docs/01-app/02-guides/server-actions.md,
    // "Sequential dispatch on the client"), então as chamadas seriam serializadas de
    // qualquer forma, só que sem controle de qual falhou.
    const grupos = fatiar(resultado.lancamentos.map((l) => l.codPlanilha), TAMANHO_DO_LOTE)
    const jaImportados = new Set<number>()
    for (const grupo of grupos) {
      try {
        const resposta = await conferirCods(grupo)
        if (!resposta.ok) {
          setFase({ tipo: 'erro-conferencia', resultado, erro: resposta.erro })
          return
        }
        for (const cod of resposta.jaImportados) jaImportados.add(cod)
      } catch (erro) {
        // exigirSessao() (1ª linha de conferirCods) redireciona para /login lançando um erro
        // especial do Next quando a sessão expira no meio da importação; unstable_rethrow
        // deixa ESSE erro atravessar para o Next terminar a navegação, e só vira "erro de
        // conferência" aqui qualquer outra coisa (rede caiu, deploy novo no ar).
        unstable_rethrow(erro)
        setFase({ tipo: 'erro-conferencia', resultado, erro: 'Não foi possível conferir os CÓDs. Tente de novo.' })
        return
      }
    }
    setFase({ tipo: 'revisao', resultado, jaImportados })
  }

  function reconferir(resultado: ResultadoDaTraducao) {
    setFase({ tipo: 'conferindo', resultado })
    void conferir(resultado)
  }

  async function aoEscolherArquivo(arquivo: File) {
    setFase({ tipo: 'lendo' })
    await aguardarPintura()

    let linhas: Celula[][]
    try {
      linhas = await lerPlanilha(arquivo)
    } catch (erro) {
      // lerPlanilha roda inteiramente no navegador (sem Server Action envolvida), então
      // qualquer erro aqui é sobre o ARQUIVO, nunca sobre sessão — sem unstable_rethrow.
      const mensagem = erro instanceof ErroDeLeitura ? erro.message : 'Não foi possível ler o arquivo.'
      setFase({ tipo: 'escolher', erro: mensagem })
      return
    }

    const resultado = traduzirPlanilha(linhas)
    setFase({ tipo: 'conferindo', resultado })
    await conferir(resultado)
  }

  async function gravarLotes(inicial: Extract<Fase, { tipo: 'gravando' }>) {
    let gravadosTotal = inicial.gravados
    for (let indice = inicial.loteAtual; indice < inicial.lotes.length; indice++) {
      try {
        const resposta = await gravarLoteAction(inicial.lotes[indice])
        if (!resposta.ok) {
          // Para o laço AQUI — nunca segue para o próximo lote depois de uma falha (brief).
          setFase({ ...inicial, tipo: 'erro-gravacao', loteAtual: indice, gravados: gravadosTotal, erro: resposta.erro })
          return
        }
        gravadosTotal += resposta.gravados
        setFase({ ...inicial, loteAtual: indice + 1, gravados: gravadosTotal })
      } catch (erro) {
        unstable_rethrow(erro)
        setFase({
          ...inicial,
          tipo: 'erro-gravacao',
          loteAtual: indice,
          gravados: gravadosTotal,
          erro: 'Não foi possível gravar este lote. Tente de novo.',
        })
        return
      }
    }
    setFase({ tipo: 'relatorio', resultado: inicial.resultado, jaImportados: inicial.jaImportados, gravados: gravadosTotal })
  }

  function confirmarGravacao(resultado: ResultadoDaTraducao, jaImportados: Set<number>) {
    // Só os NOVOS entram no lote: reenviar quem já está no banco seria inofensivo (ON
    // CONFLICT DO NOTHING), mas o número no botão ("Gravar N lançamentos") deixaria de bater
    // com o que de fato é gravado.
    const lotes = fatiar(separarNovos(resultado.lancamentos, jaImportados), TAMANHO_DO_LOTE)
    const proxima: Extract<Fase, { tipo: 'gravando' }> = {
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

  function retomar(estadoComErro: Extract<Fase, { tipo: 'erro-gravacao' }>) {
    // Sempre do lote 1, nunca do que falhou (brief) — seguro porque gravarLoteAction é
    // idempotente: os lotes que já entraram são reenviados e não fazem nada na 2ª vez.
    const proxima: Extract<Fase, { tipo: 'gravando' }> = { ...estadoComErro, tipo: 'gravando', loteAtual: 0, gravados: 0 }
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
          quantidadeConhecidaParaDesfazer={fase.jaImportados.size + fase.gravados}
          aoConfirmarDesfazer={confirmarDesfazer}
        />
      )}
    </div>
  )
}
