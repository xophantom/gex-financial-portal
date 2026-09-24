import { LoginForm } from '@/components/login-form'

export default function LoginPage() {
  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 dark:bg-black">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
            Portal de Solicitações Financeiras
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Entre com suas credenciais para continuar
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  )
}
