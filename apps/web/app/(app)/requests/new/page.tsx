import { RequestForm } from '@/components/request-form'

export default function NewRequestPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">Nova solicitação</h1>
      <div className="mt-6">
        <RequestForm />
      </div>
    </main>
  )
}
