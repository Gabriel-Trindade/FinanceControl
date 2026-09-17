import { loadEnvConfig } from '@next/env'
import { defineConfig } from 'drizzle-kit'

// O drizzle-kit não lê o .env.local sozinho; o carregador de variáveis do Next faz isso.
loadEnvConfig(process.cwd())

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: { url: process.env.DATABASE_URL ?? '' },
})
