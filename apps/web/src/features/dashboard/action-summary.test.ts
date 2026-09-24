import type { DashboardSummaryResponse } from '@gex/shared'
import { describe, expect, it } from 'vitest'
import { actionSummary, monthLabel } from './action-summary'

function summary(counts: Partial<DashboardSummaryResponse['status_counts']>) {
  return {
    status_counts: { PENDING: 0, APPROVED: 0, REJECTED: 0, PAID: 0, ...counts },
  } as DashboardSummaryResponse
}

describe('actionSummary', () => {
  it('tells finance what waits for a decision and for payment', () => {
    expect(actionSummary(summary({ PENDING: 6, APPROVED: 5 }), 'FINANCE')).toBe(
      '6 solicitações aguardam decisão e 5 aprovadas esperam pagamento.',
    )
  })

  it('agrees in number with a single request', () => {
    expect(actionSummary(summary({ PENDING: 1, APPROVED: 1 }), 'FINANCE')).toBe(
      '1 solicitação aguarda decisão e 1 aprovada espera pagamento.',
    )
  })

  it('names the approved requests when they are the only ones waiting', () => {
    expect(actionSummary(summary({ APPROVED: 3 }), 'FINANCE')).toBe(
      '3 solicitações aprovadas esperam pagamento.',
    )
  })

  it('speaks to the requester about their own requests', () => {
    expect(actionSummary(summary({ PENDING: 4, APPROVED: 3 }), 'REQUESTER')).toBe(
      'Você tem 4 solicitações aguardando decisão do financeiro e 3 aprovadas aguardando pagamento.',
    )
  })

  it('says when nothing is waiting, per role', () => {
    const idle = summary({ PAID: 2, REJECTED: 1 })

    expect(actionSummary(idle, 'FINANCE')).toBe(
      'Nenhuma solicitação espera ação do financeiro agora.',
    )
    expect(actionSummary(idle, 'REQUESTER')).toBe(
      'Nenhuma das suas solicitações está em andamento.',
    )
  })
})

describe('monthLabel', () => {
  it('names the month of a calendar date without shifting time zones', () => {
    expect(monthLabel('2026-09-01')).toBe('setembro de 2026')
    expect(monthLabel('2027-01-31')).toBe('janeiro de 2027')
  })
})
