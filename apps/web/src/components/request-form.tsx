'use client'

import {
  createRequestSchema,
  REQUEST_CATEGORIES,
  type CreateRequestFormInput,
  type CreateRequestInput,
} from '@gex/shared'
import { zodResolver } from '@hookform/resolvers/zod'
import Link from 'next/link'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { CnpjInput, CompetenceInput, MoneyInput } from './masked-inputs'

// Estado do formulário = entrada do schema (antes dos transforms); o
// onSubmit recebe a saída já normalizada (CreateRequestInput).
type RequestFormValues = CreateRequestFormInput

// category fica de fora: '' não é uma categoria válida. O <select> começa em
// "Selecione" via defaultValue e o resolver acusa se nada for escolhido.
const emptyDefaults: Partial<RequestFormValues> = {
  supplier_name: '',
  supplier_cnpj: '',
  invoice_number: '',
  amount_cents: 0,
  competence: '',
  due_date: '',
  description: '',
}

export function RequestForm() {
  const [serverError, setServerError] = useState<string | null>(null)
  const [createdId, setCreatedId] = useState<string | null>(null)
  // Uma chave por montagem, não por envio: um reenvio após falha de rede
  // precisa ser reconhecido pela API como a mesma operação.
  const [idempotencyKey] = useState(() => crypto.randomUUID())

  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RequestFormValues, unknown, CreateRequestInput>({
    resolver: zodResolver(createRequestSchema),
    defaultValues: emptyDefaults,
  })

  // Liga o campo à mensagem de erro para leitores de tela.
  const errorProps = (name: keyof RequestFormValues) =>
    errors[name] ? { 'aria-invalid': true, 'aria-describedby': `${name}-error` } : {}

  const onSubmit = async (values: CreateRequestInput) => {
    setServerError(null)

    let response: Response
    try {
      response = await fetch('/api/requests', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify(values),
      })
    } catch {
      setServerError('Não foi possível falar com o servidor. Tente novamente.')
      return
    }

    // Resposta sem corpo JSON (ex.: 502 do BFF) não pode estourar o submit.
    const body = await response.json().catch(() => null)

    if (!response.ok) {
      setServerError(body?.error?.message ?? 'Erro inesperado')
      return
    }

    setCreatedId(body.id)
  }

  if (createdId) {
    return (
      <div role="status" className="space-y-3 rounded-md border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
        <p>Solicitação registrada com sucesso.</p>
        <Link href={`/requests/${createdId}`} className="font-medium underline">
          Ver detalhes da solicitação
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      {serverError && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {serverError}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="supplier_name" label="Fornecedor" error={errors.supplier_name?.message}>
          <input
            id="supplier_name"
            className={inputClass}
            {...errorProps('supplier_name')}
            {...register('supplier_name')}
          />
        </Field>

        <Field id="supplier_cnpj" label="CNPJ" error={errors.supplier_cnpj?.message}>
          <Controller
            name="supplier_cnpj"
            control={control}
            render={({ field }) => (
              <CnpjInput
                id="supplier_cnpj"
                className={inputClass}
                {...errorProps('supplier_cnpj')}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
              />
            )}
          />
        </Field>

        <Field id="invoice_number" label="Número da nota" error={errors.invoice_number?.message}>
          <input
            id="invoice_number"
            className={inputClass}
            {...errorProps('invoice_number')}
            {...register('invoice_number')}
          />
        </Field>

        <Field id="amount_cents" label="Valor" error={errors.amount_cents?.message}>
          <Controller
            name="amount_cents"
            control={control}
            render={({ field }) => (
              <MoneyInput
                id="amount_cents"
                className={inputClass}
                {...errorProps('amount_cents')}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
              />
            )}
          />
        </Field>

        <Field id="competence" label="Competência" error={errors.competence?.message}>
          <Controller
            name="competence"
            control={control}
            render={({ field }) => (
              <CompetenceInput
                id="competence"
                className={inputClass}
                {...errorProps('competence')}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                placeholder="MM/AAAA"
              />
            )}
          />
        </Field>

        <Field id="due_date" label="Vencimento" error={errors.due_date?.message}>
          <input
            id="due_date"
            type="date"
            className={inputClass}
            {...errorProps('due_date')}
            {...register('due_date')}
          />
        </Field>

        <Field id="category" label="Categoria" error={errors.category?.message}>
          <select
            id="category"
            defaultValue=""
            className={inputClass}
            {...errorProps('category')}
            {...register('category')}
          >
            <option value="" disabled>
              Selecione
            </option>
            {REQUEST_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field id="description" label="Descrição (opcional)" error={errors.description?.message}>
        <textarea
            id="description"
            rows={3}
            className={inputClass}
            {...errorProps('description')}
            {...register('description')}
          />
      </Field>

      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
      >
        Cadastrar solicitação
      </button>
    </form>
  )
}

const inputClass =
  'w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950'

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
        {label}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} className="text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  )
}
