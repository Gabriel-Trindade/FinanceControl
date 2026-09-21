'use client'

// Captura erro de qualquer página abaixo da raiz. Precisa ser Client Component:
// é o React que chama esta tela quando um componente abaixo lança.
export default function Erro({ retry }: { error: Error; retry: () => void }) {
  return (
    // role="alert" (mesmo padrão de src/app/login/formulario-login.tsx): numa navegação do
    // cliente esta tela SUBSTITUI o conteúdo sem mover o foco, então sem uma região viva quem
    // usa leitor de tela não ouve nada. Aqui, diferente do erro de formulário (que aparece ao
    // lado de um formulário já conhecido), a página inteira troca — por isso o alert cobre o
    // <main> todo (título + explicação), não só o parágrafo.
    <main role="alert" className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-6">
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
