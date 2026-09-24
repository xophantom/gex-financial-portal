import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useUiStore } from '@/stores/ui-store'
import { RequestDetail } from './request-detail'
import { buildRequest } from './test-fixtures'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }))

const baseRequest = buildRequest()

// Reset da store entre testes: é um módulo singleton (zustand), não um novo
// componente por render — sem isto, o diálogo aberto por um teste vazaria
// para o próximo.
beforeEach(() => {
  useUiStore.setState({ openDialog: null, toasts: [] })
})

describe('RequestDetail — action gating', () => {
  it('renders every action allowed_actions grants', () => {
    render(
      <RequestDetail request={baseRequest} history={[]} allowedActions={['APPROVE', 'REJECT']} />,
    )

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

describe('RequestDetail — fields', () => {
  it('shows the due date as DD/MM/AAAA', () => {
    render(<RequestDetail request={baseRequest} history={[]} allowedActions={[]} />)
    expect(screen.getByText('10/09/2026')).toBeInTheDocument()
  })

  // A API grava paid_at como meio-dia de SP: a hora seria ruído.
  it('shows only the São Paulo date for paid_at', () => {
    render(
      <RequestDetail
        request={{
          ...baseRequest,
          status: 'PAID',
          paid_at: '2026-09-20T15:00:00.000Z',
          payment_reference: 'PAG-2026-0099',
        }}
        history={[]}
        allowedActions={[]}
      />,
    )

    const paidAt = screen.getByText('Pago em').nextElementSibling
    expect(paidAt).toHaveTextContent(/^20\/09\/2026$/)
  })
})

describe('RequestDetail — dialog', () => {
  it('focuses the first field when the dialog opens and closes on Escape', async () => {
    render(<RequestDetail request={baseRequest} history={[]} allowedActions={['REJECT']} />)
    const trigger = screen.getByRole('button', { name: /rejeitar/i })

    await userEvent.click(trigger)
    expect(screen.getByLabelText(/motivo/i)).toHaveFocus()

    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('does not carry an open dialog over to another request', async () => {
    const { unmount } = render(
      <RequestDetail request={baseRequest} history={[]} allowedActions={['APPROVE']} />,
    )
    await userEvent.click(screen.getByRole('button', { name: /aprovar/i }))
    unmount()

    render(
      <RequestDetail
        request={{ ...baseRequest, id: 'other' }}
        history={[]}
        allowedActions={['APPROVE']}
      />,
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
