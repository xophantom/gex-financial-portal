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

  it('surfaces a duplicate conflict on the invoice field', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({
        error: { code: 'DUPLICATE_INVOICE', message: 'Já existe uma solicitação com este CNPJ e número de nota' },
      }),
    } as Response)

    render(<RequestForm />)
    await fill()
    await userEvent.click(screen.getByRole('button', { name: /cadastrar/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/já existe uma solicitação/i)
  })
})
