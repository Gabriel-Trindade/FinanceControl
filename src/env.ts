import { z } from 'zod'

const esquema = z.object({
  DATABASE_URL: z.string().startsWith('postgres', 'DATABASE_URL precisa ser uma conexão postgresql://'),
  AUTH_USUARIO: z.string().trim().min(1, 'AUTH_USUARIO está vazio'),
  AUTH_SENHA_HASH: z
    .string()
    .regex(
      /^scrypt:\d+:\d+:\d+:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$/,
      'AUTH_SENHA_HASH precisa ter o formato "scrypt:N:r:p:sal:hash" (gere com npm run credenciais)',
    ),
  AUTH_SEGREDO: z.string().min(32, 'AUTH_SEGREDO precisa ter pelo menos 32 caracteres'),
})

export type Env = z.infer<typeof esquema>

/** Valida as variáveis e junta todos os problemas numa mensagem só. */
export function lerEnv(fonte: Record<string, string | undefined>): Env {
  const resultado = esquema.safeParse(fonte)
  if (!resultado.success) {
    const problemas = resultado.error.issues
      .map((problema) => `- ${problema.path.join('.')}: ${problema.message}`)
      .join('\n')
    throw new Error(`Variáveis de ambiente inválidas:\n${problemas}`)
  }
  return resultado.data
}

let cache: Env | undefined

/** Lê e valida uma única vez. Use só no servidor. */
export function obterEnv(): Env {
  cache ??= lerEnv(process.env)
  return cache
}
