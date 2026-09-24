'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { SessionUser } from '@/lib/session'

// Rótulo de exibição, não uma checagem de tipo — o valor cru já vem
// validado do backend (UserRole em @gex/shared). O fallback `?? user.role`
// existe só para nunca esconder um papel desconhecido no futuro atrás de
// undefined.
const ROLE_LABELS: Record<string, string> = {
  REQUESTER: 'Solicitante',
  FINANCE: 'Financeiro',
}

export function AppNav({ user }: { user: SessionUser }) {
  const router = useRouter()
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const handleLogout = async () => {
    setIsLoggingOut(true)
    // POST antes do push: só depois que o cookie httpOnly foi apagado no
    // servidor é seguro navegar para /login — na ordem inversa, um usuário
    // que aperte "voltar" reencontraria uma sessão ainda válida.
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-3 dark:border-zinc-800 dark:bg-zinc-950">
      <span className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
        Portal de Solicitações Financeiras
      </span>
      <div className="flex items-center gap-3 text-sm">
        <span className="text-zinc-700 dark:text-zinc-300">
          {user.name} · {ROLE_LABELS[user.role] ?? user.role}
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
    </header>
  )
}
