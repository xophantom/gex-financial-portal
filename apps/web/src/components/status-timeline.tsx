export interface StatusEvent {
  id: string
  previous_status: string | null
  new_status: string
  reason: string | null
  created_at: string
  actor: { id: string; name: string }
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendente',
  APPROVED: 'Aprovada',
  REJECTED: 'Rejeitada',
  PAID: 'Paga',
}

function label(status: string): string {
  return STATUS_LABELS[status] ?? status
}

// APP_TIMEZONE do backend é America/Sao_Paulo (ver .env.example) — a
// auditoria tem que ler no mesmo fuso em que o negócio pensa a data, não no
// fuso do navegador de quem está olhando, nem em UTC.
export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

// Somente leitura, de propósito: histórico é auditoria, não um formulário.
// Nenhum <button> ou <input> pode aparecer aqui — é o teste
// "offers no control that could edit history" que trava isso.
export function StatusTimeline({ events }: { events: StatusEvent[] }) {
  if (events.length === 0) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">Nenhum evento registrado.</p>
  }

  return (
    <ol className="space-y-3 border-l border-zinc-200 pl-4 dark:border-zinc-800">
      {events.map((event) => (
        <li key={event.id} className="text-sm">
          <p className="font-medium text-zinc-900 dark:text-zinc-100">
            {event.previous_status ? `${label(event.previous_status)} → ${label(event.new_status)}` : label(event.new_status)}
          </p>
          <p className="text-zinc-600 dark:text-zinc-400">
            {formatDateTime(event.created_at)} · {event.actor.name}
          </p>
          {event.reason && <p className="text-zinc-600 dark:text-zinc-400">{event.reason}</p>}
        </li>
      ))}
    </ol>
  )
}
