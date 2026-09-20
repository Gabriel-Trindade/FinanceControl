import type { Celula } from '@/domain/planilha'

export const COLUNAS_ESPERADAS = [
  'CÓD', 'VENCIMENTO', 'ANO', 'MÊS', 'CATEGORIA', 'ITEM', 'VALOR',
  'PARCELA ATUAL', 'QTD PARCELAS', 'SUBTOTAL', 'RESTANTE', 'ORIGEM', 'PAGO?', 'SITUAÇÃO',
] as const

const NOME_DA_ABA = 'GASTOS'

/** Erro que a tela mostra direto para o dono: a mensagem já está em português. */
export class ErroDeLeitura extends Error {
  constructor(mensagem: string) {
    super(mensagem)
    this.name = 'ErroDeLeitura'
  }
}

function normalizar(celula: Celula): string {
  return String(celula ?? '').normalize('NFC').trim().toLocaleUpperCase('pt-BR')
}

/** Confere que a aba tem as 14 colunas esperadas, na ordem. Lança ErroDeLeitura se não tiver. */
export function conferirCabecalho(primeiraLinha: Celula[]): void {
  if (primeiraLinha.length === 0) {
    throw new ErroDeLeitura('A aba GASTOS está vazia.')
  }
  const lidas = primeiraLinha.map(normalizar)
  const esperadas = COLUNAS_ESPERADAS.map((c) => normalizar(c))

  const faltando = esperadas.filter((c) => !lidas.includes(c))
  if (faltando.length > 0) {
    throw new ErroDeLeitura(`A planilha não tem a coluna ${faltando.join(', ')}.`)
  }
  // Ordem importa: a tradução lê por posição, não por nome.
  const foraDeOrdem = esperadas.findIndex((c, i) => lidas[i] !== c)
  if (foraDeOrdem !== -1) {
    throw new ErroDeLeitura(
      `A coluna ${esperadas[foraDeOrdem]} deveria ser a ${foraDeOrdem + 1}ª, mas veio ` +
        `"${primeiraLinha[foraDeOrdem] ?? ''}".`,
    )
  }
}

/** Traduz o erro da biblioteca numa mensagem que o dono entende. Separado para ter teste. */
export function mapearErroDeLeitura(
  erro: unknown,
  tipos: {
    SheetNotFoundError: new (...args: never[]) => Error
    InvalidSpreadsheetError: new (...args: never[]) => Error
    InvalidInputError: new (...args: never[]) => Error
  },
): ErroDeLeitura {
  if (erro instanceof ErroDeLeitura) return erro
  if (erro instanceof tipos.SheetNotFoundError) {
    return new ErroDeLeitura(`A planilha não tem a aba "${NOME_DA_ABA}".`)
  }
  if (erro instanceof tipos.InvalidSpreadsheetError) {
    return new ErroDeLeitura('O arquivo não é uma planilha válida, ou está protegido por senha.')
  }
  if (erro instanceof tipos.InvalidInputError) {
    return new ErroDeLeitura('Não foi possível ler o arquivo. Ele precisa ser um .xlsx.')
  }
  return new ErroDeLeitura('Não foi possível ler o arquivo.')
}

/**
 * Abre o .xlsx no próprio aparelho e devolve as linhas de dados, sem o cabeçalho.
 * O import é dinâmico para a biblioteca só viajar até o navegador nesta tela.
 */
export async function lerPlanilha(arquivo: File): Promise<Celula[][]> {
  const modulo = await import('read-excel-file/browser')

  let linhas: Celula[][]
  try {
    linhas = (await modulo.readSheet(arquivo, NOME_DA_ABA)) as Celula[][]
  } catch (erro) {
    throw mapearErroDeLeitura(erro, modulo)
  }

  const [cabecalho, ...dados] = linhas
  conferirCabecalho(cabecalho ?? [])
  return dados
}
