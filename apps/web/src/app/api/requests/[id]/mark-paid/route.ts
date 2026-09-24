import { markPaidSchema } from '@gex/shared'
import { NextResponse } from 'next/server'
import { apiFetch } from '@/lib/api/client'
import { errorResponse, parseBody } from '@/lib/api/bff'

// Mesma ponte BFF de app/api/requests/route.ts, para mark-paid-dialog.tsx.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await parseBody(request, markPaidSchema)
  if (!body.ok) return body.response

  try {
    const updated = await apiFetch(`/requests/${id}/mark-paid`, {
      method: 'POST',
      body: JSON.stringify(body.data),
    })

    return NextResponse.json(updated)
  } catch (error) {
    return errorResponse(error)
  }
}
