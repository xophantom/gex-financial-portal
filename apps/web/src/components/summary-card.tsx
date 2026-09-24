import { formatCentsToBrl } from '@gex/shared'

export interface SummaryCardProps {
  label: string
  valueCents?: number
  count?: number
  tone?: 'default' | 'warning'
}

// count e valueCents são mutuamente exclusivos: um cartão de contagem
// (Vencidas) nunca deve passar pelo formatador monetário, e um cartão de
// dinheiro nunca deve exibir um cardinal cru — cada indicador do
// /dashboard/summary já chega tipado como um ou outro, nunca os dois.
export function SummaryCard({ label, valueCents, count, tone = 'default' }: SummaryCardProps) {
  const display = count !== undefined ? String(count) : `R$ ${formatCentsToBrl(valueCents ?? 0)}`

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
