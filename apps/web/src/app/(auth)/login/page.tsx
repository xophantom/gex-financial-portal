import type { Metadata } from 'next'
import { LoginForm } from '@/features/auth/login-form'

export const metadata: Metadata = { title: 'Entrar' }

export default function LoginPage() {
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
