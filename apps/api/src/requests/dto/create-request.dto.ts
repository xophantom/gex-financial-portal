import { createRequestSchema } from '@gex/shared'
import { createZodDto } from 'nestjs-zod'

// O DTO carrega o schema de @gex/shared: o pipe global valida com ele e o
// Swagger o documenta. Os demais DTOs seguem o mesmo padrão.
export class CreateRequestDto extends createZodDto(createRequestSchema) {}
