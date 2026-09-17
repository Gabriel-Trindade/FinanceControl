import type { Db } from '@/db/tipos'
import { consultarBloqueio, limparFalhas, registrarFalha } from './bloqueio'
import { verificarSenha } from './senha'

export type ResultadoLogin = { ok: true } | { ok: false; erro: string }

export async function autenticar(
  db: Db,
  credenciais: { usuario: string; senha: string },
  esperado: { usuario: string; senhaHash: string },
  ip: string,
): Promise<ResultadoLogin> {
  const bloqueio = await consultarBloqueio(db, ip)
  if (bloqueio.bloqueado) {
    const minutos = bloqueio.minutosRestantes
    return {
      ok: false,
      erro: `Muitas tentativas. Tente de novo em ${minutos} ${minutos === 1 ? 'minuto' : 'minutos'}.`,
    }
  }

  // Grava a tentativa ANTES de checar a senha. O scrypt demora ~100ms: se a gravação
  // fosse depois, requisições paralelas passariam todas pela checagem de bloqueio antes
  // de qualquer uma registrar a falha. No sucesso, limparFalhas desfaz esta gravação.
  await registrarFalha(db, ip)

  const senhaConfere = await verificarSenha(credenciais.senha, esperado.senhaHash)
  if (senhaConfere && credenciais.usuario === esperado.usuario) {
    await limparFalhas(db, ip)
    return { ok: true }
  }

  // Não grava de novo aqui: a tentativa já foi gravada acima.
  return { ok: false, erro: 'Usuário ou senha incorretos.' }
}
