'use client'

import { Plus } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/format/dates'
import { formatBrl } from '@/lib/format/money'
import { StatusStamp } from './status-stamp'

// Confirmação depois do cadastro: a solicitação nasce pendente, então o
// carimbo PENDENTE é a prova visual de que ela entrou na fila do financeiro.
export function RequestCreated({
  requestId,
  supplierName,
  invoiceNumber,
  amountCents,
  onCreateAnother,
}: {
  requestId: string
  supplierName: string
  invoiceNumber: string
  amountCents: number
  onCreateAnother: () => void
}) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  const [today] = useState(() => formatDate(new Date().toISOString()))

  // O formulário some de baixo do foco; o título da confirmação o recebe
  // para que teclado e leitor de tela continuem no lugar certo.
  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  return (
    <section
      aria-labelledby="request-created-heading"
      className="flex flex-col items-center rounded-lg border bg-card px-6 py-12 text-center shadow-xs sm:px-10 sm:py-14"
    >
      <StatusStamp status="PENDING" date={today} />
      <h2
        id="request-created-heading"
        ref={headingRef}
        tabIndex={-1}
        className="mt-8 text-2xl font-semibold text-foreground outline-none"
      >
        Solicitação cadastrada
      </h2>
      <p role="status" className="mt-2 max-w-md text-[0.9375rem] text-pretty text-muted-foreground">
        A nota <span className="font-medium text-foreground">{invoiceNumber}</span> de{' '}
        <span className="font-medium text-foreground">{supplierName}</span>, no valor de{' '}
        <span className="font-medium whitespace-nowrap text-foreground tabular-nums">
          {formatBrl(amountCents)}
        </span>
        , foi para o financeiro aprovar.
      </p>
      <div className="mt-8 flex flex-col-reverse gap-2 sm:flex-row">
        <Button variant="outline" size="lg" onClick={onCreateAnother}>
          <Plus aria-hidden="true" />
          Cadastrar outra
        </Button>
        <Button asChild size="lg">
          <Link href={`/requests/${requestId}`}>Ver solicitação</Link>
        </Button>
      </div>
    </section>
  )
}
