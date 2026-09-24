import type { RequestCategory, RequestStatus, UserRole } from '@gex/shared'

const STATUS_LABELS: Record<RequestStatus, string> = {
  PENDING: 'Pendente',
  APPROVED: 'Aprovada',
  REJECTED: 'Rejeitada',
  PAID: 'Paga',
}

// A API guarda a categoria como código em caixa alta; na tela ela aparece
// como palavra comum.
const CATEGORY_LABELS: Record<RequestCategory, string> = {
  SOFTWARE: 'Software',
  SERVIÇOS: 'Serviços',
  MARKETING: 'Marketing',
  INFRAESTRUTURA: 'Infraestrutura',
}

const ROLE_LABELS: Record<UserRole, string> = {
  REQUESTER: 'Solicitante',
  FINANCE: 'Financeiro',
}

// O fallback para o valor cru evita esconder atrás de `undefined` um status,
// categoria ou papel que o backend passe a enviar antes do front conhecê-lo.
export function statusLabel(status: string): string {
  return STATUS_LABELS[status as RequestStatus] ?? status
}

export function roleLabel(role: string): string {
  return ROLE_LABELS[role as UserRole] ?? role
}

export function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category as RequestCategory] ?? category
}
