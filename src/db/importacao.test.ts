import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import type { LancamentoDaPlanilha } from '@/domain/planilha'
import { criarBancoDeTeste } from '../../tests/banco-de-teste'
import { obterOuCriarCategoria, obterOuCriarPessoa } from './cadastros'
import { codsJaImportados, desfazerImportacao, gravarLote, resolverCadastros } from './importacao'
import { lancamentos, pessoas } from './schema'

/** Um lançamento já traduzido, pronto para gravarLote. Ana/Mercado batem com o mapa
 * que os testes abaixo pedem via resolverCadastros(db, ['Ana'], ['Mercado']). */
function lancamentoDaPlanilha(mudancas: Partial<LancamentoDaPlanilha> = {}): LancamentoDaPlanilha {
  return {
    codPlanilha: 1,
    mesFatura: '2026-09-01',
    pessoa: 'Ana',
    categoria: 'Mercado',
    item: 'Compra',
    valorCentavos: 1000,
    parcelaAtual: 1,
    qtdParcelas: 1,
    recorrente: false,
    pagamento: 'NAO',
    ...mudancas,
  }
}

describe('codsJaImportados', () => {
  it('devolve só os cod_planilha que existem', async () => {
    const { db, fechar } = await criarBancoDeTeste()
    try {
      const mapas = await resolverCadastros(db, ['Ana'], ['Mercado'])
      await gravarLote(
        db,
        [lancamentoDaPlanilha({ codPlanilha: 10 }), lancamentoDaPlanilha({ codPlanilha: 20 })],
        mapas,
      )

      const existentes = await codsJaImportados(db, [10, 20, 30])

      expect(existentes).toEqual(new Set([10, 20]))
    } finally {
      await fechar()
    }
  })
})

describe('gravarLote', () => {
  it('grava e devolve a quantidade inserida', async () => {
    const { db, fechar } = await criarBancoDeTeste()
    try {
      const mapas = await resolverCadastros(db, ['Ana'], ['Mercado'])
      const gravados = await gravarLote(
        db,
        [lancamentoDaPlanilha({ codPlanilha: 1 }), lancamentoDaPlanilha({ codPlanilha: 2 })],
        mapas,
      )

      expect(gravados).toBe(2)
      expect(await db.$count(lancamentos)).toBe(2)
    } finally {
      await fechar()
    }
  })

  it('rodar gravarLote duas vezes com o mesmo lote não duplica', async () => {
    const { db, fechar } = await criarBancoDeTeste()
    try {
      const mapas = await resolverCadastros(db, ['Ana'], ['Mercado'])
      const lote = [lancamentoDaPlanilha({ codPlanilha: 1 }), lancamentoDaPlanilha({ codPlanilha: 2 })]

      const primeira = await gravarLote(db, lote, mapas)
      const segunda = await gravarLote(db, lote, mapas)

      expect(primeira).toBe(2)
      expect(segunda).toBe(0)
      expect(await db.$count(lancamentos)).toBe(2)
    } finally {
      await fechar()
    }
  })

  it('CÓD da planilha não colide com id de lançamento manual', async () => {
    const { db, fechar } = await criarBancoDeTeste()
    try {
      const pessoa = await obterOuCriarPessoa(db, 'Ana')
      const categoria = await obterOuCriarCategoria(db, 'Mercado')
      // Um lançamento manual consome o id 1.
      await db.insert(lancamentos).values({
        mesFatura: '2026-09-01', pessoaId: pessoa.id, categoriaId: categoria.id,
        item: 'Manual', valorCentavos: 500, parcelaAtual: 1, qtdParcelas: 1,
        recorrente: false, fonte: 'manual',
      })

      // A planilha traz CÓD 1. Antes da D12 isso seria descartado em silêncio.
      const mapas = await resolverCadastros(db, ['Ana'], ['Mercado'])
      const gravados = await gravarLote(db, [lancamentoDaPlanilha({ codPlanilha: 1 })], mapas)

      expect(gravados).toBe(1)
      const todos = await db.select({ id: lancamentos.id }).from(lancamentos)
      expect(todos).toHaveLength(2)
    } finally {
      await fechar()
    }
  })

  it('grava com fonte "planilha" — o desfazer depende disso', async () => {
    const { db, fechar } = await criarBancoDeTeste()
    try {
      const mapas = await resolverCadastros(db, ['Ana'], ['Mercado'])
      await gravarLote(db, [lancamentoDaPlanilha({ codPlanilha: 1 })], mapas)

      const [gravado] = await db.select({ fonte: lancamentos.fonte }).from(lancamentos)
      expect(gravado.fonte).toBe('planilha')
    } finally {
      await fechar()
    }
  })

  it('reenviar não altera o que já existe (não sobrescreve, diferente de não duplicar)', async () => {
    const { db, fechar } = await criarBancoDeTeste()
    try {
      const mapas = await resolverCadastros(db, ['Ana'], ['Mercado'])
      const lote = [lancamentoDaPlanilha({ codPlanilha: 1 })]
      await gravarLote(db, lote, mapas)

      // O dono marca como recebido no app...
      await db.update(lancamentos).set({ pagamento: 'SIM' }).where(eq(lancamentos.codPlanilha, 1))

      // ...e reenvia a mesma planilha (ex.: linhas novas em outra faixa do arquivo).
      await gravarLote(db, lote, mapas)

      const [gravado] = await db.select({ pagamento: lancamentos.pagamento }).from(lancamentos)
      expect(gravado.pagamento).toBe('SIM')
    } finally {
      await fechar()
    }
  })

  it('retomada depois de falha: reenviar lotes já gravados junto com lotes novos não duplica', async () => {
    const { db, fechar } = await criarBancoDeTeste()
    try {
      const mapas = await resolverCadastros(db, ['Ana'], ['Mercado'])
      const lote1 = [lancamentoDaPlanilha({ codPlanilha: 1 }), lancamentoDaPlanilha({ codPlanilha: 2 })]
      const lote2 = [lancamentoDaPlanilha({ codPlanilha: 3 }), lancamentoDaPlanilha({ codPlanilha: 4 })]

      // Primeira tentativa: lote 1 grava; lote 2 "falha" — simulado por nunca ser chamado.
      await gravarLote(db, lote1, mapas)

      // Tentar de novo manda os dois lotes, inclusive o que já tinha ido.
      const resultadoLote1 = await gravarLote(db, lote1, mapas)
      const resultadoLote2 = await gravarLote(db, lote2, mapas)

      expect(resultadoLote1).toBe(0)
      expect(resultadoLote2).toBe(2)
      expect(await db.$count(lancamentos)).toBe(4)
    } finally {
      await fechar()
    }
  })
})

