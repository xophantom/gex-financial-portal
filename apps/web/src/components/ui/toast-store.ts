import { create } from 'zustand'

export interface Toast {
  id: string
  message: string
  tone: 'success' | 'error'
}

interface ToastState {
  toasts: Toast[]
  pushToast: (toast: Omit<Toast, 'id'>) => void
  dismissToast: (id: string) => void
}

// Global porque quem dispara (navegação, detalhe) e quem exibe (Toaster, no
// layout) estão em árvores diferentes e o toast precisa sobreviver a um
// router.refresh().
export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  pushToast: (toast) =>
    set((state) => ({ toasts: [...state.toasts, { id: crypto.randomUUID(), ...toast }] })),
  dismissToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
}))
