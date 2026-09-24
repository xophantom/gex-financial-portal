import { z } from 'zod'

export const loginSchema = z.object({
  // Minúsculas: e-mail não diferencia caixa na prática, e o seed já é minúsculo.
  email: z
    .string({ required_error: 'Informe o e-mail', invalid_type_error: 'Informe o e-mail' })
    .trim()
    .toLowerCase()
    .email('E-mail inválido'),
  password: z
    .string({ required_error: 'Informe a senha', invalid_type_error: 'Informe a senha' })
    .min(1, 'Informe a senha'),
})

export const refreshSchema = z.object({
  refresh_token: z
    .string({ required_error: 'Informe o refresh token', invalid_type_error: 'Informe o refresh token' })
    .min(1, 'Informe o refresh token'),
})

export type LoginInput = z.infer<typeof loginSchema>
export type RefreshInput = z.infer<typeof refreshSchema>
