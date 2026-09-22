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

  it('grava cada um dos 13 campos do mapeamento com o valor da linha certa, não uma constante', async () => {
    const { db, fechar, consultas } = await criarBancoDeTeste({ registrarConsultas: true })
    try {
      const mapas = await resolverCadastros(db, ['Ana', 'Beto'], ['Mercado', 'Lazer'])
      // Ids reais do banco, para comparar a linha inteira sem adivinhar o formato
      // interno da chave do mapa (chaveDoNome não é exportada, de propósito).
      const anaId = (await obterOuCriarPessoa(db, 'Ana')).id
      const betoId = (await obterOuCriarPessoa(db, 'Beto')).id
      const mercadoId = (await obterOuCriarCategoria(db, 'Mercado')).id
      const lazerId = (await obterOuCriarCategoria(db, 'Lazer')).id

      // As duas linhas diferem em TODO campo que o mapeamento copia — valor, item,
      // mês, pessoa, categoria, parcela, quantidade, recorrente e pagamento. Só assim
      // um "copiei o campo errado" ou "usei uma constante" (ex.: valorCentavos: 0,
      // ou pessoaId sempre do primeiro mapa) fica impossível de disfarçar: com as
      // duas linhas iguais (só o CÓD diferente), uma constante bateria com uma das
      // duas por acaso, do mesmo jeito que "CÓD repetido" da Tarefa 7 exigia item
      // diferente por linha para provar "mantém o primeiro" de "último vence".
      const primeiro = lancamentoDaPlanilha({
        codPlanilha: 1, mesFatura: '2026-09-01', pessoa: 'Ana', categoria: 'Mercado',
        item: 'Compra do mês', valorCentavos: 15050, parcelaAtual: 1, qtdParcelas: 3,
        recorrente: false, pagamento: 'SIM',
      })
      const segundo = lancamentoDaPlanilha({
        codPlanilha: 2, mesFatura: '2026-10-01', pessoa: 'Beto', categoria: 'Lazer',
        item: 'Assinatura', valorCentavos: 2990, parcelaAtual: 7, qtdParcelas: null,
        recorrente: true, pagamento: 'NAO',
      })

      await gravarLote(db, [primeiro, segundo], mapas)

      const linhas = await db.select().from(lancamentos).orderBy(lancamentos.codPlanilha)
      // Lista explícita dos 13 campos do mapeamento — id, criadoEm e atualizadoEm ficam
      // de fora porque vêm do banco (default/sequência), não são o que este teste prova.
      const gravado = linhas.map((l) => ({
        mesFatura: l.mesFatura, dataCompra: l.dataCompra, codPlanilha: l.codPlanilha,
        pessoaId: l.pessoaId, categoriaId: l.categoriaId, item: l.item,
        valorCentavos: l.valorCentavos, parcelaAtual: l.parcelaAtual,
        qtdParcelas: l.qtdParcelas, recorrente: l.recorrente, pagamento: l.pagamento,
        pagoEm: l.pagoEm, fonte: l.fonte,
      }))

      expect(gravado).toEqual([
        {
          mesFatura: '2026-09-01', dataCompra: null, codPlanilha: 1,
          pessoaId: anaId, categoriaId: mercadoId, item: 'Compra do mês',
          valorCentavos: 15050, parcelaAtual: 1, qtdParcelas: 3, recorrente: false,
          pagamento: 'SIM', pagoEm: null, fonte: 'planilha',
        },
        {
          mesFatura: '2026-10-01', dataCompra: null, codPlanilha: 2,
          pessoaId: betoId, categoriaId: lazerId, item: 'Assinatura',
          valorCentavos: 2990, parcelaAtual: 7, qtdParcelas: null, recorrente: true,
          pagamento: 'NAO', pagoEm: null, fonte: 'planilha',
        },
      ])

      // O target do ON CONFLICT é carga útil (falha alto contra índice parcial — ver
      // Mutação 1 do relatório — e não engole em silêncio um conflito de outra
      // constraint), então fica fixado aqui, na consulta de verdade que gravarLote
      // gerou, não só no comportamento (que .onConflictDoNothing() sem target não
      // distingue, já que hoje só existe UM índice único na tabela).
      const insercaoDoLote = consultas.find((q) => q.startsWith('insert into "lancamentos"'))
      expect(insercaoDoLote).toContain('on conflict ("cod_planilha")')
    } finally {
      await fechar()
    }
  })

  it('lote vazio não chama o banco e devolve 0', async () => {
    const { db, fechar } = await criarBancoDeTeste()
    try {
      const gravados = await gravarLote(db, [], { pessoas: new Map(), categorias: new Map() })
      expect(gravados).toBe(0)
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

  it('faz uma quantidade de consultas proporcional aos nomes distintos, não ao tamanho do array', async () => {
    const { db, fechar, consultas } = await criarBancoDeTeste({ registrarConsultas: true })
    try {
      const NOMES_DE_PESSOA = ['Ana', 'Beto', 'Carla']
      const NOMES_DE_CATEGORIA = ['Mercado', 'Lazer']
      // 300 "linhas de planilha", só 5 nomes distintos no total — a mesma proporção
      // (poucas dezenas contra milhares) da planilha real (spec §6.6: ~44 distintos
      // contra 4.805 linhas). Sem o dedup (new Set) dentro de resolverCadastros, isto
      // vira 300 + 300 idas ao banco em vez de 5; no Neon HTTP (~40ms por ida) é a
      // diferença entre a Server Action responder e estourar o tempo.
      const pessoas = Array.from({ length: 300 }, (_, i) => NOMES_DE_PESSOA[i % NOMES_DE_PESSOA.length])
      const categorias = Array.from(
        { length: 300 },
        (_, i) => NOMES_DE_CATEGORIA[i % NOMES_DE_CATEGORIA.length],
      )

      await resolverCadastros(db, pessoas, categorias)

      // obterOuCriar faz exatamente 2 consultas por nome NOVO (busca vazia + insert;
      // a terceira busca do "??" só roda na corrida rara de duas escritas concorrentes,
      // que não acontece aqui). 5 nomes distintos (3 pessoas + 2 categorias) × 2.
      expect(consultas).toHaveLength((NOMES_DE_PESSOA.length + NOMES_DE_CATEGORIA.length) * 2)
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
