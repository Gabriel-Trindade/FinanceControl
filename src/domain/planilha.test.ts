import { describe, expect, it } from 'vitest'
import { traduzirLinha, valorParaCentavos, type Celula } from './planilha'

describe('valorParaCentavos', () => {
  it('converte número inteiro e com duas casas', () => {
    expect(valorParaCentavos(1234.56)).toBe(123456)
    expect(valorParaCentavos('1234.56')).toBe(123456)
    expect(valorParaCentavos(10)).toBe(1000)
  })

  it('arredonda a terceira casa para longe do zero', () => {
    // 1.005 * 100 vale 100.49999999999999 em ponto flutuante: sem cuidado, viraria 100.
    expect(valorParaCentavos(1.005)).toBe(101)
    expect(valorParaCentavos('1.005')).toBe(101)
    expect(valorParaCentavos(-1.005)).toBe(-101)
    expect(valorParaCentavos('-1.005')).toBe(-101)
    expect(valorParaCentavos(-0.125)).toBe(-13)
    expect(valorParaCentavos('-0.125')).toBe(-13)
  })

  it('zero nunca vira -0', () => {
    // expect(-0).toBe(0) falha no Vitest, porque ele usa Object.is.
    expect(Object.is(valorParaCentavos(0), 0)).toBe(true)
    expect(Object.is(valorParaCentavos('-0'), 0)).toBe(true)
    // 0 e '-0' não passam por `bruto < 0`, então não provam a guarda do ramo
    // número. -0.004 arredonda para zero vindo de um negativo: é o único
    // caminho que exercita essa guarda.
    expect(Object.is(valorParaCentavos(-0.004), 0)).toBe(true)
  })

  it('recusa o que não é número', () => {
    expect(valorParaCentavos('abc')).toBeNull()
    expect(valorParaCentavos('')).toBeNull()
    expect(valorParaCentavos(Number.NaN)).toBeNull()
    // Infinity é finito? Não — e um "centavos" infinito não pode chegar ao banco.
    expect(valorParaCentavos(Infinity)).toBeNull()
    expect(valorParaCentavos(-Infinity)).toBeNull()
  })

  it('tolera espaço, NBSP e BOM nas pontas do texto vindo do Excel', () => {
    // Célula de texto do XLSX costuma vir com espaço sobrando. O NBSP (espaço
    // não separável, U+00A0) é o mais provável dos três na prática: o Excel usa
    // NBSP na formatação de número, e se colar numa célula, só o trim() salva
    // a linha. O BOM (marca de ordem de byte, U+FEFF) aparece em exportações
    // de outras planilhas. trim() remove os três. Geramos NBSP e BOM com
    // fromCharCode em vez de colar o caractere invisível no arquivo, para o
    // teste continuar legível e auditável.
    const bom = String.fromCharCode(0xfeff)
    const nbsp = String.fromCharCode(0x00a0)
    expect(valorParaCentavos('  12.34  ')).toBe(1234)
    expect(valorParaCentavos(' 12.34' + bom)).toBe(1234)
    expect(valorParaCentavos(nbsp + '12.34' + nbsp)).toBe(1234)
  })

  it('cobre os extremos reais da planilha e mais de duas casas decimais', () => {
    // -8.204,99 e 7.000,00 são o mínimo e o máximo medidos nos 4.805 lançamentos.
    expect(valorParaCentavos(-8204.99)).toBe(-820499)
    expect(valorParaCentavos(7000)).toBe(700000)
    // Só a terceira casa decide o arredondamento; a quarta em diante é ignorada.
    expect(valorParaCentavos('1.2345')).toBe(123)
  })
})

// O Excel usa ∞ (U+221E) para QTD PARCELAS de gasto recorrente. Como no bloco de
// NBSP/BOM acima, geramos por código em vez de colar o glifo no arquivo: não
// custa nada e elimina qualquer dúvida sobre o que fica gravado no disco.
const INFINITO = String.fromCharCode(0x221e)

