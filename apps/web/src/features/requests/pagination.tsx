'use client'

import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { parseAsInteger, useQueryState } from 'nuqs'
import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'

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
    <nav
      aria-label="Paginação"
      aria-busy={isPending}
      data-pending={isPending || undefined}
      className="flex items-center justify-between gap-3 border-t border-border px-4 py-3"
    >
      <p className="flex items-center gap-2 text-sm text-muted-foreground tabular-nums">
        {isPending && <Spinner role={undefined} aria-label={undefined} aria-hidden="true" />}
        <span>
          Página <span className="font-medium text-foreground">{page}</span> de {totalPages}
        </span>
      </p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => setPage(page - 1)}
          disabled={isPending || page <= 1}
        >
          <ChevronLeftIcon data-icon="inline-start" aria-hidden="true" />
          Anterior
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => setPage(page + 1)}
          disabled={isPending || page >= totalPages}
        >
          Próxima
          <ChevronRightIcon data-icon="inline-end" aria-hidden="true" />
        </Button>
      </div>
    </nav>
  )
}
