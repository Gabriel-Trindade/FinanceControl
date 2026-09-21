import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    // Mesmo atalho "@/..." do tsconfig, para os testes importarem igual ao app.
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    // .test.tsx (Rodada de correção 1 da Tarefa 11): renderToStaticMarkup precisa de JSX.
    // O esbuild do Vite já transforma .tsx sozinho (lê o "jsx": "react-jsx" do tsconfig.json)
    // — não precisou de @vitejs/plugin-react nem de environment 'jsdom' para isto.
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'tests/**/*.test.ts'],
  },
})
