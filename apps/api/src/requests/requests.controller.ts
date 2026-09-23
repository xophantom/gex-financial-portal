import { Controller, Get, Query } from '@nestjs/common';
import { listRequestsQuerySchema, type ListRequestsQuery } from '@gex/shared';
import { CurrentUser } from '../auth/current-user.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import type { Viewer } from './requests.repository';
import { RequestsService } from './requests.service';

// Sem @Roles aqui de propósito: GET /requests é do domínio inteiro, não
// FINANCE-only — o enunciado exige que um solicitante liste as próprias
// solicitações. O escopo (tudo vs. só as próprias) é decidido no where() do
// repositório a partir do papel do viewer, não recusando a rota. JwtGuard e
// RolesGuard continuam cobrindo isto via APP_GUARD global; sem @Roles, o
// RolesGuard deixa passar qualquer usuário autenticado, que é exatamente o
// que se quer aqui.
@Controller('requests')
export class RequestsController {
  constructor(private readonly service: RequestsService) {}

  @Get()
  list(
    @Query(new ZodValidationPipe(listRequestsQuerySchema))
    query: ListRequestsQuery,
    @CurrentUser() viewer: Viewer,
  ) {
    return this.service.list(query, viewer);
  }
}
