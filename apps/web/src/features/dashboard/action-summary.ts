import type { DashboardSummaryResponse, UserRole } from '@gex/shared'

const MONTHS = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
]

export function pluralize(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`
}

// "2026-09-18" → "setembro de 2026". Fatiar a string, como em
// formatCalendarDate, evita que um new Date() em UTC recue o mês no dia 1º.
export function monthLabel(isoDate: string): string {
  const [year, month] = isoDate.split('-')
  return `${MONTHS[Number(month) - 1]} de ${year}`
}

// A frase do topo da visão geral: o que está esperando ação agora, do ponto
// de vista de quem olha. O financeiro age sobre todas as solicitações (decide
// as pendentes, paga as aprovadas); o solicitante acompanha as suas.
export function actionSummary(summary: DashboardSummaryResponse, role: UserRole): string {
  const pending = summary.status_counts.PENDING
  const approved = summary.status_counts.APPROVED
  const isFinance = role === 'FINANCE'

  if (pending === 0 && approved === 0) {
    return isFinance
      ? 'Nenhuma solicitação espera ação do financeiro agora.'
      : 'Nenhuma das suas solicitações está em andamento.'
  }

  // Sozinhas na frase, as aprovadas precisam do substantivo ("3 solicitações
  // aprovadas"); depois das pendentes, "e 3 aprovadas" já basta.
  const approvedLabel =
    pending > 0
      ? pluralize(approved, 'aprovada', 'aprovadas')
      : pluralize(approved, 'solicitação aprovada', 'solicitações aprovadas')

  if (isFinance) {
    const parts = [
      pending > 0 &&
        `${pluralize(pending, 'solicitação aguarda', 'solicitações aguardam')} decisão`,
      approved > 0 && `${approvedLabel} ${approved === 1 ? 'espera' : 'esperam'} pagamento`,
    ].filter(Boolean)

    return `${parts.join(' e ')}.`
  }

  const parts = [
    pending > 0 &&
      `${pluralize(pending, 'solicitação aguardando', 'solicitações aguardando')} decisão do financeiro`,
    approved > 0 && `${approvedLabel} aguardando pagamento`,
  ].filter(Boolean)

  return `Você tem ${parts.join(' e ')}.`
}
