import { formatCentsToBrl } from '@gex/shared'

// Um cartão mostra uma contagem OU um valor em centavos, nunca os dois.
export type SummaryCardProps = {
  label: string
  tone?: 'default' | 'warning'
} & ({ valueCents: number; count?: never } | { count: number; valueCents?: never })

export function SummaryCard({ label, valueCents, count, tone = 'default' }: SummaryCardProps) {
  const display = count !== undefined ? String(count) : `R$ ${formatCentsToBrl(valueCents)}`

  return (
    <div
      role="group"
      aria-label={label}
      className={
        tone === 'warning'
          ? 'rounded-lg border border-amber-300 bg-amber-50 p-4 shadow-sm dark:border-amber-800 dark:bg-amber-950'
          : 'rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900'
      }
    >
      <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-zinc-950 dark:text-zinc-50">{display}</p>
    </div>
  )
}
