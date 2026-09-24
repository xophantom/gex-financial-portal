import type { StatusEventResponse } from '@gex/shared'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RequestDetail } from './request-detail'
import { buildRequest } from './test-fixtures'

const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const baseRequest = buildRequest()

const createdEvent: StatusEventResponse = {
  id: 'e1',
  previous_status: null,
  new_status: 'PENDING',
  reason: null,
  created_at: '2026-08-10T12:00:00.000Z',
  actor: { id: 'a', name: 'Ana Solicitante' },
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('fetch', vi.fn())
})

describe('RequestDetail — action gating', () => {
  it('renders every action allowed_actions grants', () => {
    render(
      <RequestDetail request={baseRequest} history={[]} allowedActions={['APPROVE', 'REJECT']} />,
    )

    expect(screen.getByRole('button', { name: /aprovar/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /rejeitar/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /registrar pagamento/i })).not.toBeInTheDocument()
  })

  it('renders no action button when allowed_actions is empty', () => {
    render(<RequestDetail request={baseRequest} history={[]} allowedActions={[]} />)

    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })

  it('renders only mark-paid when that is the sole allowed action', () => {
    render(
      <RequestDetail
        request={{ ...baseRequest, status: 'APPROVED' }}
        history={[]}
        allowedActions={['MARK_PAID']}
      />,
    )

    expect(screen.getByRole('button', { name: /registrar pagamento/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /aprovar/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /rejeitar/i })).not.toBeInTheDocument()
  })
})

describe('RequestDetail — fields', () => {
  it('highlights the amount as BRL', () => {
    render(<RequestDetail request={baseRequest} history={[]} allowedActions={[]} />)
    expect(screen.getByText('R$ 1.250,00')).toBeInTheDocument()
  })

  it('shows the due date as DD/MM/AAAA', () => {
    render(<RequestDetail request={baseRequest} history={[]} allowedActions={[]} />)
    expect(screen.getByText('10/09/2026')).toBeInTheDocument()
  })

  it('shows the category as a plain word, not the API code', () => {
    render(
      <RequestDetail
        request={{ ...baseRequest, category: 'INFRAESTRUTURA' }}
        history={[]}
        allowedActions={[]}
      />,
    )
    expect(screen.getByText('Infraestrutura')).toBeInTheDocument()
  })

  it('flags an overdue request in words, not only in color', () => {
    render(
      <RequestDetail
        request={{ ...baseRequest, is_overdue: true }}
        history={[]}
        allowedActions={[]}
      />,
    )
    expect(screen.getByText('Vencida')).toBeInTheDocument()
  })

  // A regra é da API (PENDING ou APPROVED com vencimento passado); a tela só
  // repete is_overdue, como a lista e o dashboard.
  it('flags an overdue request that is already approved', () => {
    render(
      <RequestDetail
        request={{ ...baseRequest, status: 'APPROVED', is_overdue: true }}
        history={[]}
        allowedActions={[]}
      />,
    )
    expect(screen.getByText('Vencida')).toBeInTheDocument()
  })

  it('does not flag a request that is not overdue', () => {
    render(<RequestDetail request={baseRequest} history={[]} allowedActions={[]} />)
    expect(screen.queryByText('Vencida')).not.toBeInTheDocument()
  })

  it('shows the rejection reason', () => {
    render(
      <RequestDetail
        request={{ ...baseRequest, status: 'REJECTED', rejection_reason: 'CNPJ de outra filial' }}
        history={[]}
        allowedActions={[]}
      />,
    )
    expect(screen.getByText('Motivo da rejeição')).toBeInTheDocument()
    expect(screen.getByText('CNPJ de outra filial')).toBeInTheDocument()
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
    expect(screen.getByText('PAG-2026-0099')).toBeInTheDocument()
  })
})

describe('RequestDetail — status stamp', () => {
  it('announces the status as text to screen readers', () => {
    render(<RequestDetail request={baseRequest} history={[createdEvent]} allowedActions={[]} />)

    // O carimbo é decorativo (aria-hidden); o status existe como texto.
    expect(screen.getByText('Status: Pendente desde 10/08/2026')).toBeInTheDocument()
  })

  it('prints the payment date on a paid stamp', () => {
    render(
      <RequestDetail
        request={{ ...baseRequest, status: 'PAID', paid_at: '2026-09-20T15:00:00.000Z' }}
        history={[createdEvent]}
        allowedActions={[]}
      />,
    )

    expect(screen.getByText('PAGO')).toBeInTheDocument()
    expect(screen.getByText('Status: Paga desde 20/09/2026')).toBeInTheDocument()
  })
})

describe('RequestDetail — dialog', () => {
  it('focuses the first field when the dialog opens and closes on Escape', async () => {
    render(<RequestDetail request={baseRequest} history={[]} allowedActions={['REJECT']} />)
    const trigger = screen.getByRole('button', { name: /rejeitar/i })

    await userEvent.click(trigger)
    await waitFor(() => expect(screen.getByLabelText(/motivo/i)).toHaveFocus())

    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(trigger).toHaveFocus())
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

  it('confirms with the action verb and refreshes the page after success', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({}) } as Response)
    render(<RequestDetail request={baseRequest} history={[]} allowedActions={['APPROVE']} />)

    await userEvent.click(screen.getByRole('button', { name: /aprovar/i }))
    const dialog = await screen.findByRole('dialog', { name: 'Aprovar solicitação' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Aprovar' }))

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Solicitação aprovada.'))
    expect(refresh).toHaveBeenCalled()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
})
