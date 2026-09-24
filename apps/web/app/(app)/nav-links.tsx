'use client'

import clsx from 'clsx'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

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

export function NavLinks({ role }: { role: string }) {
  const pathname = usePathname()
  const links = role === 'REQUESTER' ? REQUESTER_LINKS : LINKS
  const active = activeHref(pathname, links)

  return (
    <nav
      aria-label="Navegação principal"
      className="border-b border-zinc-200 bg-white px-6 dark:border-zinc-800 dark:bg-zinc-950"
    >
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
  )
}
