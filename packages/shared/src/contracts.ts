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
const isoDate = z.string().regex(ISO_DATE, 'Use o formato AAAA-MM-DD')

const positiveInt = (max: number, label: string) =>
  z.coerce
    .number()
    .int(`${label} deve ser um número inteiro`)
    .min(1, `${label} deve ser maior que zero`)
    .max(max, `${label} não pode passar de ${max}`)

export const createRequestSchema = z.object({
  supplier_name: z.string().trim().min(1, 'Informe o fornecedor').max(200),
  supplier_cnpj: z
    .string()
    .refine(isValidCnpj, 'CNPJ inválido')
    .transform(normalizeCnpj),
  invoice_number: z.string().trim().min(1, 'Informe o número da nota').max(60),
  amount_cents: z
    .number()
    .int('O valor deve ser um inteiro em centavos')
    .positive('O valor deve ser maior que zero'),
  competence: z
    .string()
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
  description: z.string().trim().max(1000).optional(),
})

export const listRequestsQuerySchema = z
  .object({
    page: positiveInt(1_000_000, 'A página').default(1),
    page_size: positiveInt(100, 'O tamanho da página').default(20),
    status: z.enum(REQUEST_STATUSES).optional(),
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
    decision: z.enum(['APPROVE', 'REJECT']),
    reason: z.string().trim().min(1).max(500).optional(),
  })
  .refine((body) => body.decision !== 'REJECT' || Boolean(body.reason), {
    message: 'Informe o motivo da rejeição',
    path: ['reason'],
  })

export const markPaidSchema = z.object({
  paid_at: z
    .string()
    .regex(
      /^\d{4}-\d{2}-\d{2}(T.+)?$/,
      'Use AAAA-MM-DD ou uma data ISO-8601 completa',
    ),
  payment_reference: z.string().trim().min(1, 'Informe a referência do pagamento').max(120),
})

export const loginSchema = z.object({
  email: z.string().trim().email('E-mail inválido'),
  password: z.string().min(1, 'Informe a senha'),
})

export type CreateRequestInput = z.infer<typeof createRequestSchema>
export type ListRequestsQuery = z.infer<typeof listRequestsQuerySchema>
export type DecisionInput = z.infer<typeof decisionSchema>
export type MarkPaidInput = z.infer<typeof markPaidSchema>
export type LoginInput = z.infer<typeof loginSchema>
