import { create } from 'zustand'

export interface Toast {
  id: string
  message: string
  tone: 'success' | 'error'
}

interface UiState {
  toasts: Toast[]
  pushToast: (toast: Omit<Toast, 'id'>) => void
  dismissToast: (id: string) => void
  // Qual diálogo de decisão está aberto no momento. Vive aqui, não como
  // useState local de request-detail.tsx, porque é o mesmo tipo de estado de
  // UI (o que está aberto agora) que uma tela futura precisando coordenar
  // com a lista reaproveitaria sem duplicar a store.
  openDialog: 'APPROVE' | 'REJECT' | 'MARK_PAID' | null
  setOpenDialog: (dialog: UiState['openDialog']) => void
}

export const useUiStore = create<UiState>((set) => ({
  toasts: [],
  pushToast: (toast) =>
    set((state) => ({ toasts: [...state.toasts, { id: crypto.randomUUID(), ...toast }] })),
  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
  openDialog: null,
  setOpenDialog: (openDialog) => set({ openDialog }),
}))
