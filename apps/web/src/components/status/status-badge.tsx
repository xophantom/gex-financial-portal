import type { RequestStatus } from '@gex/shared'
import { Badge } from '@/components/ui/badge'
import { statusLabel } from '@/lib/format/labels'
import { cn } from '@/lib/utils'
import { STATUS_STYLE } from './status-style'

export function StatusBadge({ status, className }: { status: RequestStatus; className?: string }) {
  const style = STATUS_STYLE[status]

  return (
    <Badge
      variant="outline"
      className={cn('gap-1.5 border-transparent', style?.soft, style?.text, className)}
    >
      <span
        aria-hidden="true"
        className={cn('size-1.5 rounded-full', style?.fill ?? 'bg-muted-foreground')}
      />
      {statusLabel(status)}
    </Badge>
  )
}
