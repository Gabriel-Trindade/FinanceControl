import type { LancamentoDaPlanilha, ResultadoDaTraducao } from '@/domain/planilha'

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