describe('resolverCadastros', () => {
  it('devolve um mapa e não cria duplicata quando o mesmo nome vem em grafias diferentes', async () => {
    const { db, fechar } = await criarBancoDeTeste()
    try {
      const mapas = await resolverCadastros(db, ['Ana', 'ANA'], ['Mercado'])

      expect(mapas.pessoas.size).toBe(1)
      expect(await db.$count(pessoas)).toBe(1)

      // As duas grafias precisam resolver pela mesma entrada do mapa na hora de gravar.
      const gravados = await gravarLote(
        db,
        [
          lancamentoDaPlanilha({ codPlanilha: 1, pessoa: 'Ana' }),
          lancamentoDaPlanilha({ codPlanilha: 2, pessoa: 'ANA' }),
        ],
        mapas,
      )
      expect(gravados).toBe(2)
    } finally {
      await fechar()
    }
  })
})

describe('desfazerImportacao', () => {
  it('apaga só fonte = planilha, deixando manual intacto', async () => {
    const { db, fechar } = await criarBancoDeTeste()
    try {
      const pessoa = await obterOuCriarPessoa(db, 'Ana')
      const categoria = await obterOuCriarCategoria(db, 'Mercado')
      await db.insert(lancamentos).values({
        mesFatura: '2026-09-01', pessoaId: pessoa.id, categoriaId: categoria.id,
        item: 'Manual', valorCentavos: 500, parcelaAtual: 1, qtdParcelas: 1,
        recorrente: false, fonte: 'manual',
      })

      const mapas = await resolverCadastros(db, ['Ana'], ['Mercado'])
      await gravarLote(
        db,
        [lancamentoDaPlanilha({ codPlanilha: 1 }), lancamentoDaPlanilha({ codPlanilha: 2 })],
        mapas,
      )

      const apagados = await desfazerImportacao(db)

      expect(apagados).toBe(2)
      const restantes = await db.select({ item: lancamentos.item, fonte: lancamentos.fonte }).from(lancamentos)
      expect(restantes).toEqual([{ item: 'Manual', fonte: 'manual' }])
    } finally {
      await fechar()
    }
  })
})
