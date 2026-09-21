import { ErroDeLeitura } from '@/importacao/ler-xlsx'
import { TAMANHO_DO_LOTE } from '@/importacao/lotes'
import type { Celula, LancamentoDaPlanilha, ResultadoDaTraducao } from '@/domain/planilha'

/**
 * Tudo o que o assistente de importação pode estar fazendo, num tipo só — o componente
 * decide o que desenhar olhando `fase.tipo`, e o TypeScript garante que cada fase só carrega
 * os dados que faz sentido ela ter (ex.: só a partir de 'conferindo' existe `resultado`).
 * Fica aqui, fora de assistente.tsx, para não precisar de DOM nem de React para testar as
 * funções que leem e transformam este tipo.
 */
export type Fase =
  | { tipo: 'escolher'; erro: string | null }
  | { tipo: 'lendo' }
  | { tipo: 'conferindo'; resultado: ResultadoDaTraducao }
  | { tipo: 'erro-conferencia'; resultado: ResultadoDaTraducao; erro: string }
  | { tipo: 'revisao'; resultado: ResultadoDaTraducao; jaImportados: Set<number> }
  | {
      tipo: 'gravando'
      resultado: ResultadoDaTraducao
      jaImportados: Set<number>
      lotes: LancamentoDaPlanilha[][]
      loteAtual: number
      gravados: number
    }
  | {
      tipo: 'erro-gravacao'
      resultado: ResultadoDaTraducao
      jaImportados: Set<number>
      lotes: LancamentoDaPlanilha[][]
      loteAtual: number
      gravados: number
      erro: string
    }
  | { tipo: 'relatorio'; resultado: ResultadoDaTraducao; jaImportados: Set<number>; gravados: number }

/** Estado do painel de "desfazer importação" — independente da fase principal, porque o
 *  painel aparece tanto na etapa 1 (escolher) quanto na etapa 4 (relatório). */
export type EstadoDesfazer =
  | { tipo: 'ocioso' }
  | { tipo: 'apagando' }
  | { tipo: 'apagado'; apagados: number }
  | { tipo: 'erro'; erro: string }

/** As 4 etapas visíveis no <Estepe>. Várias fases internas caem na mesma etapa — por
 *  exemplo 'lendo' é um sub-passo de "Escolher", não uma 5ª etapa. */
export type Etapa = 0 | 1 | 2 | 3

export function etapaDaFase(tipo: Fase['tipo']): Etapa {
  switch (tipo) {
    case 'escolher':
    case 'lendo':
      return 0
    case 'conferindo':
    case 'erro-conferencia':
    case 'revisao':
      return 1
    case 'gravando':
    case 'erro-gravacao':
      return 2
    case 'relatorio':
      return 3
  }
}

/**
 * Corta um array em pedaços de até `tamanho` itens, na ordem em que vieram.
 * Usado tanto para os CÓDs de `conferirCods` quanto para os lançamentos de `gravarLoteAction`
 * — os dois têm o mesmo teto (`TAMANHO_DO_LOTE`, de src/importacao/lotes.ts) e a mesma forma
 * de dividir: pedaços cheios até o fim, o último podendo ser menor.
 */
export function fatiar<T>(itens: readonly T[], tamanho: number): T[][] {
  if (tamanho <= 0) throw new RangeError('tamanho deve ser maior que zero')
  const partes: T[][] = []
  for (let inicio = 0; inicio < itens.length; inicio += tamanho) {
    partes.push(itens.slice(inicio, inicio + tamanho))
  }
  return partes
}

/** Só os lançamentos cujo CÓD ainda não está no banco — são os únicos que valem a pena
 *  mandar para gravarLoteAction (reenviar os já importados seria inofensivo, por causa do
 *  ON CONFLICT DO NOTHING, mas gastaria lote à toa e o botão não bateria com o que é gravado). */
export function separarNovos(
  lancamentos: readonly LancamentoDaPlanilha[],
  jaImportados: ReadonlySet<number>,
): LancamentoDaPlanilha[] {
  return lancamentos.filter((l) => !jaImportados.has(l.codPlanilha))
}

/** pt-BR usa "." como separador de milhar: 4805 -> "4.805". Todo número mostrado na tela
 *  passa por aqui, para não aparecer "4805" cru ao lado de números formatados. */
