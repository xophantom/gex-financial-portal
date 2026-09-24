import { redirect } from 'next/navigation'
import { AppNav } from '@/components/layout/app-nav'
import { Toaster } from '@/components/ui/toaster'
import { readSession } from '@/lib/session/server'

// Defesa em profundidade: o proxy (src/proxy.ts) já barra /dashboard e
// /requests sem sessão, mas um Server Component não deve depender só do
// matcher do proxy para decidir o que renderiza — uma rota nova sob (app)
// que escape dele continuaria protegida aqui.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await readSession()

  if (!session) redirect('/login')

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <AppNav user={session.user} />
      {children}
      {/* Um único Toaster para todo o grupo de rotas autenticadas: uma
          confirmação empilhada no detalhe sobrevive a uma navegação
          client-side de volta para a lista. */}
      <Toaster />
    </div>
  )
}
