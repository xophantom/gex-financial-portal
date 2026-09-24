import type { RequestStatus } from '@gex/shared'
import type { CSSProperties } from 'react'
import { statusLabel } from '@/lib/format/labels'
import { cn } from '@/lib/utils'
import { STATUS_STYLE } from './status-style'

// A palavra do carimbo físico: masculino ("o documento"), em caixa alta
// porque é assim que a borracha imprime. É o único texto em caixa alta da
// interface, e é só visual — leitores de tela recebem o rótulo normal.
const STAMP_WORD: Record<RequestStatus, string> = {
  PENDING: 'PENDENTE',
  APPROVED: 'APROVADO',
  REJECTED: 'REJEITADO',
  PAID: 'PAGO',
}

// Tinta irregular sem imagem, só com máscaras CSS combinadas:
// - manchas largas e suaves onde a borracha pegou menos tinta;
// - falhas miúdas em malhas esparsas de passos primos entre si, deslocadas
//   umas das outras para não formarem fileiras visíveis.
const INK: CSSProperties = {
  maskImage: [
    'radial-gradient(ellipse 38% 70% at 82% 18%, rgb(0 0 0 / 0.5), #000 75%)',
    'radial-gradient(ellipse 30% 55% at 12% 88%, rgb(0 0 0 / 0.6), #000 80%)',
    'radial-gradient(ellipse 22% 40% at 46% 42%, rgb(0 0 0 / 0.78), #000 90%)',
    'radial-gradient(circle, transparent 0 0.7px, #000 1.3px)',
    'radial-gradient(circle, transparent 0 0.5px, #000 1px)',
    'radial-gradient(circle, transparent 0 1px, #000 1.6px)',
  ].join(', '),
  maskSize: '100% 100%, 100% 100%, 100% 100%, 23px 17px, 13px 29px, 37px 31px',
  maskPosition: '0 0, 0 0, 0 0, 3px 5px, 9px 2px, 17px 11px',
  maskComposite: 'intersect',
}

export function StatusStamp({
  status,
  date,
  className,
}: {
  status: RequestStatus
  /** Data já formatada (DD/MM/AAAA) do evento que levou ao status atual. */
  date?: string | null
  className?: string
}) {
  const style = STATUS_STYLE[status]

  return (
    <div className={cn('pointer-events-none select-none', className)}>
      <p className="sr-only">
        Status: {statusLabel(status)}
        {date ? ` desde ${date}` : ''}
      </p>
      <div
        aria-hidden="true"
        data-slot="status-stamp"
        style={INK}
        className={cn(
          'inline-flex -rotate-6 flex-col items-center rounded-md border-[5px] border-double border-current px-4 pt-1.5 pb-1 font-heading opacity-85 mix-blend-multiply',
          style?.text ?? 'text-muted-foreground',
        )}
      >
        <span className="text-[1.75rem] leading-none font-extrabold tracking-[0.14em]">
          {STAMP_WORD[status] ?? statusLabel(status)}
        </span>
        {date && (
          <span className="mt-1 w-full border-t-2 border-current pt-0.5 text-center text-xs font-bold tracking-[0.12em] tabular-nums">
            {date}
          </span>
        )}
      </div>
    </div>
  )
}
