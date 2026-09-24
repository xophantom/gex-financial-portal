import { createZodValidationPipe } from 'nestjs-zod'

// Registrado como APP_PIPE: valida todo parâmetro tipado com um DTO de
// createZodDto usando o schema de @gex/shared que o DTO carrega. O ZodError
// sobe como veio, e o filtro global o traduz em 422 com detalhes por campo.
export const ZodValidationPipe = createZodValidationPipe({
  createValidationException: (error) => error as Error,
})
