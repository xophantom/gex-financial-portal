import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SummaryCard } from './summary-card'

describe('SummaryCard', () => {
  it('renders cents as Brazilian currency', () => {
    render(<SummaryCard label="Total pendente" valueCents={875049} />)
    expect(screen.getByText('R$ 8.750,49')).toBeInTheDocument()
  })

  it('renders zero without breaking the mask', () => {
    render(<SummaryCard label="Total pendente" valueCents={0} />)
    expect(screen.getByText('R$ 0,00')).toBeInTheDocument()
  })

  it('renders a plain count when no currency is involved', () => {
    render(<SummaryCard label="Vencidas" count={4} />)
    expect(screen.getByText('4')).toBeInTheDocument()
  })

  it('exposes the label and value as a single accessible group', () => {
    render(<SummaryCard label="Total aprovado" valueCents={658599} />)

    const group = screen.getByRole('group', { name: /total aprovado/i })
    expect(group).toHaveTextContent('R$ 6.585,99')
  })
})
