import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StatusTimeline } from './status-timeline'

const events = [
  { id: '1', previous_status: null, new_status: 'PENDING', reason: null, created_at: '2026-08-10T09:00:00-03:00', actor: { id: 'a', name: 'Ana Solicitante' } },
  { id: '2', previous_status: 'PENDING', new_status: 'APPROVED', reason: null, created_at: '2026-09-01T10:00:00-03:00', actor: { id: 'f', name: 'Fernanda Financeiro' } },
  { id: '3', previous_status: 'APPROVED', new_status: 'PAID', reason: 'PAG-2026-0010', created_at: '2026-09-05T14:00:00-03:00', actor: { id: 'f', name: 'Fernanda Financeiro' } },
] as const

describe('StatusTimeline', () => {
  it('lists every event in order with its actor', () => {
    render(<StatusTimeline events={[...events]} />)

    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(3)
    expect(items[0]).toHaveTextContent('Ana Solicitante')
    expect(items[2]).toHaveTextContent('Fernanda Financeiro')
  })

  it('renders dates in São Paulo time, not UTC', () => {
    render(<StatusTimeline events={[...events]} />)
    // 2026-09-05T14:00:00-03:00 é 05/09 em São Paulo e 05/09 17:00 em UTC;
    // o teste falha se a formatação cair no dia seguinte.
    expect(screen.getByText(/05\/09\/2026/)).toBeInTheDocument()
  })

  it('shows the payment reference carried in the paid event', () => {
    render(<StatusTimeline events={[...events]} />)
    expect(screen.getByText(/PAG-2026-0010/)).toBeInTheDocument()
  })

  it('offers no control that could edit history', () => {
    render(<StatusTimeline events={[...events]} />)

    expect(screen.queryAllByRole('button')).toHaveLength(0)
    expect(screen.queryAllByRole('textbox')).toHaveLength(0)
  })
})
