import type { DashboardSummaryResponse, RequestListResponse } from '@gex/shared'
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { buildRequest } from '@/features/requests/test-fixtures'
import { DashboardSummary } from './dashboard-summary'

const SUMMARY: DashboardSummaryResponse = {
  reference_date: '2026-09-18',
  pending_amount_cents: 876049,
  approved_amount_cents: 813912,
  paid_this_month_amount_cents: 0,
  overdue_count: 4,
  request_count: 18,
  status_counts: { PENDING: 6, APPROVED: 5, REJECTED: 2, PAID: 5 },
}

const NO_PENDING: RequestListResponse = {
  data: [],
  page: 1,
  page_size: 5,
  total: 0,
  total_pages: 1,
}

// Na régua, cada indicador é um par <dt>/<dd> dentro do mesmo <div>: o valor
// é lido a partir do rótulo, como faria um leitor de tela.
function indicator(label: string) {
  const term = screen.getByText(label, { selector: 'dt' })
  return term.parentElement as HTMLElement
}

describe('DashboardSummary', () => {
  it('formats the amounts as Brazilian currency, zero included', () => {
    render(<DashboardSummary summary={SUMMARY} pending={NO_PENDING} role="FINANCE" />)

    expect(indicator('Total pendente')).toHaveTextContent('R$ 8.760,49')
    expect(indicator('Total aprovado')).toHaveTextContent('R$ 8.139,12')
    expect(indicator('Pago no mês')).toHaveTextContent('R$ 0,00')
    expect(indicator('Pago no mês')).toHaveTextContent('Em setembro de 2026')
  })

  it('flags overdue requests in words, not only in color', () => {
    render(<DashboardSummary summary={SUMMARY} pending={NO_PENDING} role="FINANCE" />)

    expect(indicator('Vencidas')).toHaveTextContent('4')
    expect(indicator('Vencidas')).toHaveTextContent('Em aberto após o vencimento')
  })

  it('shows the reference date and what is waiting for action', () => {
    render(<DashboardSummary summary={SUMMARY} pending={NO_PENDING} role="FINANCE" />)

    expect(screen.getByRole('heading', { level: 1, name: 'Visão geral' })).toBeInTheDocument()
    expect(screen.getByText('18/09/2026')).toHaveAttribute('dateTime', '2026-09-18')
    expect(
      screen.getByText('6 solicitações aguardam decisão e 5 aprovadas esperam pagamento.'),
    ).toBeInTheDocument()
  })

  it('lists every status with its count, share and a link to the filtered list', () => {
    render(<DashboardSummary summary={SUMMARY} pending={NO_PENDING} role="FINANCE" />)

    const legend = screen.getByRole('region', { name: 'Solicitações por status' })
    const links = within(legend).getAllByRole('link')

    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/requests?status=PENDING',
      '/requests?status=APPROVED',
      '/requests?status=PAID',
      '/requests?status=REJECTED',
    ])
    expect(
      within(legend).getByRole('link', { name: /^Pendente: 6 solicitações/ }),
    ).toHaveTextContent('33% do total')
    expect(
      within(legend).getByRole('link', { name: /^Rejeitada: 2 solicitações/ }),
    ).toHaveTextContent('11% do total')
    expect(within(legend).getByText('18 solicitações')).toBeInTheDocument()
  })

  it('invites a requester with no requests to create the first one', () => {
    render(
      <DashboardSummary
        summary={{
          ...SUMMARY,
          pending_amount_cents: 0,
          approved_amount_cents: 0,
          overdue_count: 0,
          request_count: 0,
          status_counts: { PENDING: 0, APPROVED: 0, REJECTED: 0, PAID: 0 },
        }}
        pending={NO_PENDING}
        role="REQUESTER"
      />,
    )

    expect(screen.getByText('Você ainda não tem solicitações')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Cadastrar solicitação' })).toHaveAttribute(
      'href',
      '/requests/new',
    )
    expect(screen.queryByText('Total pendente')).not.toBeInTheDocument()
  })

  it('points finance to the list when nothing has been received', () => {
    render(
      <DashboardSummary
        summary={{
          ...SUMMARY,
          request_count: 0,
          status_counts: { PENDING: 0, APPROVED: 0, REJECTED: 0, PAID: 0 },
        }}
        pending={NO_PENDING}
        role="FINANCE"
      />,
    )

    expect(screen.getByText('Nenhuma solicitação recebida')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Cadastrar solicitação' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Abrir solicitações' })).toHaveAttribute(
      'href',
      '/requests',
    )
  })

  it('lists the pending requests to decide first, each linking to its detail', () => {
    const pending: RequestListResponse = {
      data: [
        buildRequest({
          id: 'a',
          supplier_name: 'Aurora',
          due_date: '2026-09-10',
          is_overdue: true,
        }),
        buildRequest({
          id: 'b',
          supplier_name: 'Norte',
          due_date: '2026-09-20',
          amount_cents: 230050,
        }),
      ],
      page: 1,
      page_size: 5,
      total: 6,
      total_pages: 2,
    }
    render(<DashboardSummary summary={SUMMARY} pending={pending} role="FINANCE" />)

    const list = screen.getByRole('region', { name: 'Aguardando sua decisão' })
    const items = within(list).getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(within(items[0]).getByRole('link', { name: 'Aurora' })).toHaveAttribute(
      'href',
      '/requests/a',
    )
    expect(items[0]).toHaveTextContent('Vence em 10/09/2026Vencida')
    expect(items[1]).toHaveTextContent('R$ 2.300,50')
    expect(within(list).getByRole('link', { name: 'Ver todas as 6' })).toHaveAttribute(
      'href',
      '/requests?status=PENDING',
    )
  })

  it('says so when nothing is waiting for a decision', () => {
    render(<DashboardSummary summary={SUMMARY} pending={NO_PENDING} role="REQUESTER" />)

    const list = screen.getByRole('region', { name: 'Aguardando o financeiro' })
    expect(within(list).getByText('Nenhuma solicitação pendente.')).toBeInTheDocument()
    expect(within(list).queryByRole('link')).not.toBeInTheDocument()
  })
})
