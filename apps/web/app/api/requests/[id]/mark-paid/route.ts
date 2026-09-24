import { markPaidSchema } from '@gex/shared'
import { NextResponse } from 'next/server'
import { ApiError, apiFetch } from '@/lib/api-client'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const raw = await request.json().catch(() => null)
  const parsed = markPaidSchema.safeParse(raw)

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos',
          details: parsed.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          })),
        },
      },
      { status: 422 },
    )
  }

  try {
    const updated = await apiFetch(`/requests/${id}/mark-paid`, {
      method: 'POST',
      body: JSON.stringify(parsed.data),
    })

    return NextResponse.json(updated)
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: error.status },
      )
    }

    return NextResponse.json(
      {
        error: {
          code: 'UPSTREAM_UNAVAILABLE',
          message: 'Não foi possível conversar com o servidor. Tente novamente em instantes.',
        },
      },
      { status: 502 },
    )
  }
}
