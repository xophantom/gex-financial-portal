import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MarkPaidDialog, type MarkPaidDialogProps } from './mark-paid-dialog'

beforeEach(() => vi.stubGlobal('fetch', vi.fn()))

function renderDialog(props: Partial<MarkPaidDialogProps> = {}) {
  const merged: MarkPaidDialogProps = {
    requestId: 'r1',
    supplierName: 'Aurora Serviços Digitais',
    referenceDate: '2026-09-18',
    open: true,
    onOpenChange: vi.fn(),
    onSuccess: vi.fn(),
    ...props,
  }
  return { ...render(<MarkPaidDialog {...merged} />), props: merged }
}

const confirmButton = () => screen.getByRole('button', { name: 'Registrar pagamento' })

describe('MarkPaidDialog', () => {
  // Com APP_TODAY no passado, o "hoje" do navegador seria recusado pela API.
  it('starts at the reference date and does not offer a later one', () => {
    renderDialog()

    const paidAt = screen.getByLabelText(/data do pagamento/i)
    expect(paidAt).toHaveValue('2026-09-18')
    expect(paidAt).toHaveAttribute('max', '2026-09-18')
    expect(paidAt).toHaveAccessibleDescription(/18\/09\/2026/)
  })

  it('requires both a date and a payment reference, each on its own field', async () => {
    const { props } = renderDialog()

    await userEvent.clear(screen.getByLabelText(/data do pagamento/i))
    await userEvent.click(confirmButton())

    expect(await screen.findByText(/informe a data/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/data do pagamento/i)).toHaveAccessibleDescription(
      /informe a data/i,
    )
    expect(screen.getByLabelText(/referência/i)).toHaveAccessibleDescription(
      /informe a referência/i,
    )
    expect(fetch).not.toHaveBeenCalled()
    expect(props.onSuccess).not.toHaveBeenCalled()
  })

  it('submits once filled and disables the confirm button meanwhile', async () => {
    let resolve!: (value: Response) => void
    vi.mocked(fetch).mockReturnValue(new Promise<Response>((r) => (resolve = r)))

    renderDialog()
    await userEvent.clear(screen.getByLabelText(/data do pagamento/i))
    await userEvent.type(screen.getByLabelText(/data do pagamento/i), '2026-09-15')
    await userEvent.type(screen.getByLabelText(/referência/i), 'PAG-2026-0099')

    const button = confirmButton()
    await userEvent.click(button)

    await waitFor(() => expect(button).toBeDisabled())
    expect(fetch).toHaveBeenCalledTimes(1)
    const [url, init] = vi.mocked(fetch).mock.calls[0]
    expect(url).toBe('/api/requests/r1/mark-paid')
    expect(JSON.parse(init?.body as string)).toEqual({
      paid_at: '2026-09-15',
      payment_reference: 'PAG-2026-0099',
    })
    resolve({ ok: true, json: async () => ({}) } as Response)
  })

  it('shows the API error message', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({
        error: { code: 'INVALID_TRANSITION', message: 'Não é possível mudar de PAID para PAID' },
      }),
    } as Response)

    renderDialog()
    await userEvent.type(screen.getByLabelText(/referência/i), 'PAG-2026-0099')
    await userEvent.click(confirmButton())

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não é possível mudar de PAID para PAID',
    )
  })
})
