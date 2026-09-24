import { z } from 'zod'
import { isValidCnpj, normalizeCnpj } from '../domain/cnpj.js'
import { parseCompetenceInput } from '../domain/competence.js'
import { REQUEST_STATUSES } from '../domain/status.js'
import { isCalendarDate } from '../domain/date.js'
import { jsonBody } from './body.js'

export const REQUEST_CATEGORIES = ['SOFTWARE', 'SERVIÇOS', 'MARKETING', 'INFRAESTRUTURA'] as const
export type RequestCategory = (typeof REQUEST_CATEGORIES)[number]

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

// 0001-01-01 existe no calendário, mas não num boleto: vencimento e
// competência ficam numa faixa plausível.
const FIRST_YEAR = 2000
const LAST_YEAR = 2100
const YEAR_RANGE_MESSAGE = `Use um ano entre ${FIRST_YEAR} e ${LAST_YEAR}`
const inYearRange = (isoValue: string) => {
  const year = Number(isoValue.slice(0, 4))
  return year >= FIRST_YEAR && year <= LAST_YEAR
}

// Exportados para os campos da interface limitarem a digitação igual à API.
export const DECISION_REASON_MAX_LENGTH = 500
export const PAYMENT_REFERENCE_MAX_LENGTH = 120

// Os .refine() só opinam sobre o que já está no formato, para um valor
// malformado gerar um único erro. O .describe() existe porque o OpenAPI não
// tem como expressar a checagem de calendário.
const isoDateField = (requiredMessage: string, { yearRange = false } = {}) =>
  z
    .string({ required_error: requiredMessage, invalid_type_error: requiredMessage })
    .regex(ISO_DATE, 'Use o formato AAAA-MM-DD')
    .refine(
      (value) => !ISO_DATE.test(value) || isCalendarDate(value),
      'Essa data não existe no calendário',
    )
    .refine(
      (value) =>
        !yearRange || !ISO_DATE.test(value) || !isCalendarDate(value) || inYearRange(value),
      YEAR_RANGE_MESSAGE,
    )
    .describe(
      'Data no formato AAAA-MM-DD; precisa ser uma data real do calendário (ex.: 30/02 é rejeitado)',
    )

const isoDate = isoDateField('Informe a data')

const positiveInt = (max: number, label: string) =>
  z.coerce
    .number({ invalid_type_error: `${label} deve ser um número` })
    .int(`${label} deve ser um número inteiro`)
    .min(1, `${label} deve ser maior que zero`)
    .max(max, `${label} não pode passar de ${max}`)

export const createRequestSchema = z.object(
  {
    supplier_name: z
      .string({
        required_error: 'Informe o fornecedor',
        invalid_type_error: 'Informe o fornecedor',
      })
      .trim()
      .min(1, 'Informe o fornecedor')
      .max(200, 'O nome do fornecedor não pode passar de 200 caracteres'),
    // O OpenAPI descarta o predicado do .refine(); a descrição é o que avisa
    // que os dígitos verificadores são conferidos.
    supplier_cnpj: z
      .string({ required_error: 'Informe o CNPJ', invalid_type_error: 'Informe o CNPJ' })
      .refine(isValidCnpj, 'CNPJ inválido')
      .transform(normalizeCnpj)
      .describe(
        'CNPJ do fornecedor, com ou sem máscara; os dígitos verificadores são validados no backend',
      ),
    // Caixa e espaços normalizados para que "nf-1" e "NF-1" colidam no índice
    // único (CNPJ, nota) em vez de virarem duas notas.
    invoice_number: z
      .string({
        required_error: 'Informe o número da nota',
        invalid_type_error: 'Informe o número da nota',
      })
      .trim()
      .toUpperCase()
      .min(1, 'Informe o número da nota')
      .max(60, 'O número da nota não pode passar de 60 caracteres')
      .transform((value) => value.replace(/\s+/g, ' ')),
    amount_cents: z
      .number({
        required_error: 'Informe o valor',
        invalid_type_error: 'O valor deve ser um número',
      })
      .int('O valor deve ser um inteiro em centavos')
      .positive('O valor deve ser maior que zero')
      .max(100_000_000_000, 'O valor não pode passar de R$ 1.000.000.000,00'),
    competence: z
      .string({
        required_error: 'Informe a competência',
        invalid_type_error: 'Informe a competência',
      })
      .superRefine((value, ctx) => {
        let parsed: string
        try {
          parsed = parseCompetenceInput(value)
        } catch {
          ctx.addIssue({ code: 'custom', message: 'Competência inválida' })
          return
        }
        if (!inYearRange(parsed)) ctx.addIssue({ code: 'custom', message: YEAR_RANGE_MESSAGE })
      })
      .transform(parseCompetenceInput)
      .describe('Competência no formato MM/AAAA (ex.: 03/2026) ou AAAA-MM'),
    due_date: isoDateField('Informe o vencimento', { yearRange: true }),
    category: z.enum(REQUEST_CATEGORIES, { message: 'Categoria inválida' }),
    // Vazia vira ausente: "sem descrição" é sempre NULL no banco, nunca "".
    description: z
      .string({ invalid_type_error: 'A descrição deve ser um texto' })
      .trim()
      .max(1000, 'A descrição não pode passar de 1000 caracteres')
      .optional()
      .transform((value) => value || undefined),
  },
  jsonBody,
)

