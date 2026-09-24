// Rótulo de exibição, não uma checagem de tipo — mesmo padrão do ROLE_LABELS
// em app-nav.tsx: o valor cru já chega validado do backend (RequestStatus em
// @gex/shared), o fallback existe só para nunca esconder um status
// desconhecido no futuro atrás de undefined.
const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendente',
  APPROVED: 'Aprovada',
  REJECTED: 'Rejeitada',
  PAID: 'Paga',
}

const STATUS_TONE: Record<string, string> = {
  PENDING:
    'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200',
  APPROVED:
    'border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200',
  REJECTED:
    'border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200',
  PAID: 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_TONE[status] ?? 'border-zinc-300 bg-zinc-50 text-zinc-700'}`}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  )
}
