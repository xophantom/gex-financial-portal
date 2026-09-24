import { redirect } from 'next/navigation'
import { AppNav } from '@/components/app-nav'
import { Toaster } from '@/components/toaster'
import { readSession } from '@/lib/session'

// Defesa em profundidade: proxy.ts já barra /dashboard e /requests sem o
// cookie de acesso (matcher em proxy.ts), mas um Server Component nunca deve
// depender só do roteador para decidir o que renderiza — uma rota nova sob
// (app) que escape do matcher do proxy repetiria, um nível abaixo, o mesmo
// tipo de vazamento que a Tarefa 17 fechou para a sessão inteira.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await readSession()

  if (!session) redirect('/login')

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <AppNav user={session.user} />
      {children}
      {/* Um único Toaster para todo o grupo de rotas autenticadas: a store
          (useUiStore) é o mesmo módulo em qualquer tela, então uma
          confirmação empilhada no detalhe sobrevive a uma navegação
          client-side de volta para a lista. */}
      <Toaster />
    </div>
  )
}
