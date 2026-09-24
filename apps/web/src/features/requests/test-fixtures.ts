import type { RequestResponse } from '@gex/shared'

// Solicitação completa no formato de RequestResponse, para os testes dos
// componentes desta feature sobrescreverem só o que importa em cada caso.
export function buildRequest(overrides: Partial<RequestResponse> = {}): RequestResponse {
  return {
    id: '20000000-0000-4000-8000-000000000001',
    supplier_name: 'Aurora Serviços Digitais',
    supplier_cnpj: '10000000000145',
    invoice_number: 'NF-2026-1001',
    amount_cents: 125000,
    competence: '2026-09',
    due_date: '2026-09-10',
    category: 'SOFTWARE',
    description: null,
    status: 'PENDING',
    rejection_reason: null,
    paid_at: null,
    payment_reference: null,
    is_overdue: false,
    requester: { id: '10000000-0000-4000-8000-000000000001', name: 'Ana Solicitante' },
    created_at: '2026-08-10T12:00:00.000Z',
    updated_at: '2026-08-10T12:00:00.000Z',
    ...overrides,
  }
}
