'use client'

import { parseAsInteger, useQueryState } from 'nuqs'
import { useTransition } from 'react'

const buttonClass =
  'rounded-md border border-zinc-300 px-3 py-1.5 font-medium text-zinc-700 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300'

// Só a página é gerida aqui: trocar de página preserva os filtros atuais.
export function Pagination({ page, totalPages }: { page: number; totalPages: number }) {
  const [isPending, startTransition] = useTransition()
  // shallow: false — a lista vem do Server Component da rota.
  const [, setPage] = useQueryState(
    'page',
    parseAsInteger.withDefault(1).withOptions({ shallow: false, startTransition }),
  )

  if (totalPages <= 1) return null

  return (
    <nav aria-label="Paginação" aria-busy={isPending} className="flex items-center justify-between pt-4 text-sm">
      <button
        type="button"
        onClick={() => setPage(page - 1)}
        disabled={isPending || page <= 1}
        className={buttonClass}
      >
        Anterior
      </button>
      <span className="text-zinc-600 dark:text-zinc-400">
        Página {page} de {totalPages}
      </span>
      <button
        type="button"
        onClick={() => setPage(page + 1)}
        disabled={isPending || page >= totalPages}
        className={buttonClass}
      >
        Próxima
      </button>
    </nav>
  )
}
