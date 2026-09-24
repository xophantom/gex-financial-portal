import type { RequestAction } from '@gex/shared'
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
  openDialog: RequestAction | null
  setOpenDialog: (dialog: UiState['openDialog']) => void
}

export const useUiStore = create<UiState>((set) => ({
  toasts: [],
  pushToast: (toast) =>
    set((state) => ({ toasts: [...state.toasts, { id: crypto.randomUUID(), ...toast }] })),
  dismissToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
  openDialog: null,
  setOpenDialog: (openDialog) => set({ openDialog }),
}))
