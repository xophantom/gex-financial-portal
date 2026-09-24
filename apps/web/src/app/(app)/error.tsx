'use client'

import { RotateCw, TriangleAlert } from 'lucide-react'
import Link from 'next/link'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'

// Error boundary do grupo autenticado: fica abaixo do layout, então o menu
// continua disponível. Em produção a mensagem de um erro de Server Component
// chega genérica ao browser; o digest liga esta tela ao log do servidor.
// `retry` (Next 16) refaz o fetch dos Server Components antes de re-renderizar.
export default function AppError({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <Empty className="min-h-[60vh]">
      <EmptyHeader>
        <EmptyMedia variant="icon" className="size-12 rounded-lg bg-rejected-soft text-rejected">
          <TriangleAlert className="size-6" />
        </EmptyMedia>
        <EmptyTitle>
          <h1 className="text-2xl font-semibold">Não foi possível carregar esta página</h1>
        </EmptyTitle>
        <EmptyDescription>
          O servidor não respondeu como esperado. Tente de novo em alguns instantes; se o erro
          continuar, informe o código abaixo ao suporte.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <div className="flex flex-wrap justify-center gap-2">
          <Button size="lg" onClick={() => retry()}>
            <RotateCw />
            Tentar novamente
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/dashboard">Ir para a visão geral</Link>
          </Button>
        </div>
        {error.digest && (
          <p className="text-xs text-muted-foreground">Código do erro: {error.digest}</p>
        )}
      </EmptyContent>
    </Empty>
  )
}
