import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MarkPaidDialog } from './mark-paid-dialog'

beforeEach(() => vi.stubGlobal('fetch', vi.fn()))

describe('MarkPaidDialog', () => {
  it('requires both a date and a payment reference', async () => {
    const onSuccess = vi.fn()
    render(<MarkPaidDialog requestId="r1" onClose={vi.fn()} onSuccess={onSuccess} />)

    await userEvent.click(screen.getByRole('button', { name: /confirmar/i }))

    expect(await screen.findByText(/informe a data/i)).toBeInTheDocument()
    expect(fetch).not.toHaveBeenCalled()
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('submits once filled and disables the confirm button meanwhile', async () => {
    let resolve!: (value: Response) => void
    vi.mocked(fetch).mockReturnValue(new Promise<Response>((r) => (resolve = r)))

    render(<MarkPaidDialog requestId="r1" onClose={vi.fn()} onSuccess={vi.fn()} />)
    await userEvent.type(screen.getByLabelText(/data do pagamento/i), '2026-09-20')
    await userEvent.type(screen.getByLabelText(/referência/i), 'PAG-2026-0099')

    const button = screen.getByRole('button', { name: /confirmar/i })
    await userEvent.click(button)

    await waitFor(() => expect(button).toBeDisabled())
    expect(fetch).toHaveBeenCalledTimes(1)
    resolve({ ok: true, json: async () => ({}) } as Response)
  })
})
