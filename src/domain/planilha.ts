import { calcularSubtotal, type Pagamento } from './lancamento'

// O número da célula chega como texto ("1234.56", com ponto decimal do XLSX) ou já
// como number. Os dois caminhos existem porque o read-excel-file pode entregar
// qualquer um dos dois, e nenhum dos dois pode perder centavo.
const PADRAO_NUMERO = /^(-)?(\d+)(?:\.(\d+))?$/

/** Valor da planilha → centavos inteiros. `null` quando não é número. */
export function valorParaCentavos(bruto: string | number): number | null {
  if (typeof bruto === 'string') {
    const partes = PADRAO_NUMERO.exec(bruto.trim())
    if (!partes) return null
    const [, sinal, inteiro, decimal = ''] = partes
    // Duas casas exatas: completa com zero, ou arredonda a partir da terceira.
    const centavosSemArredondar = Number(inteiro) * 100 + Number(decimal.slice(0, 2).padEnd(2, '0'))
    const terceira = Number(decimal[2] ?? '0')
    const centavos = centavosSemArredondar + (terceira >= 5 ? 1 : 0)
    // O sinal fica de fora da conta e só é aplicado aqui no fim, sobre a
    // magnitude já arredondada. O "!== 0" evita devolver -0 (ex.: "-0,00" ou
    // um negativo que arredonda para zero), que quebra Object.is e sai como
    // "-0" em JSON.
    return sinal && centavos !== 0 ? -centavos : centavos
  }

  if (!Number.isFinite(bruto)) return null
  // toFixed antes do round limpa o ruído binário: sem ele, 1.005 * 100 é 100.4999...
  const centavos = Math.round(Number((Math.abs(bruto) * 100).toFixed(6)))
  // Arredonda o valor absoluto e só então aplica o sinal: Math.round(-1.5) dá -1,
  // ou seja, na direção do zero, não para longe dele — por isso o sinal fica de
  // fora do Math.round. O "!== 0" evita devolver -0, que quebra Object.is e sai
  // como "-0" em JSON.
  return bruto < 0 && centavos !== 0 ? -centavos : centavos
}

// ===== Tarefa 6: traduzir uma linha da planilha =====

/** O que uma célula da planilha pode conter, segundo o read-excel-file. */
export type Celula = string | number | boolean | Date | null

export type LancamentoDaPlanilha = {
  codPlanilha: number
  mesFatura: string
  pessoa: string
  categoria: string
  item: string
  valorCentavos: number
  parcelaAtual: number
  qtdParcelas: number | null
  recorrente: boolean
  pagamento: Pagamento
}

export type TraducaoDeLinha =
  | { ok: true; lancamento: LancamentoDaPlanilha; avisos: string[] }
  | { ok: false; motivo: string }

// O Excel usa ∞ (U+221E) para QTD PARCELAS de gasto recorrente. Gerado por
// código, não como literal: o caractere não é invisível nem decomponível, mas
// gerar em tempo de execução tira qualquer dúvida sobre o que fica no arquivo.
const INFINITO = String.fromCharCode(0x221e)

// Teto do tipo `integer` do Postgres (2^31 − 1). cod_planilha e valor_centavos
// são `integer` no schema; acima disto o INSERT falha com "integer out of
// range" e derruba o lote inteiro — o mesmo argumento que torna o smallint
// (parcela_atual/qtd_parcelas, abaixo) problema em vez de aviso. Hoje
// inalcançável nos dados reais (CÓD vai a 4805, valor máximo R$ 7.000), mas a
// guarda custa uma linha e a razão de existir é idêntica à do smallint.
const MAX_INTEGER = 2147483647

// Uma frase por motivo, escrita antes da implementação (o dono lê este texto na
// tela de conferência). A ORDEM é a da spec §6.4: quando uma linha tem dois
// defeitos, vence o primeiro da lista, e traduzirLinha checa nesta sequência.
const MOTIVO = {
  cod: 'CÓD ausente, não numérico ou menor que 1',
  codAcimaDoLimite: `CÓD acima do limite do banco (máximo ${MAX_INTEGER})`,
  vencimento: 'VENCIMENTO ausente ou não é uma data',
  item: 'ITEM vazio',
  valor: 'VALOR ausente ou não numérico',
  valorAcimaDoLimite: `VALOR acima do limite do banco em centavos (máximo ${MAX_INTEGER})`,
  categoria: 'CATEGORIA vazia',
  origem: 'ORIGEM vazia',
  parcelaAtual: 'PARCELA ATUAL ausente, não numérica ou negativa',
  qtdParcelas: `QTD PARCELAS vazia ou não numérica (nem número nem ${INFINITO})`,
  qtdMenorQueParcelaAtual: 'QTD PARCELAS menor que PARCELA ATUAL',
  acimaDeSmallint: 'PARCELA ATUAL ou QTD PARCELAS acima do limite de 32.767',
  pagamento: 'PAGO? diferente de SIM, vazio ou PERDOADO',
}