// Ordem das 14 colunas da aba GASTOS, conforme docs/referencias/planilha-gastos.md:
// CÓD, VENCIMENTO, ANO, MÊS, CATEGORIA, ITEM, VALOR, PARCELA ATUAL, QTD PARCELAS,
// SUBTOTAL, RESTANTE, ORIGEM, PAGO?, SITUAÇÃO
function linha(mudancas: Partial<Record<number, Celula>> = {}): Celula[] {
  const base: Celula[] = [
    1, new Date(Date.UTC(2026, 8, 5)), 2026, 'SETEMBRO', 'Mercado', 'Compra do mês',
    150.5, 1, 3, 451.5, 301, 'Ana', 'SIM', 'RECEBIDO',
  ]
  for (const [i, valor] of Object.entries(mudancas)) base[Number(i)] = valor as Celula
  return base
}

describe('traduzirLinha', () => {
  it('traduz uma linha comum', () => {
    const r = traduzirLinha(linha())
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.lancamento).toEqual({
      codPlanilha: 1,
      mesFatura: '2026-09-01', // VENCIMENTO é dia 5; guardamos o dia 1
      pessoa: 'Ana',
      categoria: 'Mercado',
      item: 'Compra do mês',
      valorCentavos: 15050,
      parcelaAtual: 1,
      qtdParcelas: 3,
      recorrente: false,
      pagamento: 'SIM',
    })
  })

  it('normaliza o item em NFC', () => {
    // "é" tem duas representações Unicode: precomposta (NFC, um só codepoint)
    // e decomposta (NFD, "e" + acento agudo combinante). Colar a forma NFD
    // direto no arquivo se recompõe para NFC ao salvar (nota de memória do
    // projeto), o que provaria o teste mesmo sem normalização nenhuma —
    // por isso a NFD é derivada em tempo de execução a partir da NFC.
    const itemNFC = 'Café'
    const itemNFD = itemNFC.normalize('NFD')
    expect(itemNFD).not.toBe(itemNFC) // sanidade: as duas formas são bytes diferentes
    const r = traduzirLinha(linha({ 5: itemNFD }))
    expect(r.ok && r.lancamento.item).toBe(itemNFC)
  })

  it('colapsa espaço repetido em categoria e origem', () => {
    const r = traduzirLinha(linha({ 4: 'Casa  e  Lar', 11: 'Ana   Maria' }))
    expect(r.ok && r.lancamento.categoria).toBe('Casa e Lar')
    expect(r.ok && r.lancamento.pessoa).toBe('Ana Maria')
  })

  it('∞ em QTD PARCELAS vira recorrente sem quantidade', () => {
    const r = traduzirLinha(linha({ 8: INFINITO }))
    expect(r.ok && r.lancamento.recorrente).toBe(true)
    expect(r.ok && r.lancamento.qtdParcelas).toBeNull()
  })

  it('∞ com espaços ao redor também vira recorrente', () => {
    // A célula pode chegar com espaço sobrando, igual a qualquer texto do Excel.
    const r = traduzirLinha(linha({ 8: `  ${INFINITO}  ` }))
    expect(r.ok && r.lancamento.recorrente).toBe(true)
    expect(r.ok && r.lancamento.qtdParcelas).toBeNull()
  })

  it.each([
    ['nulo', null],
    ['texto vazio', ''],
    ['só espaços', '   '],
  ])('PAGO? %s vira NAO', (_nome, celula) => {
    const r = traduzirLinha(linha({ 12: celula }))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.lancamento.pagamento).toBe('NAO')
  })

  it('PAGO? PERDOADO entra como PERDOADO', () => {
    const r = traduzirLinha(linha({ 12: 'PERDOADO' }))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.lancamento.pagamento).toBe('PERDOADO')
  })

  it('PAGO? ausente (linha mais curta que 14 células) vira NAO', () => {
    // Se a biblioteca de leitura truncar células vazias à direita, a célula
    // chega como undefined, não null — os dois precisam se comportar igual.
    const celulas = linha().slice(0, 12) // sem índice 12 (PAGO?) nem 13 (SITUAÇÃO)
    const r = traduzirLinha(celulas)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.lancamento.pagamento).toBe('NAO')
  })

  it('lê a data em UTC, para o dia 1 não cair em dezembro do ano anterior', () => {
    // O dia 5 (usado no restante deste arquivo) nunca muda de mês nem em fuso
    // negativo: 5 à meia-noite UTC menos algumas horas ainda cai no dia 4, mesmo
    // mês. Só o dia 1 prova a diferença entre getUTC*/getters locais — um fuso
    // negativo (ex.: America/Sao_Paulo, UTC−3) leria 31/dez/2025 nos getters
    // locais, errando mês E ano.
    const r = traduzirLinha(linha({ 1: new Date(Date.UTC(2026, 0, 1)) }))
    expect(r.ok && r.lancamento.mesFatura).toBe('2026-01-01')
  })

  it('PARCELA ATUAL 0 vira 1, com aviso', () => {
    const r = traduzirLinha(linha({ 7: 0 }))
    expect(r.ok && r.lancamento.parcelaAtual).toBe(1)
    expect(r.ok && r.avisos).toContain('PARCELA ATUAL era 0, corrigida para 1')
  })

  it('valor com mais de duas casas gera aviso', () => {
    // A célula 9 acompanha: 150.555 × 3 = 451.665, senão dispara também o aviso de SUBTOTAL.
    const r = traduzirLinha(linha({ 6: 150.555, 9: 451.665 }))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.lancamento.valorCentavos).toBe(15056)
    expect(r.avisos.some((a) => a.includes('arredondado'))).toBe(true)
  })

  it('valor zero entra, com aviso', () => {
    const r = traduzirLinha(linha({ 6: 0, 9: 0 }))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.lancamento.valorCentavos).toBe(0)
    expect(r.avisos.some((a) => a.includes('zero'))).toBe(true)
  })

  it('SUBTOTAL sobrescrito à mão gera aviso', () => {
    // valor 150.50 × 3 parcelas = 451.50; aqui está 999 (fórmula sobrescrita à mão)
    const r = traduzirLinha(linha({ 9: 999 }))
    expect(r.ok && r.avisos.some((a) => a.includes('SUBTOTAL'))).toBe(true)
  })

  it('SUBTOTAL do Excel, calculado antes do arredondamento, NÃO gera aviso', () => {
    // Este é o teste que impede o aviso de disparar às centenas.
    // A fórmula do Excel é QTD × VALOR sem arredondar: 3 × 33,333333 = 99,999999.
    // calcularSubtotal multiplica os centavos JÁ arredondados: 3 × 3333 = 9999.
    // Os dois divergem por 1 centavo, e isso é normal — não é fórmula sobrescrita.
    const r = traduzirLinha(linha({ 6: 33.333333, 7: 1, 8: 3, 9: 99.999999 }))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.avisos.some((a) => a.includes('SUBTOTAL'))).toBe(false)
  })

  it.each([
    ['CÓD ausente', { 0: null }],
    ['CÓD zero', { 0: 0 }],
    ['CÓD acima do limite do integer', { 0: 3000000000 }],
    ['VENCIMENTO não é data', { 1: 'setembro' }],
    ['ITEM vazio', { 5: '   ' }],
    ['VALOR não numérico', { 6: 'muito' }],
    ['VALOR acima do limite do integer (em centavos)', { 6: 99999999.99 }],
    ['CATEGORIA vazia', { 4: '' }],
    ['ORIGEM vazia', { 11: '' }],
    ['PARCELA ATUAL negativa', { 7: -1 }],
    ['QTD PARCELAS vazia', { 8: null }],
    ['QTD PARCELAS não inteira', { 8: 3.5 }],
    ['QTD PARCELAS menor que PARCELA ATUAL', { 7: 5, 8: 3 }],
    ['PARCELA ATUAL 0 com QTD PARCELAS 0', { 7: 0, 8: 0 }],
    ['PARCELA ATUAL acima de smallint', { 7: 40000, 8: 40000 }],
    ['PAGO? com valor estranho', { 12: 'TALVEZ' }],
  ])('recusa: %s', (_nome, mudancas) => {
    expect(traduzirLinha(linha(mudancas)).ok).toBe(false)
  })
})
