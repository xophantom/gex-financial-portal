import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { RequestsTable } from './requests-table'

const row = {
  id: '20000000-0000-4000-8000-000000000001',
  supplier_name: 'Aurora Serviços Digitais',
  supplier_cnpj: '10000000000145',
  invoice_number: 'NF-2026-1001',
  amount_cents: 125000,
  due_date: '2026-09-10',
  status: 'PENDING' as const,
  is_overdue: true,
  requester: { id: 'x', name: 'Ana Solicitante' },
}

describe('RequestsTable', () => {
  it('shows all six required columns for a row', () => {
    render(<RequestsTable rows={[row]} />)
    const cells = within(screen.getByRole('row', { name: /aurora/i }))

    expect(cells.getByText('Aurora Serviços Digitais')).toBeInTheDocument()
    expect(cells.getByText('NF-2026-1001')).toBeInTheDocument()
    expect(cells.getByText('R$ 1.250,00')).toBeInTheDocument()
    expect(cells.getByText('10/09/2026')).toBeInTheDocument()
    expect(cells.getByText(/pendente/i)).toBeInTheDocument()
    expect(cells.getByText('Ana Solicitante')).toBeInTheDocument()
  })

  it('flags an overdue row in text, not only by colour', () => {
    render(<RequestsTable rows={[row]} />)
    expect(screen.getByText(/vencida/i)).toBeInTheDocument()
  })

  it('does not flag a row that is not overdue', () => {
    render(<RequestsTable rows={[{ ...row, is_overdue: false }]} />)
    expect(screen.queryByText(/vencida/i)).not.toBeInTheDocument()
  })

  it('renders an empty state instead of a bare table', () => {
    render(<RequestsTable rows={[]} />)
    expect(screen.getByText(/nenhuma solicitação/i)).toBeInTheDocument()
  })

  it('links each row to its detail page', () => {
    render(<RequestsTable rows={[row]} />)
    expect(screen.getByRole('link', { name: /aurora/i })).toHaveAttribute(
      'href',
      `/requests/${row.id}`,
    )
  })
})
