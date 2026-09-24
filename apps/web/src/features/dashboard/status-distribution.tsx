import type { RequestStatus } from '@gex/shared'
import { ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { STATUS_STYLE } from '@/components/status/status-style'
import { statusLabel } from '@/lib/format/labels'
import { cn } from '@/lib/utils'
import { pluralize } from './action-summary'

// Ordem do fluxo, não alfabética: pendente → aprovada → paga, e a rejeitada
// (o desvio) por último.
const ORDER: RequestStatus[] = ['PENDING', 'APPROVED', 'PAID', 'REJECTED']

const percent = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 0 })

function statusHref(status: RequestStatus): string {
  return `/requests?status=${status}`
}

// Régua horizontal segmentada por status. A barra é só a leitura rápida
// (aria-hidden); a informação acessível está na legenda, onde cada status tem
// rótulo, contagem e proporção em texto — e leva à lista já filtrada.
export function StatusDistribution({
  counts,
  total,
}: {
  counts: Record<RequestStatus, number>
  total: number
}) {
  const present = ORDER.filter((status) => counts[status] > 0)

  return (
    <section aria-labelledby="distribution-title" className="rounded-lg border bg-card shadow-xs">
      <header className="flex items-baseline justify-between gap-4 px-5 pt-5 lg:px-6">
        <h2 id="distribution-title" className="text-lg font-semibold">
          Solicitações por status
        </h2>
        <p className="text-sm text-muted-foreground tabular-nums">
          {pluralize(total, 'solicitação', 'solicitações')}
        </p>
      </header>

      <div aria-hidden="true" className="mx-5 mt-5 flex h-3 gap-1 lg:mx-6">
        {present.map((status, index) => (
          <span
            key={status}
            className={cn(
              'h-full min-w-1.5 rounded-xs',
              STATUS_STYLE[status].fill,
              index === 0 && 'rounded-l-full',
              index === present.length - 1 && 'rounded-r-full',
            )}
            style={{ flexGrow: counts[status], flexBasis: 0 }}
          />
        ))}
      </div>

      <ul className="grid gap-px p-2 pt-4 sm:grid-cols-2 lg:grid-cols-4 lg:p-3 lg:pt-4">
        {ORDER.map((status) => {
          const count = counts[status]

          return (
            <li key={status}>
              <Link
                href={statusHref(status)}
                aria-label={`${statusLabel(status)}: ${pluralize(count, 'solicitação', 'solicitações')}. Ver na lista`}
                className="group flex items-center gap-3 rounded-md px-3 py-2.5 transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <span
                  aria-hidden="true"
                  className={cn('size-2.5 shrink-0 rounded-sm', STATUS_STYLE[status].fill)}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{statusLabel(status)}</span>
                  <span className="block text-xs text-muted-foreground tabular-nums">
                    {total > 0 ? percent.format(count / total) : '0%'} do total
                  </span>
                </span>
                <span className="font-heading text-xl font-semibold tabular-nums">{count}</span>
                <ChevronRight
                  aria-hidden="true"
                  className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                />
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
