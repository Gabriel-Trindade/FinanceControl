import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

export const pagamentoEnum = pgEnum('pagamento', ['NAO', 'SIM', 'PERDOADO'])
export const fonteEnum = pgEnum('fonte', ['manual', 'planilha', 'fatura', 'virada'])

export const pessoas = pgTable(
  'pessoas',
  {
    id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
    nome: text('nome').notNull(),
    ativo: boolean('ativo').notNull().default(true),
    criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Índice sobre lower(nome): "Ana" e "ANA" contam como o mesmo nome.
    uniqueIndex('pessoas_nome_unico').on(sql`lower(${t.nome})`),
    check('pessoas_nome_preenchido', sql`length(trim(${t.nome})) > 0`),
  ],
)

export const categorias = pgTable(
  'categorias',
  {
    id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
    nome: text('nome').notNull(),
    ativo: boolean('ativo').notNull().default(true),
    criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('categorias_nome_unico').on(sql`lower(${t.nome})`),
    check('categorias_nome_preenchido', sql`length(trim(${t.nome})) > 0`),
  ],
)

export const lancamentos = pgTable(
  'lancamentos',
  {
    // Identidade só do banco: sempre gerada pela sequência, em qualquer INSERT — nunca guarda
    // nem se relaciona com o CÓD da planilha (esse é cod_planilha, a coluna logo abaixo).
    id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
    mesFatura: date('mes_fatura', { mode: 'string' }).notNull(),
    dataCompra: date('data_compra', { mode: 'string' }),
    // CÓD da planilha. Fica separado do id porque são duas numerações independentes:
    // o id é do banco, o CÓD é do Excel. Juntá-los faria um lançamento manual roubar
    // o número de uma linha futura da planilha, e o reenvio aditivo pararia de funcionar.
    codPlanilha: integer('cod_planilha'),
    pessoaId: integer('pessoa_id')
      .notNull()
      .references(() => pessoas.id, { onDelete: 'restrict' }),
    categoriaId: integer('categoria_id')
      .notNull()
      .references(() => categorias.id, { onDelete: 'restrict' }),
    item: text('item').notNull(),
    valorCentavos: integer('valor_centavos').notNull(),
    parcelaAtual: smallint('parcela_atual').notNull().default(1),
    qtdParcelas: smallint('qtd_parcelas'),
    recorrente: boolean('recorrente').notNull().default(false),
    pagamento: pagamentoEnum('pagamento').notNull().default('NAO'),
    pagoEm: date('pago_em', { mode: 'string' }),
    fonte: fonteEnum('fonte').notNull().default('manual'),
    criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
    atualizadoEm: timestamp('atualizado_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('lancamentos_mes_fatura_dia_1', sql`extract(day from ${t.mesFatura}) = 1`),
    check('lancamentos_item_preenchido', sql`length(trim(${t.item})) > 0`),
    check('lancamentos_parcela_atual_positiva', sql`${t.parcelaAtual} >= 1`),
    check(
      'lancamentos_parcelas_coerentes',
      sql`(${t.recorrente} and ${t.qtdParcelas} is null) or (not ${t.recorrente} and ${t.qtdParcelas} is not null and ${t.qtdParcelas} >= ${t.parcelaAtual})`,
    ),
    check('lancamentos_pago_em_so_com_sim', sql`${t.pagoEm} is null or ${t.pagamento} = 'SIM'`),
    // NULL passa direto (lançamento manual sem CÓD); só um valor preenchido menor que 1 é
    // recusado. Ancorado no banco como os outros CHECKs da tabela — a spec §6.2 pede "inteiro
    // ≥ 1", e o leitor/Zod da Tarefa 10 não são a única linha de defesa.
    check('lancamentos_cod_planilha_positivo', sql`${t.codPlanilha} >= 1`),
    index('lancamentos_mes_fatura_idx').on(t.mesFatura),
    index('lancamentos_pessoa_pagamento_idx').on(t.pessoaId, t.pagamento),
    // Índice simples, não parcial: o Postgres trata cada NULL como distinto dos outros,
    // então muitos lançamentos manuais sem CÓD convivem aqui sem conflito. Um índice
    // parcial quebraria o ON CONFLICT da gravação, que só reconhece índice parcial
    // quando a cláusula WHERE dele é repetida na consulta.
    uniqueIndex('lancamentos_cod_planilha_unico').on(t.codPlanilha),
  ],
)

export const tentativasLogin = pgTable(
  'tentativas_login',
  {
    id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
    ip: text('ip').notNull(),
    criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('tentativas_login_ip_criado_em_idx').on(t.ip, t.criadoEm)],
)
