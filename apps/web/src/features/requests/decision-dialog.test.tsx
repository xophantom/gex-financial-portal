import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DecisionDialog } from './decision-dialog'

beforeEach(() => vi.stubGlobal('fetch', vi.fn()))

describe('DecisionDialog', () => {
  it('shows a reason field only when rejecting', () => {
    const { rerender } = render(
      <DecisionDialog requestId="r1" decision="APPROVE" onClose={vi.fn()} onSuccess={vi.fn()} />,
    )
    expect(screen.queryByLabelText(/motivo/i)).not.toBeInTheDocument()

    rerender(<DecisionDialog requestId="r1" decision="REJECT" onClose={vi.fn()} onSuccess={vi.fn()} />)
    expect(screen.getByLabelText(/motivo/i)).toBeInTheDocument()
  })

  it('keeps the dialog open and shows an error when confirming a rejection without a reason', async () => {
    const onSuccess = vi.fn()
    render(<DecisionDialog requestId="r1" decision="REJECT" onClose={vi.fn()} onSuccess={onSuccess} />)

    await userEvent.click(screen.getByRole('button', { name: /confirmar/i }))

    expect(await screen.findByText(/informe o motivo/i)).toBeInTheDocument()
    expect(fetch).not.toHaveBeenCalled()
    expect(onSuccess).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('disables the confirm button while the request is in flight', async () => {
    let resolve!: (value: Response) => void
    vi.mocked(fetch).mockReturnValue(new Promise<Response>((r) => (resolve = r)))

    render(<DecisionDialog requestId="r1" decision="APPROVE" onClose={vi.fn()} onSuccess={vi.fn()} />)
    const button = screen.getByRole('button', { name: /confirmar/i })
    await userEvent.click(button)

    await waitFor(() => expect(button).toBeDisabled())
    resolve({ ok: true, json: async () => ({}) } as Response)
  })

  it('submits only once on a double click', async () => {
    vi.mocked(fetch).mockReturnValue(new Promise<Response>(() => {}))

    render(<DecisionDialog requestId="r1" decision="APPROVE" onClose={vi.fn()} onSuccess={vi.fn()} />)
    await userEvent.dblClick(screen.getByRole('button', { name: /confirmar/i }))

    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('shows an error and re-enables confirm when the network fails', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'))
    const onSuccess = vi.fn()

    render(<DecisionDialog requestId="r1" decision="APPROVE" onClose={vi.fn()} onSuccess={onSuccess} />)
    await userEvent.click(screen.getByRole('button', { name: /confirmar/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/não foi possível/i)
    expect(screen.getByRole('button', { name: /confirmar/i })).toBeEnabled()
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('is labelled by its title', () => {
    render(<DecisionDialog requestId="r1" decision="REJECT" onClose={vi.fn()} onSuccess={vi.fn()} />)
    expect(screen.getByRole('dialog', { name: 'Rejeitar solicitação' })).toBeInTheDocument()
  })

  it('calls onSuccess after a confirmed approval', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({}) } as Response)
    const onSuccess = vi.fn()

    render(<DecisionDialog requestId="r1" decision="APPROVE" onClose={vi.fn()} onSuccess={onSuccess} />)
    await userEvent.click(screen.getByRole('button', { name: /confirmar/i }))

    await waitFor(() => expect(onSuccess).toHaveBeenCalled())
  })
})
