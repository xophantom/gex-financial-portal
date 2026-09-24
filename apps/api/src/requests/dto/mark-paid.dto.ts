import { markPaidSchema } from '@gex/shared'
import { createZodDto } from 'nestjs-zod'

export class MarkPaidDto extends createZodDto(markPaidSchema) {}
