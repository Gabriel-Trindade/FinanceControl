import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { criarBancoDeTeste } from '../../tests/banco-de-teste'
import { obterOuCriarCategoria, obterOuCriarPessoa } from './cadastros'
import {
  criarLancamento,
  listarLancamentosDoMes,
  marcarComoRecebidos,
  type NovoLancamento,
} from './lancamentos'
import type { Db } from './tipos'

describe('lançamentos no banco', () => {
  let db: Db
  let fechar: () => Promise<void>
  let pessoaId: number
  let categoriaId: number

  beforeEach(async () => {
    ;({ db, fechar } = await criarBancoDeTeste())
    pessoaId = (await obterOuCriarPessoa(db, 'Ana')).id
    categoriaId = (await obterOuCriarCategoria(db, 'Mercado')).id
  })

  afterEach(async () => {
    await fechar()
  })

  function novo(alteracoes: Partial<NovoLancamento> = {}): NovoLancamento {
    return {
      mesFatura: '2026-09-01',
      dataCompra: '2026-08-20',
      pessoaId,
      categoriaId,
      item: 'Compra',
      valorCentavos: 5000,
      parcelaAtual: 1,
      qtdParcelas: 1,
      recorrente: false,
      pagamento: 'NAO',
      pagoEm: null,
      ...alteracoes,
    }
  }

  it('cria e lista só os lançamentos do mês pedido, com nomes de pessoa e categoria', async () => {
    const { id } = await criarLancamento(db, novo({ item: 'Farmácia' }))
    await criarLancamento(db, novo({ mesFatura: '2026-10-01' }))

    const doMes = await listarLancamentosDoMes(db, '2026-09-01')

    expect(doMes).toHaveLength(1)
    expect(doMes[0]).toMatchObject({
      id,
      item: 'Farmácia',
      pessoa: 'Ana',
      categoria: 'Mercado',
      valorCentavos: 5000,
      pagamento: 'NAO',
      dataCompra: '2026-08-20',
    })
  })

  it('ordena por pessoa em português e, dentro da pessoa, pela ordem de criação', async () => {
    // "Bia" e o lançamento "B1" são criados ANTES de "Álvaro"/"AL1" (id maior), mas
    // "Álvaro" precisa aparecer primeiro mesmo assim: prova que a ordem não vem do
    // banco (collation "C" colocaria "Álvaro" depois de "Bia", por causa do acento).
    const bia = await obterOuCriarPessoa(db, 'Bia')
    const alvaro = await obterOuCriarPessoa(db, 'Álvaro')
    await criarLancamento(db, novo({ pessoaId: bia.id, item: 'B1' }))
    await criarLancamento(db, novo({ pessoaId: alvaro.id, item: 'AL1' }))
    await criarLancamento(db, novo({ item: 'AN1' }))
    await criarLancamento(db, novo({ item: 'AN2' }))

    const itens = (await listarLancamentosDoMes(db, '2026-09-01')).map((l) => l.item)

    expect(itens).toEqual(['AL1', 'AN1', 'AN2', 'B1'])
  })

  it('marca como recebidos só os que estão em aberto', async () => {
    const aberto = await criarLancamento(db, novo())
    const outroAberto = await criarLancamento(db, novo())
    const jaPago = await criarLancamento(db, novo({ pagamento: 'SIM', pagoEm: '2026-09-01' }))

    const alterados = await marcarComoRecebidos(db, [aberto.id, jaPago.id], '2026-09-14')

    expect(alterados).toBe(1)
    const porId = new Map((await listarLancamentosDoMes(db, '2026-09-01')).map((l) => [l.id, l]))
    expect(porId.get(aberto.id)).toMatchObject({ pagamento: 'SIM', pagoEm: '2026-09-14' })
    expect(porId.get(outroAberto.id)).toMatchObject({ pagamento: 'NAO', pagoEm: null })
    expect(porId.get(jaPago.id)).toMatchObject({ pagamento: 'SIM', pagoEm: '2026-09-01' })
  })

  it('não faz nada quando a lista de ids está vazia', async () => {
    expect(await marcarComoRecebidos(db, [], '2026-09-14')).toBe(0)
  })
})
