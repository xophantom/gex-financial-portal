import type { RequestStatus } from '@gex/shared'

// Classes por status, derivadas dos tokens de globals.css: badge, carimbo,
// régua do dashboard e linha do tempo usam a mesma cor para o mesmo status.
export const STATUS_STYLE: Record<RequestStatus, { text: string; soft: string; fill: string }> = {
  PENDING: { text: 'text-pending', soft: 'bg-pending-soft', fill: 'bg-pending' },
  APPROVED: { text: 'text-approved', soft: 'bg-approved-soft', fill: 'bg-approved' },
  REJECTED: { text: 'text-rejected', soft: 'bg-rejected-soft', fill: 'bg-rejected' },
  PAID: { text: 'text-paid', soft: 'bg-paid-soft', fill: 'bg-paid' },
}
