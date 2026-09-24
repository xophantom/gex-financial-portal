import type { RequestStatus, UserRole } from '@gex/shared'

export const STATUS_LABELS: Record<RequestStatus, string> = {
  PENDING: 'Pendente',
  APPROVED: 'Aprovada',
  REJECTED: 'Rejeitada',
  PAID: 'Paga',
}

export const ROLE_LABELS: Record<UserRole, string> = {
  REQUESTER: 'Solicitante',
  FINANCE: 'Financeiro',
}

// O fallback para o valor cru evita esconder atrás de `undefined` um status
// ou papel que o backend passe a enviar antes do front conhecê-lo.
export function statusLabel(status: string): string {
  return STATUS_LABELS[status as RequestStatus] ?? status
}

export function roleLabel(role: string): string {
  return ROLE_LABELS[role as UserRole] ?? role
}
