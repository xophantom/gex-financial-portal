import Link from 'next/link'

export default function AppNotFound() {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-16 text-center">
      <h1 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">
        Página não encontrada
      </h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        A solicitação ou página que você procura não existe ou não está disponível para o seu
        perfil.
      </p>
      <Link
        href="/requests"
        className="mt-6 inline-block rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
      >
        Ir para solicitações
      </Link>
    </main>
  )
}
