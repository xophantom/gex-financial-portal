import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { LoginForm } from '@/features/auth/login-form'
import { findSessionUser } from '@/lib/session/user'

export const metadata: Metadata = { title: 'Entrar' }

// Quem já tem sessão válida vai direto para a visão geral.
export default async function LoginPage() {
  if (await findSessionUser()) redirect('/dashboard')

  return (
    <>
      <header className="mb-8 space-y-1.5">
        <h1 className="text-3xl font-semibold">Entrar</h1>
        <p className="text-sm text-muted-foreground">
          Use o e-mail e a senha da sua conta no portal.
        </p>
      </header>
      <LoginForm />
    </>
  )
}
