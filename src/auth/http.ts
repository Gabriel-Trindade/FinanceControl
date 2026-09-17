export const DESTINO_PADRAO = '/lancamentos'

/**
 * Ordem importa: x-forwarded-for é enviado por quem faz a requisição, então dá para forjar um
 * IP novo a cada tentativa e burlar o bloqueio de 5 tentativas (src/auth/bloqueio.ts). Por isso
 * preferimos cabeçalhos que a própria plataforma define e não deixa o cliente sobrescrever:
 * x-vercel-forwarded-for (Vercel) e x-real-ip primeiro; x-forwarded-for fica como última opção,
 * só para outras hospedagens que não definem os cabeçalhos acima.
 */
export function obterIp(cabecalhos: Headers): string {
  const primeiroDe = (nome: string) => cabecalhos.get(nome)?.split(',')[0]?.trim()
  return (
    primeiroDe('x-vercel-forwarded-for') ||
    cabecalhos.get('x-real-ip')?.trim() ||
    primeiroDe('x-forwarded-for') ||
    'desconhecido'
  )
}

/**
 * Usa charCodeAt em vez de regex: uma faixa de caracteres de controle numa regex
 * (ex.: /[\x00-\x1f]/) esbarra na regra de lint no-control-regex.
 */
function temCaractereDeControle(valor: string): boolean {
  for (let i = 0; i < valor.length; i++) {
    const codigo = valor.charCodeAt(i)
    if (codigo <= 0x1f || codigo === 0x7f) return true
  }
  return false
}

/**
 * Evita "open redirect": depois do login, só volta para caminhos internos.
 * "//site.com" e "/\site.com" são tratados por navegadores como outro site, e
 * caracteres de controle (tab, quebra de linha etc.) escondidos no meio do caminho também são recusados.
 * O tipo de entrada é `unknown` (em vez de `string | null | undefined`) porque o Next entrega um
 * array quando a mesma chave aparece duas vezes na query (?voltar=/a&voltar=/b), e nesse caso
 * também caímos no destino padrão em vez de estourar (voltar.startsWith não existe em array).
 */
export function destinoSeguro(voltar: unknown): string {
  if (
    typeof voltar !== 'string' ||
    !voltar ||
    !voltar.startsWith('/') ||
    voltar.startsWith('//') ||
    voltar.startsWith('/\\') ||
    temCaractereDeControle(voltar)
  ) {
    return DESTINO_PADRAO
  }
  if (voltar.startsWith('/login')) return DESTINO_PADRAO
  return voltar
}
