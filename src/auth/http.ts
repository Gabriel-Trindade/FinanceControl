export const DESTINO_PADRAO = '/lancamentos'

/** Na Vercel, o x-forwarded-for traz o IP real de quem acessou. */
export function obterIp(cabecalhos: Headers): string {
  const encaminhado = cabecalhos.get('x-forwarded-for')?.split(',')[0]?.trim()
  return encaminhado || cabecalhos.get('x-real-ip')?.trim() || 'desconhecido'
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
 */
export function destinoSeguro(voltar: string | null | undefined): string {
  if (
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