const AVISO = {
  parcelaAtualZerada: 'PARCELA ATUAL era 0, corrigida para 1',
  valorArredondado: 'VALOR tinha mais de duas casas decimais; arredondado para o centavo mais próximo',
  valorZero: 'VALOR é zero',
  subtotalDivergente:
    'SUBTOTAL da planilha não bate com o calculado a partir de VALOR e QTD PARCELAS; a fórmula pode ter sido sobrescrita à mão',
}

/** CÓD, PARCELA ATUAL e QTD PARCELAS podem chegar como number ou string numérica. */
function celulaParaInteiro(celula: Celula): number | null {
  if (typeof celula === 'number') return Number.isInteger(celula) ? celula : null
  if (typeof celula === 'string') {
    const texto = celula.trim()
    if (!/^-?\d+$/.test(texto)) return null
    return Number(texto)
  }
  return null
}

/**
 * CATEGORIA e ORIGEM seguem a mesma regra de `normalizarNome`
 * (src/db/cadastros.ts), mas sem importar de lá: este módulo é domain puro e
 * não pode depender do módulo de banco.
 */
function normalizarCadastro(celula: Celula): string {
  if (typeof celula !== 'string') return ''
  return celula.normalize('NFC').trim().replace(/\s+/g, ' ')
}

/** ITEM leva NFC + trim, mas sem colapsar espaço interno (diferente de pessoa/categoria). */
function normalizarItem(celula: Celula): string {
  if (typeof celula !== 'string') return ''
  return celula.normalize('NFC').trim()
}

/** PAGO?: vazio (ou ausente) é NAO; SIM e PERDOADO passam direto; o resto é inválido. */
function interpretarPagamento(celula: Celula): Pagamento | null {
  // "== null" (dois iguais) de propósito: pega null E undefined. Uma linha
  // com menos de 14 células (ex.: biblioteca de leitura truncando células
  // vazias à direita) chega aqui como undefined, e ausência deve significar
  // "vazio" — igual a uma célula null — não "problema".
  if (celula == null) return 'NAO'
  if (typeof celula !== 'string') return null
  const texto = celula.trim()
  if (texto === '') return 'NAO'
  if (texto === 'SIM' || texto === 'PERDOADO') return texto
  return null
}

/**
 * VENCIMENTO (sempre dia 5) → mês da fatura no dia 1, em UTC.
 * getUTCFullYear/getUTCMonth, nunca os getters locais nem toISOString() sobre
 * uma data local: o servidor pode rodar em qualquer fuso, e um fuso negativo
 * jogaria o dia 5 para o dia 4 — em janeiro, para dezembro do ano anterior.
 */
function paraMesFaturaUTC(data: Date): string {
  const ano = data.getUTCFullYear()
  const mes = data.getUTCMonth() + 1
  return `${String(ano).padStart(4, '0')}-${String(mes).padStart(2, '0')}-01`
}

/**
 * Traduz uma linha da aba GASTOS (14 células, ver docs/referencias/planilha-gastos.md)
 * num lançamento, ou devolve o motivo pelo qual ela não entra. Função pura: não
 * sabe o que é arquivo, banco nem tela — só olha o array de células.
 */
