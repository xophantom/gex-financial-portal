import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RequestDetail, type RequestDetailData } from './request-detail'
import { useUiStore } from '@/stores/ui-store'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }))

const baseRequest: RequestDetailData = {
  id: '20000000-0000-4000-8000-000000000001',
  supplier_name: 'Aurora Serviços Digitais',
  supplier_cnpj: '10000000000145',
  invoice_number: 'NF-2026-1001',
  amount_cents: 125000,
  competence: '2026-09',
  due_date: '2026-09-10',
  category: 'SOFTWARE',
  description: null,
  status: 'PENDING',
  rejection_reason: null,
  paid_at: null,
  payment_reference: null,
  is_overdue: false,
  requester: { id: 'x', name: 'Ana Solicitante' },
}

// Reset da store entre testes: é um módulo singleton (zustand), não um novo
// componente por render — sem isto, o diálogo aberto por um teste vazaria
// para o próximo.
beforeEach(() => {
  useUiStore.setState({ openDialog: null, toasts: [] })
})

describe('RequestDetail — action gating', () => {
  it('renders every action allowed_actions grants', () => {
    render(<RequestDetail request={baseRequest} history={[]} allowedActions={['APPROVE', 'REJECT']} />)

    expect(screen.getByRole('button', { name: /aprovar/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /rejeitar/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /marcar como paga/i })).not.toBeInTheDocument()
  })

  it('renders no action button when allowed_actions is empty', () => {
    render(<RequestDetail request={baseRequest} history={[]} allowedActions={[]} />)

    expect(screen.queryByRole('button', { name: /aprovar/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /rejeitar/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /marcar como paga/i })).not.toBeInTheDocument()
  })

  it('renders only mark-paid when that is the sole allowed action', () => {
    render(
      <RequestDetail
        request={{ ...baseRequest, status: 'APPROVED' }}
        history={[]}
        allowedActions={['MARK_PAID']}
      />,
    )

    expect(screen.getByRole('button', { name: /marcar como paga/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /aprovar/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /rejeitar/i })).not.toBeInTheDocument()
  })
})
