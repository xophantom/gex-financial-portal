'use client'

import { useEffect, useRef, type ReactNode } from 'react'

// Moldura modal genérica: fundo, foco inicial, Esc e devolução do foco. O
// conteúdo (com role="dialog" e título) é de quem usa.
export function DialogOverlay({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    // Foco inicial no primeiro campo (ou no primeiro botão, se não houver
    // campo); ao fechar, volta para o elemento que abriu o diálogo.
    panelRef.current?.querySelector<HTMLElement>('textarea, input, select, button')?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      opener?.focus()
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
      <button
        type="button"
        aria-label="Fechar"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 cursor-default"
      />
      <div ref={panelRef} className="relative z-10 w-full max-w-md rounded-lg bg-white p-4 shadow-xl dark:bg-zinc-900">
        {children}
      </div>
    </div>
  )
}

export function DialogActions({
  onClose,
  onConfirm,
  isSubmitting,
}: {
  onClose: () => void
  onConfirm: () => void
  isSubmitting: boolean
}) {
  return (
    <div className="flex justify-end gap-2">
      <button
        type="button"
        onClick={onClose}
        className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
      >
        Cancelar
      </button>
      <button
        type="button"
        onClick={onConfirm}
        disabled={isSubmitting}
        className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
      >
        Confirmar
      </button>
    </div>
  )
}

export function DialogError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p role="alert" className="text-sm text-red-700 dark:text-red-400">
      {message}
    </p>
  )
}
