'use client'

import { useEffect } from 'react'
import { useToastStore, type Toast } from './toast-store'

const AUTO_DISMISS_MS = 4000

// A região aria-live fica sempre montada: leitores de tela só anunciam o que
// é inserido numa região que já existia.
export function Toaster() {
  const toasts = useToastStore((state) => state.toasts)

  return (
    <div aria-live="polite" className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  )
}

// Um timer por toast: um toast novo não reinicia a contagem dos anteriores.
function ToastItem({ toast }: { toast: Toast }) {
  const dismissToast = useToastStore((state) => state.dismissToast)

  useEffect(() => {
    const timer = setTimeout(() => dismissToast(toast.id), AUTO_DISMISS_MS)
    return () => clearTimeout(timer)
  }, [toast.id, dismissToast])

  return (
    <div
      className={
        toast.tone === 'error'
          ? 'rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-lg'
          : 'rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-lg dark:bg-zinc-100 dark:text-zinc-900'
      }
    >
      {toast.message}
    </div>
  )
}
