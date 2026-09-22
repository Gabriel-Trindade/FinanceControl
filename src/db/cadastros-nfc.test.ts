import { sql } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { criarBancoDeTeste } from '../../tests/banco-de-teste'
import { normalizarNome, obterOuCriarPessoa } from './cadastros'
import { pessoas } from './schema'

// "José" em duas formas Unicode: iguais na tela, diferentes em bytes.
//
// NFD como literal de código (`'José'` com "e" + acento combinante digitado direto)
// não é confiável aqui: ao passar pelo pipeline de texto do agente que escreveu este
// arquivo, a sequência decomposta foi silenciosamente recomposta para NFC antes de
// chegar ao disco — os dois literais acabavam com os mesmos bytes, e o teste não
// testava nada. Gerar o NFD em tempo de execução com `.normalize('NFD')` evita
// depender de bytes decompostos sobreviverem intactos a essa viagem.
const NFC = 'José' // é como um caractere só
const NFD = NFC.normalize('NFD') // e + acento combinante

describe('normalizarNome', () => {
  it('as duas formas de "José" viram a mesma string', () => {
    expect(NFC).not.toBe(NFD) // confirma que o teste testa algo
    expect(normalizarNome(NFD)).toBe(normalizarNome(NFC))
  })

  it('devolve a forma NFC', () => {
    expect(normalizarNome(NFD)).toBe(NFC)
  })

  it('continua limpando espaços', () => {
    expect(normalizarNome('  Ana   Maria ')).toBe('Ana Maria')
  })
})

it('o mesmo nome em NFC e NFD resolve para uma pessoa só', async () => {
  const { db, fechar } = await criarBancoDeTeste()
  try {
    const primeira = await obterOuCriarPessoa(db, NFD)
    const segunda = await obterOuCriarPessoa(db, NFC)
    expect(segunda.id).toBe(primeira.id)
    expect(await db.$count(pessoas)).toBe(1)
  } finally {
    await fechar()
  }
})

it('a migração normaliza nomes já gravados em NFD', async () => {
  const { db, fechar } = await criarBancoDeTeste()
  try {
    // Insere direto, sem passar por normalizarNome: simula linha gravada antes da correção.
    await db.insert(pessoas).values({ nome: NFD })
    await db.execute(sql`update pessoas set nome = normalize(nome, NFC) where nome <> normalize(nome, NFC)`)

    // Agora a busca por lower(nome) encontra a linha, em vez de criar uma segunda.
    const encontrada = await obterOuCriarPessoa(db, NFC)
    expect(encontrada.nome).toBe(NFC)
    expect(await db.$count(pessoas)).toBe(1)
  } finally {
    await fechar()
  }
})
