import { createRequestSchema } from '@gex/shared'
import { NextResponse } from 'next/server'
import { apiFetch } from '@/lib/api-client'
import { errorResponse, parseBody } from '@/lib/bff'

// Ponte BFF: request-form.tsx roda no cliente e não pode importar
// api-client.ts, que lê o cookie httpOnly via next/headers.
export async function POST(request: Request) {
  const body = await parseBody(request, createRequestSchema)
  if (!body.ok) return body.response

  const idempotencyKey = request.headers.get('idempotency-key') ?? undefined

  try {
    const created = await apiFetch('/requests', {
      method: 'POST',
      body: JSON.stringify(body.data),
      headers: idempotencyKey ? { 'idempotency-key': idempotencyKey } : {},
    })

    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}
