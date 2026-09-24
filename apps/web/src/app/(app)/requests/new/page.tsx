import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/layout/page-header'
import { RequestForm } from '@/features/requests/request-form'
import { readSession } from '@/lib/session/server'

export const metadata: Metadata = { title: 'Nova solicitação' }

export default async function NewRequestPage() {
  const session = await readSession()

  // Só REQUESTER cria solicitações; a API também recusa, mas o financeiro
  // nem deveria ver um formulário que não pode enviar.
  if (session?.user.role !== 'REQUESTER') redirect('/requests')

  return (
    <>
      <PageHeader
        title="Nova solicitação"
        description="Cadastre a nota fiscal de um fornecedor para o financeiro aprovar e pagar."
      />
      {/* Largura de leitura: um formulário esticado a 1000px separa demais
          rótulo, campo e botão. */}
      <div className="max-w-3xl">
        <RequestForm />
      </div>
    </>
  )
}
