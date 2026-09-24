'use client'

import { CircleAlert } from 'lucide-react'
import { useRef, type ReactNode } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'

export type ActionTone = 'approve' | 'reject' | 'pay'

const CONFIRM_TONE: Record<ActionTone, string> = {
  approve: 'bg-approved text-white hover:bg-approved/90',
  reject: 'bg-rejected text-white hover:bg-rejected/90',
  pay: 'bg-paid text-white hover:bg-paid/90',
}

// Moldura comum a aprovar, rejeitar e pagar: título, contexto, campos, erro da
// API e o botão de confirmação na cor do status que a ação produz.
export function ActionDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  tone,
  error,
  isSubmitting,
  onConfirm,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: ReactNode
  confirmLabel: string
  tone: ActionTone
  error: string | null
  isSubmitting: boolean
  onConfirm: () => void
  children?: ReactNode
}) {
  // Sem <DialogTrigger> (quem abre é o detalhe, por estado), o Radix não sabe
  // para onde devolver o foco ao fechar e o deixaria no <body>. Guardamos o
  // elemento focado na abertura — o botão que abriu o diálogo — e voltamos a ele.
  const returnFocusTo = useRef<HTMLElement | null>(null)

  return (
    <Dialog open={open} onOpenChange={(next) => !isSubmitting && onOpenChange(next)}>
      <DialogContent
        className="sm:max-w-md"
        onOpenAutoFocus={() => {
          returnFocusTo.current = document.activeElement as HTMLElement | null
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          returnFocusTo.current?.focus()
        }}
      >
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            onConfirm()
          }}
          className="grid gap-5"
        >
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>

          {children}

          {error && (
            <Alert variant="destructive" className="border-rejected/25 bg-rejected-soft">
              <CircleAlert aria-hidden="true" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isSubmitting}>
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isSubmitting} className={cn(CONFIRM_TONE[tone])}>
              {isSubmitting && <Spinner />}
              {confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
