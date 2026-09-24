import type { StatusEventResponse } from '@gex/shared'
import { ArrowRight } from 'lucide-react'
import { formatDateTime } from '@/lib/format/dates'
import { statusLabel } from '@/lib/format/labels'
import { cn } from '@/lib/utils'
import { STATUS_STYLE } from './status-style'

// O campo `reason` do evento carrega o motivo numa rejeição e a referência
// num pagamento; o rótulo diz qual dos dois é.
const REASON_LABEL: Partial<Record<StatusEventResponse['new_status'], string>> = {
  REJECTED: 'Motivo',
  PAID: 'Referência',
}

// Somente leitura, de propósito: histórico é auditoria, não formulário.
// Os eventos chegam do mais antigo para o mais novo e são mostrados assim.
export function StatusTimeline({ events }: { events: StatusEventResponse[] }) {
  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum evento registrado.</p>
  }

  return (
    <ol className="relative">
      {events.map((event, index) => {
        const isLast = index === events.length - 1
        const style = STATUS_STYLE[event.new_status]

        return (
          <li key={event.id} className="relative pb-6 pl-7 last:pb-0">
            {!isLast && (
              <span
                aria-hidden="true"
                className="absolute top-4 bottom-0 left-1.25 w-px bg-border"
              />
            )}
            <span
              aria-hidden="true"
              className={cn(
                'absolute top-1 left-0 size-2.75 rounded-full ring-4 ring-background',
                style?.fill ?? 'bg-muted-foreground',
              )}
            />

            <p className="flex flex-wrap items-center gap-x-1.5 text-sm font-medium">
              {event.previous_status ? (
                <>
                  <span className="text-muted-foreground">
                    {statusLabel(event.previous_status)}
                  </span>
                  <ArrowRight aria-hidden="true" className="size-3.5 text-muted-foreground" />
                  <span className="sr-only">{' para '}</span>
                  <span className={style?.text}>{statusLabel(event.new_status)}</span>
                </>
              ) : (
                <span className="text-foreground">Solicitação cadastrada</span>
              )}
            </p>
            <p className="mt-1 text-sm text-foreground">{event.actor.name}</p>
            <p className="text-xs text-muted-foreground tabular-nums">
              <time dateTime={event.created_at}>{formatDateTime(event.created_at)}</time>
            </p>
            {event.reason && (
              <p className="mt-2 rounded-md bg-card px-3 py-2 text-sm text-foreground ring-1 ring-border">
                <span className="text-muted-foreground">
                  {REASON_LABEL[event.new_status] ?? 'Observação'}:
                </span>{' '}
                {event.reason}
              </p>
            )}
          </li>
        )
      })}
    </ol>
  )
}
