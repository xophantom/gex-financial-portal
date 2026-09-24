import { loginSchema } from '@gex/shared'
import { createZodDto } from 'nestjs-zod'

// O DTO carrega o schema de @gex/shared: o pipe global valida com ele e o
// Swagger o documenta.
export class LoginDto extends createZodDto(loginSchema) {}
