'use client'

import type { SessionUser } from '@gex/shared'
import clsx from 'clsx'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { roleLabel } from '@/lib/format/labels'
import { useUiStore } from '@/stores/ui-store'

interface NavLink {
  href: string
  label: string
}

const LINKS: NavLink[] = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/requests', label: 'Solicitações' },
]

const REQUESTER_LINKS: NavLink[] = [...LINKS, { href: '/requests/new', label: 'Nova solicitação' }]

// O link ativo é o de prefixo mais longo: em /requests/new, "Nova
// solicitação" vence "Solicitações"; no detalhe (/requests/:id), vence
// "Solicitações".
function activeHref(pathname: string, links: NavLink[]): string | undefined {
  return links
    .filter(({ href }) => pathname === href || pathname.startsWith(`${href}/`))
    .reduce<string | undefined>(
      (best, { href }) => (!best || href.length > best.length ? href : best),
      undefined,
    )
}

// Cabeçalho do grupo autenticado: identidade do usuário, logout e a
// navegação principal.
export function AppNav({ user }: { user: SessionUser }) {
  const router = useRouter()
  const pathname = usePathname()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const pushToast = useUiStore((state) => state.pushToast)

  const links = user.role === 'REQUESTER' ? REQUESTER_LINKS : LINKS
  const active = activeHref(pathname, links)

  const handleLogout = async () => {
    setIsLoggingOut(true)
    // POST antes do push: só depois que o cookie httpOnly foi apagado no
    // servidor é seguro navegar para /login — na ordem inversa, um usuário
    // que aperte "voltar" reencontraria uma sessão ainda válida.
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch {
      setIsLoggingOut(false)
      pushToast({ message: 'Não foi possível sair. Tente novamente.', tone: 'error' })
      return
    }
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="border-b border-zinc-200 bg-white px-6 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center justify-between py-3">
        <span className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
          Portal de Solicitações Financeiras
        </span>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-zinc-700 dark:text-zinc-300">
            {user.name} · {roleLabel(user.role)}
          </span>
          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="rounded-md border border-zinc-300 px-3 py-1.5 font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Sair
          </button>
        </div>
      </div>

      <nav aria-label="Navegação principal">
        <ul className="flex gap-1 text-sm">
          {links.map(({ href, label }) => (
            <li key={href}>
              <Link
                href={href}
                aria-current={href === active ? 'page' : undefined}
                className={clsx(
                  '-mb-px inline-block border-b-2 px-3 py-2 font-medium',
                  href === active
                    ? 'border-zinc-900 text-zinc-950 dark:border-zinc-100 dark:text-zinc-50'
                    : 'border-transparent text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50',
                )}
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  )
}
