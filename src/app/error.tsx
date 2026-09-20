'use client'

// Captura erro de qualquer página abaixo da raiz. Precisa ser Client Component:
// é o React que chama esta tela quando um componente abaixo lança.
export default function Erro({ retry }: { error: Error; retry: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-6">
      <h1 className="text-xl font-semibold">Alguma coisa deu errado</h1>
      <p className="text-sm text-muted-foreground">
        Não foi possível carregar esta página. Isso costuma ser falha de conexão com o banco.
      </p>
      <button
        type="button"
        onClick={() => retry()}
        className="min-h-11 rounded-md border px-4 text-sm font-medium"
      >
        Tentar de novo
      </button>
    </main>
  )
}
