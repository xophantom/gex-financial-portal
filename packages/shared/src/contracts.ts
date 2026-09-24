import { z } from 'zod'
import { isValidCnpj, normalizeCnpj } from './cnpj'
import { parseCompetenceInput } from './competence'
import { REQUEST_STATUSES } from './status'

export const REQUEST_CATEGORIES = [
  'SOFTWARE',
  'SERVIÇOS',
  'MARKETING',
  'INFRAESTRUTURA',
] as const

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

// Regex só valida o formato; datas como 31/02 têm o formato certo mas não
// existem no calendário, e o Postgres rejeitaria isso como erro 500 cru.
const isCalendarDate = (value: string) => {
  const parsed = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

const isoDate = z
  .string({ required_error: 'Informe a data', invalid_type_error: 'Informe a data' })
  .regex(ISO_DATE, 'Use o formato AAAA-MM-DD')
  .refine(isCalendarDate, 'Essa data não existe no calendário')

const positiveInt = (max: number, label: string) =>
  z.coerce
    .number({ invalid_type_error: `${label} deve ser um número` })
    .int(`${label} deve ser um número inteiro`)
    .min(1, `${label} deve ser maior que zero`)
    .max(max, `${label} não pode passar de ${max}`)

export const createRequestSchema = z.object({
  supplier_name: z
    .string({ required_error: 'Informe o fornecedor', invalid_type_error: 'Informe o fornecedor' })
    .trim()
    .min(1, 'Informe o fornecedor')
    .max(200, 'O nome do fornecedor não pode passar de 200 caracteres'),
  supplier_cnpj: z
    .string({ required_error: 'Informe o CNPJ', invalid_type_error: 'Informe o CNPJ' })
    .refine(isValidCnpj, 'CNPJ inválido')
    .transform(normalizeCnpj),
  invoice_number: z
    .string({
      required_error: 'Informe o número da nota',
      invalid_type_error: 'Informe o número da nota',
    })
    .trim()
    .min(1, 'Informe o número da nota')
    .max(60, 'O número da nota não pode passar de 60 caracteres'),
  amount_cents: z
    .number({ required_error: 'Informe o valor', invalid_type_error: 'O valor deve ser um número' })
    .int('O valor deve ser um inteiro em centavos')
    .positive('O valor deve ser maior que zero')
    .max(100_000_000_000, 'O valor não pode passar de R$ 1.000.000.000,00'),
  competence: z
    .string({ required_error: 'Informe a competência', invalid_type_error: 'Informe a competência' })
    .superRefine((value, ctx) => {
      try {
        parseCompetenceInput(value)
      } catch {
        ctx.addIssue({ code: 'custom', message: 'Competência inválida' })
      }
    })
    .transform(parseCompetenceInput),
  due_date: isoDate,
  category: z.enum(REQUEST_CATEGORIES, { message: 'Categoria inválida' }),
  description: z.string().trim().max(1000, 'A descrição não pode passar de 1000 caracteres').optional(),
})

export const listRequestsQuerySchema = z
  .object({
    page: positiveInt(1_000_000, 'A página').default(1),
    page_size: positiveInt(100, 'O tamanho da página').default(20),
    status: z.enum(REQUEST_STATUSES, { message: 'Status inválido' }).optional(),
    supplier: z.string().trim().min(1).max(200).optional(),
    due_from: isoDate.optional(),
    due_to: isoDate.optional(),
  })
  .refine(
    (query) => !query.due_from || !query.due_to || query.due_from <= query.due_to,
    { message: 'O início do período não pode ser posterior ao fim', path: ['due_from'] },
  )

export const decisionSchema = z
  .object({
    decision: z.enum(['APPROVE', 'REJECT'], { message: 'Decisão inválida' }),
    reason: z.string().trim().min(1).max(500).optional(),
  })
  .refine((body) => body.decision !== 'REJECT' || Boolean(body.reason), {
    message: 'Informe o motivo da rejeição',
    path: ['reason'],
  })

export const markPaidSchema = z.object({
  paid_at: z
    .string({
      required_error: 'Informe a data do pagamento',
      invalid_type_error: 'Informe a data do pagamento',
    })
    .regex(
      /^\d{4}-\d{2}-\d{2}(T.+)?$/,
      'Use AAAA-MM-DD ou uma data ISO-8601 completa',
    ),
  payment_reference: z
    .string({
      required_error: 'Informe a referência do pagamento',
      invalid_type_error: 'Informe a referência do pagamento',
    })
    .trim()
    .min(1, 'Informe a referência do pagamento')
    .max(120, 'A referência do pagamento não pode passar de 120 caracteres'),
})

export const loginSchema = z.object({
  email: z
    .string({ required_error: 'Informe o e-mail', invalid_type_error: 'Informe o e-mail' })
    .trim()
    .email('E-mail inválido'),
  password: z
    .string({ required_error: 'Informe a senha', invalid_type_error: 'Informe a senha' })
    .min(1, 'Informe a senha'),
})

export type CreateRequestInput = z.infer<typeof createRequestSchema>
export type ListRequestsQuery = z.infer<typeof listRequestsQuerySchema>
export type DecisionInput = z.infer<typeof decisionSchema>
export type MarkPaidInput = z.infer<typeof markPaidSchema>
export type LoginInput = z.infer<typeof loginSchema>
