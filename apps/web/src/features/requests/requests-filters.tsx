'use client'

import { REQUEST_STATUSES } from '@gex/shared'
import { SearchIcon, XIcon } from 'lucide-react'
import { debounce, parseAsInteger, parseAsString, useQueryStates } from 'nuqs'
import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Spinner } from '@/components/ui/spinner'
import { STATUS_LABELS } from '@/lib/format/labels'

// Filtros e página no mesmo useQueryStates: trocar um filtro e voltar para a
// página 1 precisa ser UMA atualização de URL, não duas navegações.
const filterParsers = {
  status: parseAsString.withDefault(''),
  supplier: parseAsString.withDefault(''),
  due_from: parseAsString.withDefault(''),
  due_to: parseAsString.withDefault(''),
  page: parseAsInteger.withDefault(1),
}

const CLEARED = { status: null, supplier: null, due_from: null, due_to: null, page: null }

export function RequestsFilters() {
  const [isPending, startTransition] = useTransition()
  // shallow: false — a lista vem do Server Component da rota; sem isso a URL
  // muda só no cliente e os dados não são buscados de novo.
  const [filters, setFilters] = useQueryStates(filterParsers, { shallow: false, startTransition })

  const hasFilters = Boolean(
    filters.status || filters.supplier || filters.due_from || filters.due_to,
  )

  return (
    // data-pending permite que a página esmaeça a tabela enquanto a nova
    // lista chega, só com CSS (group-has), sem contexto compartilhado.
    <div
      role="search"
      aria-label="Filtrar solicitações"
      aria-busy={isPending}
      data-pending={isPending || undefined}
      className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end"
    >
      <Field className="gap-1.5 md:w-auto md:min-w-56 md:flex-1">
        <FieldLabel htmlFor="supplier">Fornecedor</FieldLabel>
        <div className="relative">
          <SearchIcon
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
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
            placeholder="Buscar pelo nome"
            autoComplete="off"
            className="bg-card pl-8"
          />
        </div>
      </Field>

      <Field className="gap-1.5 md:w-44">
        <FieldLabel htmlFor="status">Status</FieldLabel>
        <NativeSelect
          id="status"
          value={filters.status}
          onChange={(event) => setFilters({ status: event.target.value || null, page: null })}
          className="w-full [&_select]:bg-card"
        >
          <NativeSelectOption value="">Todos</NativeSelectOption>
          {REQUEST_STATUSES.map((status) => (
            <NativeSelectOption key={status} value={status}>
              {STATUS_LABELS[status]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>

      {/* Um período, não dois filtros soltos: o rótulo nomeia o grupo e cada
          campo mantém um rótulo completo para leitores de tela. */}
      <Field aria-labelledby="due-range-label" className="gap-1.5 md:w-auto">
        <span id="due-range-label" className="text-sm leading-snug font-medium">
          Vencimento
        </span>
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
          <label htmlFor="due_from" className="sr-only">
            Vencimento de
          </label>
          <Input
            id="due_from"
            type="date"
            value={filters.due_from}
            max={filters.due_to || undefined}
            onChange={(event) => setFilters({ due_from: event.target.value || null, page: null })}
            className="bg-card tabular-nums md:w-38"
          />
          <span aria-hidden="true" className="text-sm text-muted-foreground">
            até
          </span>
          <label htmlFor="due_to" className="sr-only">
            Vencimento até
          </label>
          <Input
            id="due_to"
            type="date"
            value={filters.due_to}
            min={filters.due_from || undefined}
            onChange={(event) => setFilters({ due_to: event.target.value || null, page: null })}
            className="bg-card tabular-nums md:w-38"
          />
        </div>
      </Field>

      {/* No desktop o aviso de "atualizando" fica na linha dos rótulos, acima
          do "Limpar filtros": aparecer e sumir não empurra os campos. */}
      <div className="flex items-center gap-3 not-has-[button,svg]:-mt-3 has-[p:empty]:gap-0 md:relative md:ml-auto md:min-h-8 md:not-has-[button,svg]:mt-0">
        <p
          role="status"
          className="flex items-center gap-1.5 text-sm whitespace-nowrap text-muted-foreground md:absolute md:right-0 md:bottom-full md:mb-1.5"
        >
          {isPending && (
            <>
              <Spinner role={undefined} aria-label={undefined} aria-hidden="true" />
              Atualizando…
            </>
          )}
        </p>
        {hasFilters && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => setFilters(CLEARED)}
            className="text-muted-foreground max-md:-ml-2"
          >
            <XIcon data-icon="inline-start" aria-hidden="true" />
            Limpar filtros
          </Button>
        )}
      </div>
    </div>
  )
}
