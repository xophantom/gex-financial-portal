'use client'

import { REQUEST_STATUSES } from '@gex/shared'
import { debounce, parseAsInteger, parseAsString, useQueryStates } from 'nuqs'
import { useTransition } from 'react'
import { STATUS_LABELS } from '@/format/labels'

// Filtros e página no mesmo useQueryStates: trocar um filtro e voltar para a
// página 1 precisa ser UMA atualização de URL, não duas navegações.
const filterParsers = {
  status: parseAsString.withDefault(''),
  supplier: parseAsString.withDefault(''),
  due_from: parseAsString.withDefault(''),
  due_to: parseAsString.withDefault(''),
  page: parseAsInteger.withDefault(1),
}

const inputClass =
  'w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950'
const labelClass = 'block text-xs font-medium text-zinc-600 dark:text-zinc-400'

export function RequestsFilters() {
  const [isPending, startTransition] = useTransition()
  // shallow: false — a lista vem do Server Component da rota; sem isso a URL
  // muda só no cliente e os dados não são buscados de novo.
  const [filters, setFilters] = useQueryStates(filterParsers, { shallow: false, startTransition })

  return (
    <div aria-busy={isPending} className="space-y-2">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1">
          <label htmlFor="status" className={labelClass}>
            Status
          </label>
          <select
            id="status"
            value={filters.status}
            onChange={(event) => setFilters({ status: event.target.value || null, page: null })}
            className={inputClass}
          >
            <option value="">Todos</option>
            {REQUEST_STATUSES.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label htmlFor="supplier" className={labelClass}>
            Fornecedor
          </label>
          <input
            id="supplier"
            type="search"
            value={filters.supplier}
            onChange={(event) =>
              // Debounce: busca no servidor só quando o usuário para de digitar.
              setFilters(
                { supplier: event.target.value || null, page: null },
                { limitUrlUpdates: debounce(300) },
              )
            }
            placeholder="Buscar por nome"
            className={inputClass}
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="due_from" className={labelClass}>
            Vencimento de
          </label>
          <input
            id="due_from"
            type="date"
            value={filters.due_from}
            max={filters.due_to || undefined}
            onChange={(event) => setFilters({ due_from: event.target.value || null, page: null })}
            className={inputClass}
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="due_to" className={labelClass}>
            Vencimento até
          </label>
          <input
            id="due_to"
            type="date"
            value={filters.due_to}
            min={filters.due_from || undefined}
            onChange={(event) => setFilters({ due_to: event.target.value || null, page: null })}
            className={inputClass}
          />
        </div>
      </div>

      <p role="status" className="h-4 text-xs text-zinc-500 dark:text-zinc-400">
        {isPending ? 'Atualizando…' : ''}
      </p>
    </div>
  )
}
