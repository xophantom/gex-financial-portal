// Os testes automatizados (apps/api/test/*.e2e-spec.ts) já provam as duas
// garantias abaixo. Este script existe porque uma garantia de concorrência
// lida num arquivo de teste convence menos que a mesma garantia rodando no
// terminal de quem avalia, contra o stack de verdade subido pelo Compose.

const API = process.env.API_URL ?? 'http://localhost:3001'
const ATTEMPTS = 8

const login = async (email: string, password: string): Promise<string> => {
  const response = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })

  if (!response.ok) {
    throw new Error(`login failed for ${email}: ${response.status}`)
  }

  const body = (await response.json()) as { access_token: string }
  return body.access_token
}

const tally = (statuses: number[]): Record<number, number> =>
  statuses.reduce<Record<number, number>>((acc, status) => {
    acc[status] = (acc[status] ?? 0) + 1
    return acc
  }, {})

async function duplicateCreation(token: string): Promise<string> {
  const payload = {
    supplier_name: 'Corrida Simultânea',
    supplier_cnpj: '10000000000145',
    invoice_number: `NF-RACE-${Date.now()}`,
    amount_cents: 155313,
    competence: '2026-09',
    due_date: '2026-09-30',
    category: 'SOFTWARE',
  }

  const results = await Promise.all(
    Array.from({ length: ATTEMPTS }, () =>
      fetch(`${API}/requests`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      }),
    ),
  )

  console.log(`\n${ATTEMPTS} criações simultâneas da mesma nota`)
  console.log('  respostas:', tally(results.map((r) => r.status)))
  console.log(`  esperado: 1× 201, ${ATTEMPTS - 1}× 409 — o índice único no banco arbitra`)

  return payload.invoice_number
}

async function duplicateApproval(financeToken: string, requestId: string): Promise<void> {
  const results = await Promise.all(
    Array.from({ length: ATTEMPTS }, () =>
      fetch(`${API}/requests/${requestId}/decision`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${financeToken}` },
        body: JSON.stringify({ decision: 'APPROVE' }),
      }),
    ),
  )

  const detail = (await fetch(`${API}/requests/${requestId}`, {
    headers: { authorization: `Bearer ${financeToken}` },
  }).then((r) => r.json())) as { history: { new_status: string }[] }

  const approvals = detail.history.filter((event) => event.new_status === 'APPROVED')

  console.log(`\n${ATTEMPTS} aprovações simultâneas da mesma solicitação`)
  console.log('  respostas:', tally(results.map((r) => r.status)))
  console.log('  eventos APPROVED gravados:', approvals.length)
  console.log(`  esperado: 1× 200, ${ATTEMPTS - 1}× 409, 1 evento — SELECT FOR UPDATE serializa`)
}

async function main(): Promise<void> {
  const requester = await login('solicitante@gex.test', 'GexRequester123!')
  const finance = await login('financeiro@gex.test', 'GexFinance123!')

  const invoice = await duplicateCreation(requester)

  const list = (await fetch(`${API}/requests?status=PENDING&page_size=100`, {
    headers: { authorization: `Bearer ${finance}` },
  }).then((r) => r.json())) as { data: { id: string; invoice_number: string }[] }

  const created = list.data.find((row) => row.invoice_number === invoice)
  if (!created) {
    throw new Error(
      `could not find the request created with invoice ${invoice} in the PENDING list`,
    )
  }

  await duplicateApproval(finance, created.id)

  console.log(
    '\nA demo gravou uma solicitação aprovada de R$ 1.553,13: os totais do dashboard mudaram.' +
      '\nPara voltar ao seed: docker compose down -v && docker compose up --build',
  )
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
