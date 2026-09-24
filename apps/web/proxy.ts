import type { NextRequest } from 'next/server'
import { guardSession } from '@/lib/session-proxy'

// `middleware.ts` foi renomeado para `proxy.ts` no Next 16. A lógica mora em
// src/lib/session-proxy.ts, que não importa next/headers (só existe em
// Server Components e Route Handlers).
export function proxy(request: NextRequest) {
  return guardSession(request)
}

export const config = {
  matcher: ['/', '/dashboard/:path*', '/requests/:path*'],
}
