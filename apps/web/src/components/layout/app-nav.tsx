'use client'

import type { SessionUser } from '@gex/shared'
import { FileText, LayoutDashboard, LogOut, Plus } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, type ComponentType } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { roleLabel } from '@/lib/format/labels'
import { cn } from '@/lib/utils'

interface NavLink {
  href: string
  label: string
  icon: ComponentType<{ className?: string }>
}

const LINKS: NavLink[] = [
  { href: '/dashboard', label: 'Visão geral', icon: LayoutDashboard },
  { href: '/requests', label: 'Solicitações', icon: FileText },
]

const NEW_REQUEST_HREF = '/requests/new'

// O link ativo é o de prefixo mais longo: no detalhe (/requests/:id) vence
// "Solicitações"; em /requests/new, "Nova solicitação".
function activeHref(pathname: string, hrefs: string[]): string | undefined {
  return hrefs
    .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
    .reduce<string | undefined>(
      (best, href) => (!best || href.length > best.length ? href : best),
      undefined,
    )
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}

// No celular cada item vira um segmento (ícone sobre o rótulo) de uma barra que
// divide a largura; em telas largas, uma linha da sidebar.
const linkBase =
  'flex flex-col items-center justify-center gap-1 whitespace-nowrap rounded-md px-2 py-2 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-foreground md:flex-row md:justify-start md:gap-3 md:px-3 md:text-sm'

// Sidebar fixa em telas largas; no celular, a mesma marcação vira uma barra no
// topo (marca e usuário na primeira linha, navegação rolável na segunda).
export function AppNav({ user }: { user: SessionUser }) {
  const router = useRouter()
  const pathname = usePathname()
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const canCreate = user.role === 'REQUESTER'
  const active = activeHref(pathname, [
    ...LINKS.map(({ href }) => href),
    ...(canCreate ? [NEW_REQUEST_HREF] : []),
  ])

  const handleLogout = async () => {
    setIsLoggingOut(true)
    // POST antes do push: só depois que o cookie httpOnly foi apagado é seguro
    // navegar para /login; na ordem inversa, "voltar" reencontraria a sessão.
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch {
      setIsLoggingOut(false)
      toast.error('Não foi possível sair. Tente novamente.')
      return
    }
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="grid grid-cols-[1fr_auto] items-center gap-y-3 bg-sidebar px-4 py-3 text-sidebar-foreground md:fixed md:inset-y-0 md:left-0 md:flex md:w-64 md:flex-col md:items-stretch md:gap-y-0 md:p-0">
      <Link
        href="/dashboard"
        className="flex items-center gap-3 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sidebar-foreground md:px-6 md:pt-7 md:pb-8"
      >
        <span
          aria-hidden="true"
          className="grid size-9 place-items-center rounded-md border-2 border-sidebar-foreground/80 font-heading text-[0.7rem] font-bold"
        >
          GEX
        </span>
        <span className="leading-tight">
          <span className="block font-heading text-base font-semibold">Contas a pagar</span>
          <span className="block text-xs text-sidebar-muted">Solicitações financeiras</span>
        </span>
      </Link>

      <nav
        aria-label="Navegação principal"
        className="order-3 col-span-2 md:order-2 md:flex-1 md:px-4"
      >
        <ul className="grid auto-cols-fr grid-flow-col gap-1 md:flex md:flex-col">
          {canCreate && (
            <li className="order-last md:order-none md:mb-4">
              <Link
                href={NEW_REQUEST_HREF}
                aria-current={active === NEW_REQUEST_HREF ? 'page' : undefined}
                className={cn(
                  linkBase,
                  'md:bg-primary md:text-primary-foreground md:hover:bg-primary/90',
                  active === NEW_REQUEST_HREF
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground md:ring-2 md:ring-sidebar-foreground/40'
                    : 'text-sidebar-muted hover:text-sidebar-accent-foreground',
                )}
              >
                <Plus className="size-4" />
                Nova solicitação
              </Link>
            </li>
          )}
          {LINKS.map(({ href, label, icon: Icon }) => (
            <li key={href}>
              <Link
                href={href}
                aria-current={href === active ? 'page' : undefined}
                className={cn(
                  linkBase,
                  href === active
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-muted hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
                )}
              >
                <Icon className="size-4" />
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="order-2 flex items-center gap-3 md:order-3 md:border-t md:border-sidebar-border md:px-6 md:py-5">
        <span
          aria-hidden="true"
          className="grid size-9 shrink-0 place-items-center rounded-full bg-sidebar-accent text-xs font-semibold"
        >
          {initials(user.name)}
        </span>
        <span className="hidden min-w-0 flex-1 leading-tight md:block">
          <span className="block truncate text-sm font-medium">{user.name}</span>
          <span className="block text-xs text-sidebar-muted">{roleLabel(user.role)}</span>
        </span>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleLogout}
          disabled={isLoggingOut}
          aria-label="Sair"
          title="Sair"
          className="text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <LogOut />
        </Button>
      </div>
    </aside>
  )
}
