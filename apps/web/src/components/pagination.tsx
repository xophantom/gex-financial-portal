'use client'

import { parseAsInteger, useQueryState } from 'nuqs'

// Só a página é gerida aqui: trocar de página nunca deve zerar os outros
// filtros, ao contrário de trocar um filtro (que sempre volta para a página
// 1, em requests-filters.tsx).
export function Pagination({ page, totalPages }: { page: number; totalPages: number }) {
  const [, setPage] = useQueryState('page', parseAsInteger.withDefault(1))

  if (totalPages <= 1) return null

  return (
    <nav aria-label="Paginação" className="flex items-center justify-between pt-4 text-sm">
      <button
        type="button"
        onClick={() => setPage(page - 1)}
        disabled={page <= 1}
        className="rounded-md border border-zinc-300 px-3 py-1.5 font-medium text-zinc-700 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300"
      >
        Anterior
      </button>
      <span className="text-zinc-600 dark:text-zinc-400">
        Página {page} de {totalPages}
      </span>
      <button
        type="button"
        onClick={() => setPage(page + 1)}
        disabled={page >= totalPages}
        className="rounded-md border border-zinc-300 px-3 py-1.5 font-medium text-zinc-700 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300"
      >
        Próxima
      </button>
    </nav>
  )
}
