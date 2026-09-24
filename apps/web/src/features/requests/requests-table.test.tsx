import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { RequestsTable } from './requests-table'
import { buildRequest } from './test-fixtures'

const row = buildRequest({ is_overdue: true })

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

  it('shows the supplier CNPJ formatted under the name', () => {
    render(<RequestsTable rows={[row]} />)
    expect(screen.getByText('10.000.000/0001-45')).toBeInTheDocument()
  })

  it('renders an empty state instead of a bare table', () => {
    render(<RequestsTable rows={[]} />)
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.getByText(/nenhuma solicitação ainda/i)).toBeInTheDocument()
  })

  it('invites a requester with no requests yet to register one', () => {
    render(<RequestsTable rows={[]} canCreate />)
    expect(screen.getByRole('link', { name: /cadastrar solicitação/i })).toHaveAttribute(
      'href',
      '/requests/new',
    )
  })

  it('offers no registration to finance when the list is empty', () => {
    render(<RequestsTable rows={[]} />)
    expect(screen.queryByRole('link', { name: /cadastrar/i })).not.toBeInTheDocument()
  })

  // Com filtros ativos, "nenhuma ainda" seria mentira: a saída é limpar.
  it('tells an empty filtered result apart and offers to clear the filters', () => {
    render(<RequestsTable rows={[]} filtered canCreate />)
    expect(screen.getByText(/nenhuma solicitação para esses filtros/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /limpar filtros/i })).toHaveAttribute(
      'href',
      '/requests',
    )
    expect(screen.queryByRole('link', { name: /cadastrar/i })).not.toBeInTheDocument()
  })

  it('links each row to its detail page', () => {
    render(<RequestsTable rows={[row]} />)
    expect(screen.getByRole('link', { name: /aurora/i })).toHaveAttribute(
      'href',
      `/requests/${row.id}`,
    )
  })
})