export function formatarNumero(n: number): string {
  return n.toLocaleString('pt-BR')
}

export type ResumoDaConferencia = {
  lidas: number
  novas: number
  jaImportadas: number
  comProblema: number
}

/**
 * Os 4 números da etapa "Conferir" (spec §6.5: "li 4.805 linhas · 4.802 novas · 0 já
 * importadas · 3 com problema"). `lidas` é reconstruído a partir de lançamentos + problemas
 * porque `traduzirPlanilha` não guarda o total separadamente — cada linha da planilha vira
 * ou um lançamento ou um problema, nunca os dois.
 */
export function montarResumo(
  resultado: ResultadoDaTraducao,
  jaImportados: ReadonlySet<number>,
): ResumoDaConferencia {
  const jaImportadasCount = resultado.lancamentos.filter((l) => jaImportados.has(l.codPlanilha)).length
  return {
    lidas: resultado.lancamentos.length + resultado.problemas.length,
    novas: resultado.lancamentos.length - jaImportadasCount,
    jaImportadas: jaImportadasCount,
    comProblema: resultado.problemas.length,
  }
}

// ===== Rodada de correção 1: os dois laços e o "esperar pintar", extraídos e testáveis =====
//
// assistente.tsx tinha 242 linhas e zero teste — três mutações sobreviviam (revisão da
// Tarefa 11): trocar `return` por `continue` depois de um lote falhar, `break` depois do 1º
// grupo de CÓDs, e remover o `await aguardarPintura()`. As três dependiam de efeito colateral
// (Server Action, DOM) só alcançável rodando o componente React de verdade — o que o projeto
// não tem como fazer sem uma dependência nova. A saída: cada laço vira uma função pura que
// recebe a chamada de rede (`chamar`) por parâmetro. Em produção, `chamar` é a Server Action de
// verdade; no teste, é um dublê — e as asserções sobre QUANTAS VEZES `chamar` foi chamado (e
// com o quê) são exatamente o que prova que o laço para na hora certa.

/** Garante que um estado "carregando" CHEGOU a pintar antes de um trabalho síncrono pesado
 *  travar a thread principal (lerPlanilha: ~119ms medidos com 4.806 linhas em desktop, sem Web
 *  Worker). Um requestAnimationFrame roda ANTES do navegador pintar; o segundo, agendado de
 *  DENTRO do primeiro, só roda no quadro seguinte — quando a pintura do primeiro já aconteceu.
 *  Um `await` de frame só não bastaria sempre: é a técnica padrão ("double rAF") para ter
 *  certeza de que o navegador pintou, não só que agendou a pintura. */
export function aguardarPintura(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  })
}

export type RespostaDaConferencia = { ok: true; jaImportados: number[] } | { ok: false; erro: string }

export type ResultadoDaConferenciaEmGrupos =
  | { ok: true; jaImportados: Set<number> }
  | { ok: false; erro: string; excecao?: unknown }

/**
 * Confere todos os CÓDs, fatiados em grupos de TAMANHO_DO_LOTE (o codsSchema de
 * src/app/(app)/importar/validacao.ts recusa mais que isso numa chamada só). Para no primeiro
 * grupo que falhar — nunca segue conferindo os outros com um resultado incompleto, porque o
 * dono leria "0 já importadas" quando na verdade a conferência nem terminou.
 *
 * `chamar` fica de fora (não é a Server Action direto) para o teste poder passar um dublê sem
 * precisar de sessão nem de banco — só esta função e a ORDEM/QUANTIDADE de chamadas a `chamar`
 * são o que se testa aqui.
 */
export async function conferirEmGrupos(
  cods: readonly number[],
  chamar: (grupo: number[]) => Promise<RespostaDaConferencia>,
): Promise<ResultadoDaConferenciaEmGrupos> {
  const grupos = fatiar(cods, TAMANHO_DO_LOTE)
  const jaImportados = new Set<number>()
  for (const grupo of grupos) {
    let resposta: RespostaDaConferencia
    try {
      resposta = await chamar(grupo)
    } catch (excecao) {
      // exigirSessao() (1ª linha de conferirCods) redireciona para /login lançando um erro
      // especial do Next quando a sessão expira no meio da importação. Não é papel desta
      // função pura reconhecer esse erro (unstable_rethrow só existe em Client Component) —
      // ela só devolve a exceção crua para quem chamou decidir, junto com uma mensagem
      // genérica para o caso de ser um erro comum (rede caiu, deploy novo no ar).
      return { ok: false, erro: 'Não foi possível conferir os CÓDs. Tente de novo.', excecao }
    }
    if (!resposta.ok) return { ok: false, erro: resposta.erro }
    for (const cod of resposta.jaImportados) jaImportados.add(cod)
  }
  return { ok: true, jaImportados }
}

