import { listRequestsQuerySchema } from '@gex/shared'
import { createZodDto } from 'nestjs-zod'

export class ListRequestsQueryDto extends createZodDto(listRequestsQuerySchema) {}
