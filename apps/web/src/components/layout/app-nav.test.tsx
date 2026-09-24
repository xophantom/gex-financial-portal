import type { SessionUser } from '@gex/shared'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppNav } from './app-nav'

const pathname = vi.hoisted(() => ({ current: '/dashboard' }))
const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }))

vi.mock('next/navigation', () => ({
  usePathname: () => pathname.current,
  useRouter: () => router,
}))

const requester: SessionUser = {
  id: '10000000-0000-4000-8000-000000000001',
  name: 'Ana Solicitante',
  email: 'solicitante@gex.test',
  role: 'REQUESTER',
}

const finance: SessionUser = {
  id: '10000000-0000-4000-8000-000000000002',
  name: 'Fernanda Financeiro',
  email: 'financeiro@gex.test',
  role: 'FINANCE',
}

beforeEach(() => {
  pathname.current = '/dashboard'
  router.push.mockReset()
  router.refresh.mockReset()
  vi.stubGlobal('fetch', vi.fn())
})

describe('AppNav', () => {
  it('shows who is logged in and their role', () => {
    render(<AppNav user={finance} />)

    expect(screen.getByText('Fernanda Financeiro')).toBeInTheDocument()
    expect(screen.getByText('Financeiro')).toBeInTheDocument()
  })

  it('offers "Nova solicitação" only to the requester', () => {
    const { unmount } = render(<AppNav user={requester} />)
    expect(screen.getByRole('link', { name: 'Nova solicitação' })).toHaveAttribute(
      'href',
      '/requests/new',
    )
    unmount()

    render(<AppNav user={finance} />)
    expect(screen.queryByRole('link', { name: 'Nova solicitação' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Solicitações' })).toBeInTheDocument()
  })

  it('marks the most specific matching link as the current page', () => {
    pathname.current = '/requests/new'
    render(<AppNav user={requester} />)

    expect(screen.getByRole('link', { name: 'Nova solicitação' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(screen.getByRole('link', { name: 'Solicitações' })).not.toHaveAttribute('aria-current')
  })

  it('keeps "Solicitações" active on a request detail page', () => {
    pathname.current = '/requests/10000000-0000-4000-8000-000000000001'
    render(<AppNav user={finance} />)

    expect(screen.getByRole('link', { name: 'Solicitações' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(screen.getByRole('link', { name: 'Visão geral' })).not.toHaveAttribute('aria-current')
  })

  it('clears the server session before navigating to /login on logout', async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json({ ok: true }))
    render(<AppNav user={requester} />)

    await userEvent.click(screen.getByRole('button', { name: 'Sair' }))

    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/login'))
    expect(fetch).toHaveBeenCalledWith('/api/auth/logout', { method: 'POST' })
  })
})
