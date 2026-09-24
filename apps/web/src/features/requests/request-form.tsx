'use client'

import {
  createRequestSchema,
  REQUEST_CATEGORIES,
  type CreateRequestFormInput,
  type CreateRequestInput,
  type ErrorEnvelope,
} from '@gex/shared'
import { zodResolver } from '@hookform/resolvers/zod'
import { CircleAlert } from 'lucide-react'
import Link from 'next/link'
import { useRef, useState, type ReactNode } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { CnpjInput, CompetenceInput, MoneyInput } from '@/components/ui/masked-inputs'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { categoryLabel } from '@/lib/format/labels'
import { cn } from '@/lib/utils'
import { RequestCreated } from './request-created'

// Estado do formulário = entrada do schema (antes dos transforms); o
// onSubmit recebe a saída já normalizada (CreateRequestInput).
type RequestFormValues = CreateRequestFormInput
type FieldName = keyof RequestFormValues

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

const FIELD_NAMES = new Set<string>([
  'supplier_name',
  'supplier_cnpj',
  'invoice_number',
  'amount_cents',
  'competence',
  'due_date',
  'category',
  'description',
])

const EMPTY_MESSAGE: Partial<Record<FieldName, string>> = {
  supplier_cnpj: 'Informe o CNPJ',
  competence: 'Informe a competência',
  due_date: 'Informe o vencimento',
  category: 'Escolha a categoria',
}

// Os controles do formulário são um pouco mais altos que os das tabelas e
// filtros: é uma tela de digitação, não de consulta.
const CONTROL = 'h-9'

export function RequestForm() {
  // "Cadastrar outra" remonta o formulário: campos limpos e uma
  // Idempotency-Key nova, porque é outra operação.
  const [round, setRound] = useState(0)
  return <RequestFormRound key={round} onRestart={() => setRound((value) => value + 1)} />
}

