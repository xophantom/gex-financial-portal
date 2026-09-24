import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import expected from '../../../../../data/expected_results.json'
import { MoneyInput } from './masked-inputs'

function ControlledMoneyInput({ initial = 0 }: { initial?: number }) {
  const [cents, setCents] = useState(initial)
  return (
    <>
      <label htmlFor="amount">Valor</label>
      <MoneyInput id="amount" value={cents} onChange={setCents} />
      <output>{cents}</output>
    </>
  )
}

async function paste(text: string, initial?: number) {
  render(<ControlledMoneyInput initial={initial} />)
  const input = screen.getByLabelText('Valor')
  await userEvent.click(input)
  await userEvent.paste(text)
  return input
}

describe('MoneyInput', () => {
  it('treats each typed digit as a cent', async () => {
    render(<ControlledMoneyInput />)
    await userEvent.type(screen.getByLabelText('Valor'), '155313')

    expect(screen.getByLabelText('Valor')).toHaveValue('1.553,13')
    expect(screen.getByRole('status')).toHaveTextContent('155313')
  })

  it.each(Object.entries(expected.money_parse_examples))(
    'reads pasted "%s" as a value in reais (%i cents)',
    async (text, cents) => {
      await paste(text)
      expect(screen.getByRole('status')).toHaveTextContent(String(cents))
    },
  )

  it('shows a pasted plain integer as whole reais', async () => {
    const input = await paste('10')
    expect(input).toHaveValue('10,00')
  })

  it('ignores a paste that is not a monetary value', async () => {
    const input = await paste('abc', 1500)

    expect(input).toHaveValue('15,00')
    expect(screen.getByRole('status')).toHaveTextContent('1500')
  })
})
