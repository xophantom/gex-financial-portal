import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NavLinks } from './nav-links'

const pathname = vi.hoisted(() => ({ current: '/dashboard' }))

vi.mock('next/navigation', () => ({
  usePathname: () => pathname.current,
}))

beforeEach(() => {
  pathname.current = '/dashboard'
})

describe('NavLinks', () => {
  it('offers "Nova solicitação" only to the requester', () => {
    const { unmount } = render(<NavLinks role="REQUESTER" />)
    expect(screen.getByRole('link', { name: 'Nova solicitação' })).toHaveAttribute('href', '/requests/new')
    unmount()

    render(<NavLinks role="FINANCE" />)
    expect(screen.queryByRole('link', { name: 'Nova solicitação' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Solicitações' })).toBeInTheDocument()
  })

  it('marks the most specific matching link as the current page', () => {
    pathname.current = '/requests/new'
    render(<NavLinks role="REQUESTER" />)

    expect(screen.getByRole('link', { name: 'Nova solicitação' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Solicitações' })).not.toHaveAttribute('aria-current')
  })

  it('keeps "Solicitações" active on a request detail page', () => {
    pathname.current = '/requests/10000000-0000-4000-8000-000000000001'
    render(<NavLinks role="FINANCE" />)

    expect(screen.getByRole('link', { name: 'Solicitações' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute('aria-current')
  })
})