export function traduzirLinha(celulas: Celula[]): TraducaoDeLinha {
  const problema = (motivo: string): TraducaoDeLinha => ({ ok: false, motivo })

  const codPlanilha = celulaParaInteiro(celulas[0])
  if (codPlanilha === null || codPlanilha <= 0) return problema(MOTIVO.cod)
  if (codPlanilha > MAX_INTEGER) return problema(MOTIVO.codAcimaDoLimite)

  const vencimento = celulas[1]
  if (!(vencimento instanceof Date) || Number.isNaN(vencimento.getTime())) {
    return problema(MOTIVO.vencimento)
  }
  const mesFatura = paraMesFaturaUTC(vencimento)

  const item = normalizarItem(celulas[5])
  if (!item) return problema(MOTIVO.item)

  const valorBruto = celulas[6]
  const valorCentavos =
    typeof valorBruto === 'number' || typeof valorBruto === 'string'
      ? valorParaCentavos(valorBruto)
      : null
  if (valorCentavos === null) return problema(MOTIVO.valor)
  if (Math.abs(valorCentavos) > MAX_INTEGER) return problema(MOTIVO.valorAcimaDoLimite)

  const categoria = normalizarCadastro(celulas[4])
  if (!categoria) return problema(MOTIVO.categoria)
  const pessoa = normalizarCadastro(celulas[11])
  if (!pessoa) return problema(MOTIVO.origem)

  const parcelaAtualBruta = celulaParaInteiro(celulas[7])
  if (parcelaAtualBruta === null || parcelaAtualBruta < 0) return problema(MOTIVO.parcelaAtual)

  const avisos: string[] = []
  // Corrige 0 → 1 antes de qualquer comparação com QTD PARCELAS: o valor
  // corrigido é o que será gravado, e é ele que precisa satisfazer o CHECK
  // lancamentos_parcelas_coerentes (qtd_parcelas >= parcela_atual) no banco.
  const parcelaAtual = parcelaAtualBruta === 0 ? 1 : parcelaAtualBruta
  if (parcelaAtualBruta === 0) avisos.push(AVISO.parcelaAtualZerada)

  const celulaQtd = celulas[8]
  const recorrente = typeof celulaQtd === 'string' && celulaQtd.trim() === INFINITO
  let qtdParcelas: number | null = null
  if (!recorrente) {
    qtdParcelas = celulaParaInteiro(celulaQtd)
    if (qtdParcelas === null) return problema(MOTIVO.qtdParcelas)
  }

  if (qtdParcelas !== null && qtdParcelas < parcelaAtual) {
    return problema(MOTIVO.qtdMenorQueParcelaAtual)
  }

  // smallint no schema: acima de 32.767 o INSERT derrubaria o lote inteiro,
  // não só esta linha — por isso é problema, e não aviso.
  if (parcelaAtual > 32767 || (qtdParcelas !== null && qtdParcelas > 32767)) {
    return problema(MOTIVO.acimaDeSmallint)
  }

  const pagamento = interpretarPagamento(celulas[12])
  if (pagamento === null) return problema(MOTIVO.pagamento)

  // Aviso: a célula trazia mais de duas casas decimais. Dividir o inteiro de
  // centavos por 100 e ler o decimal bruto dão o mesmo double, então esta
  // comparação é exata nos dois lados — nunca um falso positivo por ruído de
  // ponto flutuante.
  if (Number(valorBruto) !== valorCentavos / 100) avisos.push(AVISO.valorArredondado)
  if (valorCentavos === 0) avisos.push(AVISO.valorZero)

  // Aviso de SUBTOTAL, com tolerância de qtdParcelas centavos (1 quando
  // recorrente, que não multiplica nada). A fórmula do Excel multiplica VALOR
  // sem arredondar, e calcularSubtotal multiplica os centavos já arredondados:
  // em qualquer linha de mais de duas casas com QTD ≥ 2 os dois divergem por
  // 1-2 centavos. Sem a tolerância, isso dispararia o aviso centenas de vezes
  // e enterraria as 4 fórmulas realmente sobrescritas — a única coisa que o
  // aviso existe para achar — no meio do ruído.
  const celulaSubtotal = celulas[9]
  const subtotalDaPlanilha =
    typeof celulaSubtotal === 'number' || typeof celulaSubtotal === 'string'
      ? valorParaCentavos(celulaSubtotal)
      : null
  if (subtotalDaPlanilha !== null) {
    const subtotalCalculado = calcularSubtotal({ valorCentavos, qtdParcelas, recorrente })
    const tolerancia = qtdParcelas ?? 1
    if (Math.abs(subtotalDaPlanilha - subtotalCalculado) > tolerancia) {
      avisos.push(AVISO.subtotalDivergente)
    }
  }

  return {
    ok: true,
    lancamento: {
      codPlanilha,
      mesFatura,
      pessoa,
      categoria,
      item,
      valorCentavos,
      parcelaAtual,
      qtdParcelas,
      recorrente,
      pagamento,
    },
    avisos,
  }
}
