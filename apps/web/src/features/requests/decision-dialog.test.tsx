import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DecisionDialog, type DecisionDialogProps } from './decision-dialog'

beforeEach(() => vi.stubGlobal('fetch', vi.fn()))

function renderDialog(props: Partial<DecisionDialogProps> = {}) {
  const merged: DecisionDialogProps = {
    requestId: 'r1',
    supplierName: 'Aurora Serviços Digitais',
    decision: 'APPROVE',
    open: true,
    onOpenChange: vi.fn(),
    onSuccess: vi.fn(),
    ...props,
  }
  return { ...render(<DecisionDialog {...merged} />), props: merged }
}

const confirmButton = (name: 'Aprovar' | 'Rejeitar') => screen.getByRole('button', { name })

describe('DecisionDialog', () => {
  it('shows a reason field only when rejecting', () => {
    const { rerender, props } = renderDialog()
    expect(screen.queryByLabelText(/motivo/i)).not.toBeInTheDocument()

    rerender(<DecisionDialog {...props} decision="REJECT" />)
    expect(screen.getByLabelText(/motivo/i)).toBeInTheDocument()
  })

  it('names the supplier in the description', () => {
    renderDialog()
    expect(screen.getByRole('dialog')).toHaveAccessibleDescription(/aurora serviços digitais/i)
  })

  it('keeps the dialog open and flags the field when rejecting without a reason', async () => {
    const { props } = renderDialog({ decision: 'REJECT' })

    await userEvent.click(confirmButton('Rejeitar'))

    expect(await screen.findByText(/informe o motivo/i)).toBeInTheDocument()
    const reason = screen.getByLabelText(/motivo/i)
    expect(reason).toHaveAttribute('aria-invalid', 'true')
    expect(reason).toHaveAccessibleDescription(/informe o motivo/i)
    expect(fetch).not.toHaveBeenCalled()
    expect(props.onSuccess).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('sends the reason with a rejection', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({}) } as Response)
    renderDialog({ decision: 'REJECT' })

    await userEvent.type(screen.getByLabelText(/motivo/i), 'CNPJ de outra filial')
    await userEvent.click(confirmButton('Rejeitar'))

    await waitFor(() => expect(fetch).toHaveBeenCalled())
    const [url, init] = vi.mocked(fetch).mock.calls[0]
    expect(url).toBe('/api/requests/r1/decision')
    expect(JSON.parse(init?.body as string)).toEqual({
      decision: 'REJECT',
      reason: 'CNPJ de outra filial',
    })
  })

  it('disables the confirm button while the request is in flight', async () => {
    let resolve!: (value: Response) => void
    vi.mocked(fetch).mockReturnValue(new Promise<Response>((r) => (resolve = r)))

    renderDialog()
    const button = confirmButton('Aprovar')
    await userEvent.click(button)

    await waitFor(() => expect(button).toBeDisabled())
    resolve({ ok: true, json: async () => ({}) } as Response)
  })

  it('submits only once on a double click', async () => {
    vi.mocked(fetch).mockReturnValue(new Promise<Response>(() => {}))

    renderDialog()
    await userEvent.dblClick(confirmButton('Aprovar'))

    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('shows the API error message and keeps the dialog open', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({
        error: { code: 'INVALID_TRANSITION', message: 'A solicitação já foi decidida' },
      }),
    } as Response)
    const { props } = renderDialog()

    await userEvent.click(confirmButton('Aprovar'))

    expect(await screen.findByRole('alert')).toHaveTextContent('A solicitação já foi decidida')
    expect(props.onSuccess).not.toHaveBeenCalled()
  })

  it('shows an error and re-enables confirm when the network fails', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'))
    const { props } = renderDialog()

    await userEvent.click(confirmButton('Aprovar'))

    expect(await screen.findByRole('alert')).toHaveTextContent(/não foi possível/i)
    expect(confirmButton('Aprovar')).toBeEnabled()
    expect(props.onSuccess).not.toHaveBeenCalled()
  })

  it('is labelled by its title', () => {
    renderDialog({ decision: 'REJECT' })
    expect(screen.getByRole('dialog', { name: 'Rejeitar solicitação' })).toBeInTheDocument()
  })

  it('asks to close when cancelled', async () => {
    const { props } = renderDialog()
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(props.onOpenChange).toHaveBeenCalledWith(false)
  })

  it('calls onSuccess after a confirmed approval', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({}) } as Response)
    const { props } = renderDialog()

    await userEvent.click(confirmButton('Aprovar'))

    await waitFor(() => expect(props.onSuccess).toHaveBeenCalled())
  })
})
