'use client'

import { REQUEST_STATUSES } from '@gex/shared'
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs'

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendente',
  APPROVED: 'Aprovada',
  REJECTED: 'Rejeitada',
  PAID: 'Paga',
}

// Um único useQueryStates para os quatro filtros + a página: trocar um
// filtro e voltar a página para 1 precisam ser a MESMA atualização de URL.
// Se fossem duas chamadas separadas (setFilters(...) e depois setPage(1)),
// a navegação do Next dispararia duas vezes e uma janela entre elas deixaria
// a URL num estado inconsistente (filtro novo, página antiga).
const filterParsers = {
  status: parseAsString.withDefault(''),
  supplier: parseAsString.withDefault('').withOptions({ throttleMs: 300 }),
  due_from: parseAsString.withDefault(''),
  due_to: parseAsString.withDefault(''),
  page: parseAsInteger.withDefault(1),
}

export function RequestsFilters() {
  const [filters, setFilters] = useQueryStates(filterParsers)

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="space-y-1">
        <label htmlFor="status" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
          Status
        </label>
        <select
          id="status"
          value={filters.status}
          onChange={(event) => setFilters({ status: event.target.value || null, page: 1 })}
          className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950"
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
        <label htmlFor="supplier" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
          Fornecedor
        </label>
        <input
          id="supplier"
          type="text"
          value={filters.supplier}
          onChange={(event) => setFilters({ supplier: event.target.value || null, page: 1 })}
          placeholder="Buscar por nome"
          className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="due_from" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
          Vencimento de
        </label>
        <input
          id="due_from"
          type="text"
          inputMode="numeric"
          placeholder="AAAA-MM-DD"
          value={filters.due_from}
          onChange={(event) => setFilters({ due_from: event.target.value || null, page: 1 })}
          className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="due_to" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
          Vencimento até
        </label>
        <input
          id="due_to"
          type="text"
          inputMode="numeric"
          placeholder="AAAA-MM-DD"
          value={filters.due_to}
          onChange={(event) => setFilters({ due_to: event.target.value || null, page: 1 })}
          className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950"
        />
      </div>
    </div>
  )
}
