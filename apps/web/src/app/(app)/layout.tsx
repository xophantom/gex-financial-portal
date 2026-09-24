import { AppNav } from '@/components/layout/app-nav'
import { Toaster } from '@/components/ui/sonner'
import { getSessionUser } from '@/lib/session/user'

// Defesa em profundidade: o proxy (src/proxy.ts) já barra /dashboard e
// /requests sem sessão, e aqui a API confirma quem é o usuário; sem sessão
// válida, getSessionUser leva ao login.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser()

  return (
    <div className="flex min-h-full flex-1 flex-col md:pl-64">
      <AppNav user={user} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8 md:px-10 md:py-12">
        {children}
      </main>
      <Toaster position="bottom-right" />
    </div>
  )
}
