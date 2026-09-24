import { decisionSchema } from '@gex/shared'
import { createZodDto } from 'nestjs-zod'

export class DecisionDto extends createZodDto(decisionSchema) {}
