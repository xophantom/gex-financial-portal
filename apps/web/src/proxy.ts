import type { NextRequest } from 'next/server'
import { guardSession } from '@/lib/session/guard'

// `middleware.ts` foi renomeado para `proxy.ts` no Next 16 e, com `src/app`,
// precisa morar em `src/`, ao lado de `app/`. A lógica fica em
// lib/session/guard.ts, que não importa next/headers (só existe em Server
// Components e Route Handlers).
export function proxy(request: NextRequest) {
  return guardSession(request)
}

export const config = {
  matcher: ['/', '/dashboard/:path*', '/requests/:path*'],
}
