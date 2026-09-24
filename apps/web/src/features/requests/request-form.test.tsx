import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RequestForm } from './request-form'

beforeEach(() => vi.stubGlobal('fetch', vi.fn()))

const fill = async () => {
  await userEvent.type(screen.getByLabelText(/fornecedor/i), 'Aurora Serviços')
  await userEvent.type(screen.getByLabelText(/cnpj/i), '10000000000145')
  await userEvent.type(screen.getByLabelText(/número da nota/i), 'NF-2026-9001')
  await userEvent.type(screen.getByLabelText(/valor/i), '155313')
  await userEvent.type(screen.getByLabelText(/competência/i), '092026')
  await userEvent.type(screen.getByLabelText(/vencimento/i), '2026-09-30')
  await userEvent.selectOptions(screen.getByLabelText(/categoria/i), 'SOFTWARE')
}

describe('RequestForm', () => {
  it('masks the CNPJ as the user types', async () => {
    render(<RequestForm />)
    await userEvent.type(screen.getByLabelText(/cnpj/i), '10000000000145')

    expect(screen.getByLabelText(/cnpj/i)).toHaveValue('10.000.000/0001-45')
  })

  it('masks money as the user types', async () => {
    render(<RequestForm />)
    await userEvent.type(screen.getByLabelText(/valor/i), '155313')

    expect(screen.getByLabelText(/valor/i)).toHaveValue('1.553,13')
  })

  it('masks competence as MM/AAAA', async () => {
    render(<RequestForm />)
    await userEvent.type(screen.getByLabelText(/competência/i), '092026')

    expect(screen.getByLabelText(/competência/i)).toHaveValue('09/2026')
  })

  it('sends amount as integer cents and CNPJ as bare digits', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'new-id' }),
    } as Response)

    render(<RequestForm />)
    await fill()
    await userEvent.click(screen.getByRole('button', { name: /cadastrar/i }))

    await waitFor(() => expect(fetch).toHaveBeenCalled())
    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string)

    expect(body.amount_cents).toBe(155313)
    expect(body.supplier_cnpj).toBe('10000000000145')
    expect(body.competence).toBe('2026-09')
  })

  it('rejects an invalid CNPJ before reaching the API', async () => {
    render(<RequestForm />)
    await fill()
    await userEvent.clear(screen.getByLabelText(/cnpj/i))
    await userEvent.type(screen.getByLabelText(/cnpj/i), '10000000000146')
    await userEvent.click(screen.getByRole('button', { name: /cadastrar/i }))

    expect(await screen.findByText(/cnpj inválido/i)).toBeInTheDocument()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('rejects a zero amount', async () => {
    render(<RequestForm />)
    await fill()
    await userEvent.clear(screen.getByLabelText(/valor/i))
    await userEvent.type(screen.getByLabelText(/valor/i), '000')
    await userEvent.click(screen.getByRole('button', { name: /cadastrar/i }))

    expect(await screen.findByText(/maior que zero/i)).toBeInTheDocument()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('sends a stable Idempotency-Key and submits once on a double click', async () => {
    let resolve!: (value: Response) => void
    vi.mocked(fetch).mockReturnValue(new Promise<Response>((r) => (resolve = r)))

    render(<RequestForm />)
    await fill()
    const button = screen.getByRole('button', { name: /cadastrar/i })

    await userEvent.click(button)
    await waitFor(() => expect(button).toBeDisabled())
    await userEvent.click(button)

    expect(fetch).toHaveBeenCalledTimes(1)
    const headers = vi.mocked(fetch).mock.calls[0][1]?.headers as Record<string, string>
    expect(headers['Idempotency-Key']).toEqual(expect.any(String))

    resolve({ ok: true, json: async () => ({ id: 'new-id' }) } as Response)
  })

  it('starts with no category selected and requires one', async () => {
    render(<RequestForm />)
    expect(screen.getByLabelText(/categoria/i)).toHaveValue('')

    await userEvent.click(screen.getByRole('button', { name: /cadastrar/i }))

    expect(await screen.findByText(/escolha a categoria/i)).toBeInTheDocument()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('links an invalid field to its error message', async () => {
    render(<RequestForm />)
    await fill()
    await userEvent.clear(screen.getByLabelText(/cnpj/i))
    await userEvent.type(screen.getByLabelText(/cnpj/i), '10000000000146')
    await userEvent.click(screen.getByRole('button', { name: /cadastrar/i }))

    const cnpj = screen.getByLabelText(/cnpj/i)
    await waitFor(() => expect(cnpj).toHaveAttribute('aria-invalid', 'true'))
    expect(cnpj).toHaveAccessibleDescription(/cnpj inválido/i)
  })

  it('shows a message when the server cannot be reached', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'))

    render(<RequestForm />)
    await fill()
    await userEvent.click(screen.getByRole('button', { name: /cadastrar/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/não foi possível/i)
  })

  it('surfaces a duplicate conflict on the invoice field', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({
        error: {
          code: 'DUPLICATE_INVOICE',
          message: 'Já existe uma solicitação com este CNPJ e número de nota',
        },
      }),
    } as Response)

    render(<RequestForm />)
    await fill()
    await userEvent.click(screen.getByRole('button', { name: /cadastrar/i }))

    const invoice = screen.getByLabelText(/número da nota/i)
    await waitFor(() => expect(invoice).toHaveAttribute('aria-invalid', 'true'))
    expect(invoice).toHaveAccessibleDescription(/já existe uma solicitação/i)
  })

  it('asks for the due date instead of describing its format when it is empty', async () => {
    render(<RequestForm />)
    await userEvent.click(screen.getByRole('button', { name: /cadastrar/i }))

    expect(await screen.findByText('Informe o vencimento')).toBeInTheDocument()
    expect(screen.queryByText(/use o formato/i)).not.toBeInTheDocument()
  })

  it('shows the API message for errors that belong to no field', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: { code: 'FORBIDDEN', message: 'Só solicitantes cadastram' } }),
    } as Response)

    render(<RequestForm />)
    await fill()
    await userEvent.click(screen.getByRole('button', { name: /cadastrar/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Só solicitantes cadastram')
    expect(screen.getByRole('button', { name: /cadastrar/i })).toBeEnabled()
  })

  it('confirms the new request and links to it', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'new-id' }),
    } as Response)

    render(<RequestForm />)
    await fill()
    await userEvent.click(screen.getByRole('button', { name: /cadastrar/i }))

    const heading = await screen.findByRole('heading', { name: 'Solicitação cadastrada' })
    expect(heading).toHaveFocus()
    expect(screen.getByText('NF-2026-9001')).toBeInTheDocument()
    expect(screen.getByText('R$ 1.553,13')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver solicitação' })).toHaveAttribute(
      'href',
      '/requests/new-id',
    )
  })

  it('starts a clean form with a new Idempotency-Key on "Cadastrar outra"', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'new-id' }),
    } as Response)

    render(<RequestForm />)
    await fill()
    await userEvent.click(screen.getByRole('button', { name: /cadastrar solicitação/i }))
    await userEvent.click(await screen.findByRole('button', { name: 'Cadastrar outra' }))

    expect(screen.getByLabelText(/fornecedor/i)).toHaveValue('')
    await fill()
    await userEvent.click(screen.getByRole('button', { name: /cadastrar solicitação/i }))
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))

    const keyOf = (call: number) =>
      (vi.mocked(fetch).mock.calls[call][1]?.headers as Record<string, string>)['Idempotency-Key']
    expect(keyOf(0)).not.toBe(keyOf(1))
  })
})
