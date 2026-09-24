import { NextResponse, type NextRequest } from 'next/server'

// `middleware.ts` foi renomeado para `proxy.ts` no Next 16 (o antigo
// convention ainda funciona, mas o build emite aviso de depreciação — ver
// apps/web/AGENTS.md: "heed deprecation notices"). O nome do cookie é
// duplicado aqui, e não importado de src/lib/session.ts, porque o Proxy usa
// a API de cookies de NextRequest/NextResponse, não next/headers (que só
// existe no contexto de Server Components/Route Handlers).
const ACCESS_COOKIE = 'gex_access'

export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has(ACCESS_COOKIE)

  if (!hasSession) {
    const loginUrl = new URL('/login', request.url)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/requests/:path*'],
}
