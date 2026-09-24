import { redirect } from 'next/navigation'
import { AppNav } from '@/components/layout/app-nav'
import { Toaster } from '@/components/ui/sonner'
import { readSession } from '@/lib/session/server'

// Defesa em profundidade: o proxy (src/proxy.ts) já barra /dashboard e
// /requests sem sessão, mas um Server Component não deve depender só do
// matcher do proxy para decidir o que renderiza.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await readSession()

  if (!session) redirect('/login')

  return (
    <div className="flex min-h-full flex-1 flex-col md:pl-64">
      <AppNav user={session.user} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8 md:px-10 md:py-12">
        {children}
      </main>
      <Toaster position="bottom-right" />
    </div>
  )
}