export type RespostaDoLote = { ok: true; gravados: number } | { ok: false; erro: string }

export type ResultadoDaGravacaoEmSequencia =
  | { ok: true; gravados: number }
  | { ok: false; loteAtual: number; gravados: number; erro: string; excecao?: unknown }

/**
 * Grava os lotes a partir do índice `inicio` (0 para começar do zero; o índice do lote que
 * falhou, nunca usado por "retomar" — ver `assistente.tsx` — mas útil para o teste exercitar
 * um recomeço no meio). Para no primeiro lote que falhar — nunca continua para o próximo
 * depois de uma falha (brief da Tarefa 11). `jaGravados` entra na soma: quem chama pode ter um
 * total anterior (uma retomada, por exemplo) que não pode ser jogado fora.
 *
 * `aoProgredir` é chamado depois de CADA lote bem-sucedido, com o total atualizado — é o gancho
 * para assistente.tsx atualizar a tela lote a lote, sem esta função saber o que é React.
 */
export async function gravarEmSequencia(
  lotes: readonly LancamentoDaPlanilha[][],
  inicio: number,
  jaGravados: number,
  chamar: (lote: LancamentoDaPlanilha[]) => Promise<RespostaDoLote>,
  aoProgredir: (loteAtual: number, gravados: number) => void,
): Promise<ResultadoDaGravacaoEmSequencia> {
  let gravadosTotal = jaGravados
  for (let indice = inicio; indice < lotes.length; indice++) {
    let resposta: RespostaDoLote
    try {
      resposta = await chamar(lotes[indice])
    } catch (excecao) {
      return {
        ok: false,
        loteAtual: indice,
        gravados: gravadosTotal,
        erro: 'Não foi possível gravar este lote. Tente de novo.',
        excecao,
      }
    }
    if (!resposta.ok) {
      // Para AQUI — nunca segue para o próximo lote depois de uma falha (brief).
      return { ok: false, loteAtual: indice, gravados: gravadosTotal, erro: resposta.erro }
    }
    gravadosTotal += resposta.gravados
    aoProgredir(indice + 1, gravadosTotal)
  }
  return { ok: true, gravados: gravadosTotal }
}

export type ResultadoDaLeitura =
  | { ok: true; resultado: ResultadoDaTraducao }
  | { ok: false; erro: string }

/**
 * A etapa "lendo o arquivo": espera pintar, lê, traduz. As três dependências (`aguardarPintura`,
 * `lerPlanilha`, `traduzirPlanilha`) entram por parâmetro só para o teste poder trocar a
 * primeira por um dublê instrumentado e provar a ORDEM (pintura antes da leitura) sem precisar
 * de `requestAnimationFrame` de verdade nem de um `.xlsx`.
 */
export async function lerEProcessarArquivo(
  arquivo: File,
  deps: {
    aguardarPintura: () => Promise<void>
    lerPlanilha: (arquivo: File) => Promise<Celula[][]>
    traduzirPlanilha: (linhas: Celula[][]) => ResultadoDaTraducao
  },
): Promise<ResultadoDaLeitura> {
  await deps.aguardarPintura()
  let linhas: Celula[][]
  try {
    linhas = await deps.lerPlanilha(arquivo)
  } catch (erro) {
    // lerPlanilha roda inteiramente no navegador (sem Server Action envolvida), então
    // qualquer erro aqui é sobre o ARQUIVO, nunca sobre sessão.
    const mensagem = erro instanceof ErroDeLeitura ? erro.message : 'Não foi possível ler o arquivo.'
    return { ok: false, erro: mensagem }
  }
  return { ok: true, resultado: deps.traduzirPlanilha(linhas) }
}