export const listRequestsQuerySchema = z
  .object({
    page: positiveInt(1_000_000, 'A página').default(1),
    page_size: positiveInt(100, 'O tamanho da página').default(20),
    status: z.enum(REQUEST_STATUSES, { message: 'Status inválido' }).optional(),
    // Busca vazia é "sem filtro", não erro. Repetir o parâmetro vira lista.
    supplier: z
      .string({ invalid_type_error: 'Informe um único fornecedor na busca' })
      .trim()
      .max(200, 'A busca pelo fornecedor não pode passar de 200 caracteres')
      .optional()
      .transform((value) => value || undefined),
    // .optional() cria um nó novo que não herda a descrição do isoDate.
    due_from: isoDate.optional().describe(isoDate.description ?? ''),
    due_to: isoDate.optional().describe(isoDate.description ?? ''),
  })
  .refine((query) => !query.due_from || !query.due_to || query.due_from <= query.due_to, {
    message: 'O início do período não pode ser posterior ao fim',
    path: ['due_from'],
  })
  // Regras entre campos não aparecem no JSON Schema; a descrição as documenta.
  .describe('due_from não pode ser posterior a due_to, quando os dois forem informados')

export const decisionSchema = z
  .object(
    {
      decision: z.enum(['APPROVE', 'REJECT'], { message: 'Decisão inválida' }),
      // Obrigatório na rejeição (refine abaixo). Na aprovação é opcional e,
      // quando vem, fica como observação no histórico.
      reason: z
        .string({ invalid_type_error: 'O motivo deve ser um texto' })
        .trim()
        .max(
          DECISION_REASON_MAX_LENGTH,
          `O motivo não pode passar de ${DECISION_REASON_MAX_LENGTH} caracteres`,
        )
        .optional()
        .transform((value) => value || undefined),
    },
    jsonBody,
  )
  .refine((body) => body.decision !== 'REJECT' || Boolean(body.reason), {
    message: 'Informe o motivo da rejeição',
    path: ['reason'],
  })
  .describe('reason é obrigatório quando decision é REJECT e opcional quando é APPROVE')

export const markPaidSchema = z.object(
  {
    // Só a data: a hora do pagamento não é informação de negócio, e aceitar um
    // timestamp faria "hoje" depender do fuso de quem envia.
    paid_at: isoDateField('Informe a data do pagamento'),
    payment_reference: z
      .string({
        required_error: 'Informe a referência do pagamento',
        invalid_type_error: 'Informe a referência do pagamento',
      })
      .trim()
      .min(1, 'Informe a referência do pagamento')
      .max(
        PAYMENT_REFERENCE_MAX_LENGTH,
        `A referência do pagamento não pode passar de ${PAYMENT_REFERENCE_MAX_LENGTH} caracteres`,
      ),
  },
  jsonBody,
)

export type CreateRequestInput = z.infer<typeof createRequestSchema>
// Entrada do formulário, antes dos transforms (CNPJ mascarado, MM/AAAA).
export type CreateRequestFormInput = z.input<typeof createRequestSchema>
export type ListRequestsQuery = z.infer<typeof listRequestsQuerySchema>
export type DecisionInput = z.infer<typeof decisionSchema>
export type MarkPaidInput = z.infer<typeof markPaidSchema>
