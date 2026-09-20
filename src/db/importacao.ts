import { eq, inArray } from 'drizzle-orm'
import type { LancamentoDaPlanilha } from '@/domain/planilha'
import { normalizarNome } from '@/domain/texto'
import { obterOuCriarCategoria, obterOuCriarPessoa } from './cadastros'
import { lancamentos } from './schema'
import type { Db } from './tipos'

// Reexportado por conveniência de quem já importa deste módulo (Tarefa 10). A tela de
// importação (cliente) importa direto de @/importacao/lotes — ver a nota lá.
export { TAMANHO_DO_LOTE } from '@/importacao/lotes'

/**
 * Chave do mapa nome → id, igual nos dois lados (resolverCadastros monta, gravarLote
 * consulta). O banco compara pessoa/categoria por lower(nome) (pessoas_nome_unico), então
 * "Ana" e "ANA" são a mesma linha lá — sem baixar a caixa aqui, as duas grafias
 * criariam chaves diferentes para o mesmo id, e gravarLote não acharia uma delas.
 */
function chaveDoNome(nome: string): string {
  return normalizarNome(nome).toLocaleLowerCase('pt-BR')
}

/** Quais desses cod_planilha já existem no banco. Só a coluna, nunca a linha inteira. */
export async function codsJaImportados(db: Db, cods: number[]): Promise<Set<number>> {
  if (cods.length === 0) return new Set()
  const linhas = await db
    .select({ codPlanilha: lancamentos.codPlanilha })
    .from(lancamentos)
    .where(inArray(lancamentos.codPlanilha, cods))
  // O filtro é só para o tipo (a coluna é nullable no schema): o próprio WHERE já
  // garante que só cods concretos (nunca NULL) podem ter entrado no resultado.
  return new Set(linhas.map((l) => l.codPlanilha).filter((c): c is number => c !== null))
}

/**
 * Resolve pessoa e categoria por nome distinto — uma vez cada, não uma vez por linha
 * (~44 nomes contra 4.805 linhas da planilha; obterOuCriarPessoa dentro do laço das
 * linhas seriam ~9.600 idas ao banco). Devolve um mapa nome normalizado → id.
 */
export async function resolverCadastros(
  db: Db,
  pessoas: string[],
  categorias: string[],
): Promise<{ pessoas: Map<string, number>; categorias: Map<string, number> }> {
  const mapaPessoas = new Map<string, number>()
  for (const nome of new Set(pessoas)) {
    const pessoa = await obterOuCriarPessoa(db, nome)
    mapaPessoas.set(chaveDoNome(nome), pessoa.id)
  }

  const mapaCategorias = new Map<string, number>()
  for (const nome of new Set(categorias)) {
    const categoria = await obterOuCriarCategoria(db, nome)
    mapaCategorias.set(chaveDoNome(nome), categoria.id)
  }

  return { pessoas: mapaPessoas, categorias: mapaCategorias }
}

/**
 * Grava um lote inteiro num único INSERT ... ON CONFLICT (cod_planilha) DO NOTHING —
 * nunca um INSERT por linha. Idempotente: reenviar o mesmo lote não duplica (D2) nem
 * altera o que já existe (o DO NOTHING não toca a linha em conflito).
 * Devolve quantas linhas entraram de fato.
 */
export async function gravarLote(
  db: Db,
  lote: LancamentoDaPlanilha[],
  mapas: { pessoas: Map<string, number>; categorias: Map<string, number> },
): Promise<number> {
  if (lote.length === 0) return 0

  const valores = lote.map((l) => {
    const pessoaId = mapas.pessoas.get(chaveDoNome(l.pessoa))
    if (pessoaId === undefined) {
      throw new Error(`gravarLote: pessoa "${l.pessoa}" não está no mapa de resolverCadastros`)
    }
    const categoriaId = mapas.categorias.get(chaveDoNome(l.categoria))
    if (categoriaId === undefined) {
      throw new Error(`gravarLote: categoria "${l.categoria}" não está no mapa de resolverCadastros`)
    }

    return {
      codPlanilha: l.codPlanilha,
      mesFatura: l.mesFatura,
      pessoaId,
      categoriaId,
      item: l.item,
      valorCentavos: l.valorCentavos,
      parcelaAtual: l.parcelaAtual,
      qtdParcelas: l.qtdParcelas,
      recorrente: l.recorrente,
      pagamento: l.pagamento,
      // Os três campos que a spec §6.2 fixa e que a planilha não traz.
      fonte: 'planilha' as const,
      pagoEm: null,
      dataCompra: null,
    }
  })

  const gravados = await db
    .insert(lancamentos)
    .values(valores)
    .onConflictDoNothing({ target: lancamentos.codPlanilha })
    .returning({ id: lancamentos.id })

  return gravados.length
}

/** Desfazer importação (D11): apaga só o que veio da planilha. Devolve quantas linhas saíram. */
export async function desfazerImportacao(db: Db): Promise<number> {
  const apagados = await db
    .delete(lancamentos)
    .where(eq(lancamentos.fonte, 'planilha'))
    .returning({ id: lancamentos.id })
  return apagados.length
}
