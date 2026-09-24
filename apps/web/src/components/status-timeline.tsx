import { formatDateTime } from '@/format/dates'
import { statusLabel } from '@/format/labels'

export interface StatusEvent {
  id: string
  previous_status: string | null
  new_status: string
  reason: string | null
  created_at: string
  actor: { id: string; name: string }
}

// Somente leitura, de propósito: histórico é auditoria, não formulário.
export function StatusTimeline({ events }: { events: StatusEvent[] }) {
  if (events.length === 0) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">Nenhum evento registrado.</p>
  }

  return (
    <ol className="space-y-3 border-l border-zinc-200 pl-4 dark:border-zinc-800">
      {events.map((event) => (
        <li key={event.id} className="text-sm">
          <p className="font-medium text-zinc-900 dark:text-zinc-100">
            {event.previous_status
              ? `${statusLabel(event.previous_status)} → ${statusLabel(event.new_status)}`
              : statusLabel(event.new_status)}
          </p>
          <p className="text-zinc-600 dark:text-zinc-400">
            <time dateTime={event.created_at}>{formatDateTime(event.created_at)}</time> · {event.actor.name}
          </p>
          {event.reason && <p className="text-zinc-600 dark:text-zinc-400">{event.reason}</p>}
        </li>
      ))}
    </ol>
  )
}
