'use client'

import { useEffect } from 'react'
import { useUiStore } from '@/stores/ui-store'

const AUTO_DISMISS_MS = 4000

// aria-live="polite": a confirmação de uma aprovação/rejeição precisa ser
// anunciada por leitor de tela mesmo sem o foco estar no toast — "polite"
// espera a fala atual terminar, ao contrário de "assertive", que a interrompe.
export function Toaster() {
  const toasts = useUiStore((state) => state.toasts)
  const dismissToast = useUiStore((state) => state.dismissToast)

  useEffect(() => {
    const timers = toasts.map((toast) => setTimeout(() => dismissToast(toast.id), AUTO_DISMISS_MS))
    return () => {
      timers.forEach(clearTimeout)
    }
  }, [toasts, dismissToast])

  if (toasts.length === 0) return null

  return (
    <div aria-live="polite" className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={
            toast.tone === 'error'
              ? 'rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-lg'
              : 'rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-lg dark:bg-zinc-100 dark:text-zinc-900'
          }
        >
          {toast.message}
        </div>
      ))}
    </div>
  )
}
