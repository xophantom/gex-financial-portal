import type { RequestAction, RequestStatus, UserRole } from '../domain/status.js'
import type { RequestCategory } from '../schemas/requests.js'

// Formato das respostas da API, como chegam ao cliente em JSON: valores em
// centavos já são `number` e datas são strings ISO (AAAA-MM-DD ou instante).

export interface PersonRef {
  id: string
  name: string
}

export interface RequestResponse {
  id: string
  supplier_name: string
  supplier_cnpj: string
  invoice_number: string
  amount_cents: number
  competence: string
  due_date: string
  category: RequestCategory
  description: string | null
  status: RequestStatus
  rejection_reason: string | null
  paid_at: string | null
  payment_reference: string | null
  is_overdue: boolean
  requester: PersonRef
  created_at: string
  updated_at: string
}

export interface RequestListResponse {
  data: RequestResponse[]
  page: number
  page_size: number
  total: number
  total_pages: number
}

export interface StatusEventResponse {
  id: string
  previous_status: RequestStatus | null
  new_status: RequestStatus
  reason: string | null
  created_at: string
  actor: PersonRef
}

export interface RequestDetailResponse {
  request: RequestResponse
  history: StatusEventResponse[]
  allowed_actions: RequestAction[]
  // O "hoje" das regras de calendário (APP_TODAY, quando definida): o limite
  // para a data de um pagamento.
  reference_date: string
}

export interface DashboardSummaryResponse {
  reference_date: string
  pending_amount_cents: number
  approved_amount_cents: number
  paid_this_month_amount_cents: number
  overdue_count: number
  request_count: number
  status_counts: Record<RequestStatus, number>
}

export interface SessionUser {
  id: string
  name: string
  email: string
  role: UserRole
}

export interface AuthResponse {
  access_token: string
  refresh_token: string
  user: SessionUser
}