function RequestFormRound({ onRestart }: { onRestart: () => void }) {
  const [serverError, setServerError] = useState<string | null>(null)
  const [created, setCreated] = useState<{ id: string; values: CreateRequestInput } | null>(null)
  // Uma chave por montagem, não por envio: um reenvio após falha de rede
  // precisa ser reconhecido pela API como a mesma operação.
  const [idempotencyKey] = useState(() => crypto.randomUUID())
  // isSubmitting só desabilita o botão no próximo render; o ref barra um
  // segundo envio que chegue antes disso.
  const inFlight = useRef(false)

  const {
    control,
    register,
    handleSubmit,
    setError,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<RequestFormValues, unknown, CreateRequestInput>({
    resolver: zodResolver(createRequestSchema),
    defaultValues: emptyDefaults,
  })

  // As mensagens do schema descrevem o formato ("Use o formato AAAA-MM-DD");
  // para um campo que ficou vazio, pedir o dado é mais útil.
  const errorFor = (name: FieldName) => {
    const message = errors[name]?.message
    if (!message) return undefined
    const value = getValues(name)
    const isEmpty = value === '' || value === undefined
    return isEmpty && name in EMPTY_MESSAGE ? EMPTY_MESSAGE[name] : message
  }

  // Liga o campo à mensagem de erro (e à dica, se houver) para leitores de tela.
  const fieldProps = (name: FieldName, hint = false) => {
    const describedBy = [hint && `${name}-hint`, errors[name] && `${name}-error`].filter(Boolean)
    return {
      id: name,
      'aria-invalid': errors[name] ? true : undefined,
      'aria-describedby': describedBy.length > 0 ? describedBy.join(' ') : undefined,
    }
  }

  const onSubmit = async (values: CreateRequestInput) => {
    if (inFlight.current) return
    inFlight.current = true
    setServerError(null)

    try {
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
        showServerError(body)
        return
      }

      setCreated({ id: body.id, values })
    } finally {
      inFlight.current = false
    }
  }

  // Erros que pertencem a um campo aparecem nele (nota duplicada, validação
  // do backend); o resto vai para o alerta acima do botão.
  const showServerError = (body: Partial<ErrorEnvelope> | null) => {
    const error = body?.error
    const message =
      error?.message ?? 'A solicitação não foi cadastrada. Tente novamente em instantes.'

    if (error?.code === 'DUPLICATE_INVOICE') {
      setError('invoice_number', { type: 'server', message }, { shouldFocus: true })
      return
    }

    const fieldDetails = (error?.details ?? []).filter((detail) => FIELD_NAMES.has(detail.field))
    if (error?.code === 'VALIDATION_ERROR' && fieldDetails.length > 0) {
      fieldDetails.forEach((detail, index) =>
        setError(
          detail.field as FieldName,
          { type: 'server', message: detail.message },
          { shouldFocus: index === 0 },
        ),
      )
      return
    }

    setServerError(message)
  }

  if (created) {
    return (
      <RequestCreated
        requestId={created.id}
        supplierName={created.values.supplier_name}
        invoiceNumber={created.values.invoice_number}
        amountCents={created.values.amount_cents}
        onCreateAnother={onRestart}
      />
    )
  }

  return (
    <form
      onSubmit={(event) => void handleSubmit(onSubmit)(event)}
      noValidate
      aria-label="Nova solicitação"
      className="@container overflow-hidden rounded-lg border bg-card shadow-xs"
    >
      <div className="divide-y">
        <Section legend="Fornecedor" description="Quem emitiu a nota fiscal.">
          <FormField
            name="supplier_name"
            label="Nome do fornecedor"
            error={errorFor('supplier_name')}
            className="@xl:col-span-4"
          >
            <Input
              className={CONTROL}
              autoComplete="organization"
              {...fieldProps('supplier_name')}
              {...register('supplier_name')}
            />
          </FormField>

          <FormField
            name="supplier_cnpj"
            label="CNPJ"
            error={errorFor('supplier_cnpj')}
            className="@xl:col-span-2"
          >
            <Controller
              name="supplier_cnpj"
              control={control}
              render={({ field }) => (
                <CnpjInput
                  ref={field.ref}
                  className={cn(CONTROL, 'tabular-nums')}
                  placeholder="00.000.000/0000-00"
                  {...fieldProps('supplier_cnpj')}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                />
              )}
            />
          </FormField>
        </Section>

        <Section legend="Nota fiscal" description="Os dados como estão impressos na nota.">
          <FormField
            name="invoice_number"
            label="Número da nota"
            error={errorFor('invoice_number')}
            className="@xl:col-span-3"
          >
            <Input
              className={CONTROL}
              placeholder="Ex.: NF-2026-0042"
              {...fieldProps('invoice_number')}
              {...register('invoice_number')}
            />
          </FormField>

          <FormField
            name="amount_cents"
            label="Valor"
            hint="Digitando, os dois últimos dígitos são os centavos. Colando, o texto é lido em reais."
            error={errorFor('amount_cents')}
            className="@xl:col-span-3"
          >
            <Controller
              name="amount_cents"
              control={control}
              render={({ field }) => (
                <div className="relative">
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground"
                  >
                    R$
                  </span>
                  <MoneyInput
                    ref={field.ref}
                    className={cn(CONTROL, 'pl-9 text-right font-medium tabular-nums')}
                    placeholder="0,00"
                    {...fieldProps('amount_cents', true)}
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                  />
                </div>
              )}
            />
          </FormField>

          <FormField
            name="competence"
            label="Competência"
            hint="Mês a que a despesa se refere."
            error={errorFor('competence')}
            className="@xl:col-span-2"
          >
            <Controller
              name="competence"
              control={control}
              render={({ field }) => (
                <CompetenceInput
                  ref={field.ref}
                  className={cn(CONTROL, 'tabular-nums')}
                  placeholder="MM/AAAA"
                  {...fieldProps('competence', true)}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                />
              )}
            />
          </FormField>

          <FormField
            name="due_date"
            label="Vencimento"
            error={errorFor('due_date')}
            className="@xl:col-span-2"
          >
            <Input
              type="date"
              className={cn(CONTROL, 'tabular-nums')}
              {...fieldProps('due_date')}
              {...register('due_date')}
            />
          </FormField>

          <FormField
            name="category"
            label="Categoria"
            error={errorFor('category')}
            className="@xl:col-span-2"
          >
            <NativeSelect
              defaultValue=""
              className="w-full *:data-[slot=native-select]:h-9"
              {...fieldProps('category')}
              {...register('category')}
            >
              <NativeSelectOption value="" disabled>
                Selecione
              </NativeSelectOption>
              {REQUEST_CATEGORIES.map((category) => (
                <NativeSelectOption key={category} value={category}>
                  {categoryLabel(category)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </FormField>
        </Section>

        <Section
          legend="Descrição"
          description="Opcional. Ajuda o financeiro a entender a despesa."
        >
          <FormField
            name="description"
            label="Descrição"
            labelClassName="sr-only"
            error={errorFor('description')}
            className="@xl:col-span-6"
          >
            <Textarea
              rows={3}
              className="min-h-20"
              placeholder="Ex.: licenças do trimestre para o time de atendimento."
              {...fieldProps('description')}
              {...register('description')}
            />
          </FormField>
        </Section>
      </div>

      <div className="flex flex-col gap-4 border-t bg-muted/60 px-5 py-4 sm:px-8">
        {serverError && (
          <Alert variant="destructive" className="border-rejected/25 bg-rejected-soft">
            <CircleAlert aria-hidden="true" />
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
          <Button asChild variant="ghost" size="lg">
            <Link href="/requests">Cancelar</Link>
          </Button>
          <Button type="submit" size="lg" disabled={isSubmitting}>
            {isSubmitting && <Spinner aria-label="Enviando" />}
            Cadastrar solicitação
          </Button>
        </div>
      </div>
    </form>
  )
}

function Section({
  legend,
  description,
  children,
}: {
  legend: string
  description: string
  children: ReactNode
}) {
  return (
    // O padding fica num invólucro: a <legend> é desenhada sobre a borda do
    // <fieldset> e ignoraria o padding dele.
    <div className="px-5 pt-5 pb-6 sm:px-8 sm:pt-6 sm:pb-7">
      <FieldSet className="gap-0">
        <FieldLegend className="mb-0 font-heading text-lg font-semibold data-[variant=legend]:text-lg">
          {legend}
        </FieldLegend>
        <p className="mt-1 mb-5 text-sm text-muted-foreground">{description}</p>
        <FieldGroup className="grid gap-x-5 gap-y-5 @xl:grid-cols-6">{children}</FieldGroup>
      </FieldSet>
    </div>
  )
}

function FormField({
  name,
  label,
  labelClassName,
  hint,
  error,
  className,
  children,
}: {
  name: FieldName
  label: string
  labelClassName?: string
  hint?: string
  error?: string
  className?: string
  children: ReactNode
}) {
  return (
    <Field data-invalid={error ? true : undefined} className={cn('gap-1.5', className)}>
      <FieldLabel htmlFor={name} className={labelClassName}>
        {label}
      </FieldLabel>
      {children}
      {hint && <FieldDescription id={`${name}-hint`}>{hint}</FieldDescription>}
      {error && <FieldError id={`${name}-error`}>{error}</FieldError>}
    </Field>
  )
}
