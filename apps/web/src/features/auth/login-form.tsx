'use client'

import { loginSchema, type LoginInput } from '@gex/shared'
import { zodResolver } from '@hookform/resolvers/zod'
import { CircleAlert } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'

interface ServerError {
  title: string
  hint?: string
}

export function LoginForm() {
  const router = useRouter()
  const [serverError, setServerError] = useState<ServerError | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) })

  const onSubmit = async (values: LoginInput) => {
    setServerError(null)

    let response: Response
    try {
      response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(values),
      })
    } catch {
      setServerError({
        title: 'Não foi possível falar com o servidor.',
        hint: 'Verifique sua conexão e tente novamente.',
      })
      return
    }

    // Resposta sem corpo JSON (ex.: 502 do BFF) não pode estourar o submit.
    const body = await response.json().catch(() => null)

    if (!response.ok) {
      setServerError({
        title: body?.error?.message ?? 'Erro inesperado',
        hint: response.status === 401 ? 'Confira os dados digitados e tente de novo.' : undefined,
      })
      return
    }

    router.push('/dashboard')
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        {serverError && (
          <Alert
            variant="destructive"
            className="border-destructive/30 bg-rejected-soft px-3 py-2.5"
          >
            <CircleAlert />
            <AlertTitle>{serverError.title}</AlertTitle>
            {serverError.hint && <AlertDescription>{serverError.hint}</AlertDescription>}
          </Alert>
        )}

        <Field data-invalid={errors.email ? true : undefined}>
          <FieldLabel htmlFor="email">E-mail</FieldLabel>
          <Input
            id="email"
            type="email"
            autoComplete="username"
            placeholder="nome@empresa.com.br"
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={errors.email ? 'email-error' : undefined}
            className="h-10 bg-card"
            {...register('email')}
          />
          <FieldError id="email-error" errors={[errors.email]} />
        </Field>

        <Field data-invalid={errors.password ? true : undefined}>
          <FieldLabel htmlFor="password">Senha</FieldLabel>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            aria-invalid={errors.password ? true : undefined}
            aria-describedby={errors.password ? 'password-error' : undefined}
            className="h-10 bg-card"
            {...register('password')}
          />
          <FieldError id="password-error" errors={[errors.password]} />
        </Field>

        <Button type="submit" size="lg" disabled={isSubmitting} className="mt-1 h-10 w-full">
          {isSubmitting && <Spinner aria-hidden="true" />}
          {isSubmitting ? 'Entrando…' : 'Entrar'}
        </Button>
      </FieldGroup>
    </form>
  )
}
