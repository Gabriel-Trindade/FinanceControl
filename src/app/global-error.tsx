'use client'

// Último recurso: só dispara quando o erro acontece no próprio layout raiz,
// e por isso precisa renderizar <html> e <body>, que ali já falharam.
export default function ErroGlobal({ retry }: { error: Error; retry: () => void }) {
  return (
    <html lang="pt-BR">
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: 0, padding: '2rem' }}>
        <h1 style={{ fontSize: '1.25rem' }}>O aplicativo não conseguiu iniciar</h1>
        <p style={{ fontSize: '0.875rem' }}>Tente de novo em alguns instantes.</p>
        <button type="button" onClick={() => retry()} style={{ minHeight: '2.75rem', padding: '0 1rem' }}>
          Tentar de novo
        </button>
      </body>
    </html>
  )
}
