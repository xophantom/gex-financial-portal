import {
  createRequestSchema,
  decisionSchema,
  listRequestsQuerySchema,
  markPaidSchema,
} from '@gex/shared';
import { createZodDto } from 'nestjs-zod';

// createZodDto só embrulha o schema Zod que já valida a entrada (via
// ZodValidationPipe, inalterado abaixo) para dar ao Nest/Swagger uma classe
// real para refletir — não redefine nenhuma regra. A classe existe porque
// tipos TS puros (z.infer) somem em tempo de execução (design:paramtypes
// vira `Object`), e sem um construtor real o Swagger não tem o que
// introspeccionar.
export class CreateRequestDto extends createZodDto(createRequestSchema) {}
export class ListRequestsQueryDto extends createZodDto(
  listRequestsQuerySchema,
) {}
export class DecisionDto extends createZodDto(decisionSchema) {}
export class MarkPaidDto extends createZodDto(markPaidSchema) {}
