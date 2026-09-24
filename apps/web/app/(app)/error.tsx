'use client'

import { useEffect } from 'react'

// Error boundary do grupo autenticado: fica abaixo do layout, então o menu
// continua disponível. Em produção a mensagem de um erro de Server Component
// chega genérica ao browser; o digest liga esta tela ao log do servidor.
export default function AppError({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-16 text-center">
      <h1 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">
        Não foi possível carregar esta página
      </h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Pode ser uma instabilidade momentânea no servidor. Tente novamente em instantes.
      </p>
      {error.digest && (
        <p className="mt-2 font-mono text-xs text-zinc-500">Código: {error.digest}</p>
      )}
      <button
        type="button"
        onClick={() => retry()}
        className="mt-6 rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
      >
        Tentar novamente
      </button>
    </main>
  )
}
