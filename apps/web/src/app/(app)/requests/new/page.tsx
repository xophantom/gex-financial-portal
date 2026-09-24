import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { RequestForm } from '@/features/requests/request-form'
import { readSession } from '@/lib/session/server'

export const metadata: Metadata = { title: 'Nova solicitação' }

export default async function NewRequestPage() {
  const session = await readSession()

  // Só REQUESTER cria solicitações; a API também recusa, mas o financeiro
  // nem deveria ver um formulário que não pode enviar.
  if (session?.user.role !== 'REQUESTER') redirect('/requests')

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-8">
      <h1 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">Nova solicitação</h1>
      <div className="mt-6">
        <RequestForm />
      </div>
    </main>
  )
}
