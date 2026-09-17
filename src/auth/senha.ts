import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'

const PREFIXO = 'scrypt'
const TAMANHO_CHAVE = 64
// p=2 (mínimo recomendado pela OWASP para scrypt, contra p=1) custa mais CPU por hash.
const PARAMETROS = { N: 2 ** 16, r: 8, p: 2 }
// N=2^16 usa ~64 MB; o limite padrão do Node é 32 MB, então liberamos 128 MB.
// (O teto do Node é 128*N*r, sem o "p": subir p não muda essa conta, só o tempo de CPU.)
const MEMORIA_MAXIMA = 128 * 1024 * 1024

type Parametros = { N: number; r: number; p: number }

function derivar(senha: string, sal: Buffer, { N, r, p }: Parametros): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(senha, sal, TAMANHO_CHAVE, { N, r, p, maxmem: MEMORIA_MAXIMA }, (erro, chave) =>
      erro ? reject(erro) : resolve(chave),
    )
  })
}

/**
 * Separador ":" em vez de "$": o carregador de .env do Next trata "$NOME" como variável
 * e estragaria o hash.
 */
export async function gerarHashSenha(senha: string): Promise<string> {
  const sal = randomBytes(16)
  const chave = await derivar(senha, sal, PARAMETROS)
  return [
    PREFIXO,
    PARAMETROS.N,
    PARAMETROS.r,
    PARAMETROS.p,
    sal.toString('base64url'),
    chave.toString('base64url'),
  ].join(':')
}

/** Confere a senha contra o hash salvo; hash malformado ou senha errada → false. */
export async function verificarSenha(senha: string, hashSalvo: string): Promise<boolean> {
  const partes = hashSalvo.split(':')
  if (partes.length !== 6 || partes[0] !== PREFIXO) return false

  const [N, r, p] = partes.slice(1, 4).map(Number)
  if (![N, r, p].every((n) => Number.isSafeInteger(n) && n > 0)) return false

  const esperado = Buffer.from(partes[5], 'base64url')
  if (esperado.length !== TAMANHO_CHAVE) return false

  try {
    const chave = await derivar(senha, Buffer.from(partes[4], 'base64url'), { N, r, p })
    // Comparação em tempo constante: não revela, pela demora, quantos bytes acertaram.
    return timingSafeEqual(chave, esperado)
  } catch {
    return false
  }
}
