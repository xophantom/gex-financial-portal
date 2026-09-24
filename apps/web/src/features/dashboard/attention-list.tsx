import type { RequestListResponse, UserRole } from '@gex/shared'
import { CircleCheck } from 'lucide-react'
import Link from 'next/link'
import { formatCalendarDate } from '@/lib/format/dates'
import { formatBrl } from '@/lib/format/money'

// As pendentes de vencimento mais próximo (a API ordena por vencimento): o
// que o financeiro precisa decidir primeiro, ou o que o solicitante espera.
export function AttentionList({ pending, role }: { pending: RequestListResponse; role: UserRole }) {
  const title = role === 'FINANCE' ? 'Aguardando sua decisão' : 'Aguardando o financeiro'

  return (
    <section aria-labelledby="attention-title" className="rounded-lg border bg-card shadow-xs">
      <header className="flex items-baseline justify-between gap-4 px-6 pt-5 pb-3">
        <h2 id="attention-title" className="text-lg font-semibold">
          {title}
        </h2>
        {pending.total > pending.data.length && (
          <Link
            href="/requests?status=PENDING"
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Ver todas as {pending.total}
          </Link>
        )}
      </header>

      {pending.data.length === 0 ? (
        <p className="flex items-center gap-2 px-6 pb-6 text-sm text-muted-foreground">
          <CircleCheck className="size-4 text-paid" aria-hidden="true" />
          Nenhuma solicitação pendente.
        </p>
      ) : (
        <ul className="divide-y border-t">
          {pending.data.map((request) => (
            <li
              key={request.id}
              className="relative flex items-center gap-4 px-6 py-3.5 hover:bg-muted/50"
            >
              <div className="min-w-0 flex-1">
                <Link
                  href={`/requests/${request.id}`}
                  className="block truncate font-medium after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring focus-visible:after:ring-inset"
                >
                  {request.supplier_name}
                </Link>
                <p className="text-sm text-muted-foreground">
                  Vence em {formatCalendarDate(request.due_date)}
                  {request.is_overdue && (
                    <span className="ml-2 font-medium text-pending">Vencida</span>
                  )}
                </p>
              </div>
              <span className="font-heading text-base font-semibold tabular-nums">
                {formatBrl(request.amount_cents)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
