import { formatCentsToBrl } from '@gex/shared'

// Valor para exibição, com o símbolo da moeda.
export function formatBrl(cents: number): string {
  return `R$ ${formatCentsToBrl(cents)}`
}
