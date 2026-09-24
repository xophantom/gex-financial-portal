export const REQUEST_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'PAID'] as const
export type RequestStatus = (typeof REQUEST_STATUSES)[number]

export const USER_ROLES = ['REQUESTER', 'FINANCE'] as const
export type UserRole = (typeof USER_ROLES)[number]

export const REQUEST_ACTIONS = ['APPROVE', 'REJECT', 'MARK_PAID'] as const
export type RequestAction = (typeof REQUEST_ACTIONS)[number]

// A máquina é dado, não cadeia de if: adicionar um status obriga a declarar
// para onde ele vai, em vez de deixar um ramo faltando passar despercebido.
const TRANSITIONS: Record<RequestStatus, readonly RequestStatus[]> = {
  PENDING: ['APPROVED', 'REJECTED'],
  APPROVED: ['PAID'],
  REJECTED: [],
  PAID: [],
}

const ACTION_TARGET: Record<RequestAction, RequestStatus> = {
  APPROVE: 'APPROVED',
  REJECT: 'REJECTED',
  MARK_PAID: 'PAID',
}

export function canTransition(from: RequestStatus, to: RequestStatus): boolean {
  if (!REQUEST_STATUSES.includes(from)) {
    throw new Error(`Status inválido: ${from}`)
  }
  if (!REQUEST_STATUSES.includes(to)) {
    throw new Error(`Status inválido: ${to}`)
  }
  return TRANSITIONS[from].includes(to)
}

export function nextStatusFor(action: RequestAction): RequestStatus {
  if (!REQUEST_ACTIONS.includes(action)) {
    throw new Error(`Ação inválida: ${action}`)
  }
  return ACTION_TARGET[action]
}

export function allowedActionsFor(
  status: RequestStatus,
  role: UserRole,
): RequestAction[] {
  if (role !== 'FINANCE') return []

  return REQUEST_ACTIONS.filter((action) =>
    canTransition(status, ACTION_TARGET[action]),
  )
}
