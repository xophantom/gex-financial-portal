import { createRequestSchema } from '@gex/shared'
import { createZodDto } from 'nestjs-zod'

// Classe só para o Swagger ter o que refletir (tipos z.infer somem em
// runtime); a validação continua no schema de @gex/shared, via
// ZodValidationPipe. Os demais DTOs seguem o mesmo padrão.
export class CreateRequestDto extends createZodDto(createRequestSchema) {}
