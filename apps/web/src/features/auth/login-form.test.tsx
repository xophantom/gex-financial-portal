import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LoginForm } from './login-form'

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }))

beforeEach(() => {
  push.mockReset()
  vi.stubGlobal('fetch', vi.fn())
})

describe('LoginForm', () => {
  it('associates a label with every field', () => {
    render(<LoginForm />)

    expect(screen.getByLabelText(/e-mail/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/senha/i)).toBeInTheDocument()
  })

  it('shows a field error for a malformed email without calling the API', async () => {
    render(<LoginForm />)

    await userEvent.type(screen.getByLabelText(/e-mail/i), 'not-an-email')
    await userEvent.type(screen.getByLabelText(/senha/i), 'whatever')
    await userEvent.click(screen.getByRole('button', { name: /entrar/i }))

    expect(await screen.findByText(/e-mail inválido/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/e-mail/i)).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText(/e-mail/i)).toHaveAccessibleDescription(/e-mail inválido/i)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('shows the server message when credentials are rejected', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: 'E-mail ou senha inválidos' } }),
    } as Response)

    render(<LoginForm />)
    await userEvent.type(screen.getByLabelText(/e-mail/i), 'solicitante@gex.test')
    await userEvent.type(screen.getByLabelText(/senha/i), 'wrong')
    await userEvent.click(screen.getByRole('button', { name: /entrar/i }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('E-mail ou senha inválidos')
    expect(alert).toHaveTextContent(/confira os dados/i)
    expect(push).not.toHaveBeenCalled()
  })

  it('disables the button while submitting, so a double click sends once', async () => {
    let resolve!: (value: Response) => void
    vi.mocked(fetch).mockReturnValue(new Promise<Response>((r) => (resolve = r)))

    render(<LoginForm />)
    await userEvent.type(screen.getByLabelText(/e-mail/i), 'solicitante@gex.test')
    await userEvent.type(screen.getByLabelText(/senha/i), 'GexRequester123!')

    const button = screen.getByRole('button', { name: /entrar/i })
    await userEvent.click(button)

    await waitFor(() => expect(button).toBeDisabled())
    expect(button).toHaveTextContent('Entrando…')
    await userEvent.click(button)
    expect(fetch).toHaveBeenCalledTimes(1)

    resolve({ ok: true, json: async () => ({ user: { role: 'REQUESTER' } }) } as Response)
    await waitFor(() => expect(push).toHaveBeenCalledWith('/dashboard'))
  })

  it('shows a message when the server cannot be reached', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'))

    render(<LoginForm />)
    await userEvent.type(screen.getByLabelText(/e-mail/i), 'solicitante@gex.test')
    await userEvent.type(screen.getByLabelText(/senha/i), 'GexRequester123!')
    await userEvent.click(screen.getByRole('button', { name: /entrar/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/não foi possível/i)
    expect(push).not.toHaveBeenCalled()
  })
})
