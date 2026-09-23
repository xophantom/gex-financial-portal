import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  createRequestSchema,
  decisionSchema,
  listRequestsQuerySchema,
  markPaidSchema,
  type CreateRequestInput,
  type DecisionInput,
  type ListRequestsQuery,
  type MarkPaidInput,
} from '@gex/shared';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
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

  // @Roles('REQUESTER') aqui, ao contrário do list acima: só quem solicita
  // recursos abre uma solicitação — financeiro decide sobre elas, não as cria.
  @Post()
  @Roles('REQUESTER')
  @HttpCode(201)
  create(
    @Body(new ZodValidationPipe(createRequestSchema)) input: CreateRequestInput,
    @CurrentUser() requester: Viewer,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.service.create(input, requester, idempotencyKey);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() viewer: Viewer,
  ) {
    return this.service.findOne(id, viewer);
  }

  // @Roles('FINANCE') aqui e em mark-paid: só financeiro decide sobre uma
  // solicitação alheia — quem a abriu não pode aprovar, rejeitar ou pagar a
  // própria nota. @HttpCode(200): sem isto o Nest usa o default de POST
  // (201 Created), que não faz sentido para uma transição sobre um recurso
  // que já existe.
  @Post(':id/decision')
  @Roles('FINANCE')
  @HttpCode(200)
  decide(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(decisionSchema)) input: DecisionInput,
    @CurrentUser() actor: Viewer,
  ) {
    return this.service.decide(id, input, actor);
  }

  @Post(':id/mark-paid')
  @Roles('FINANCE')
  @HttpCode(200)
  markPaid(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(markPaidSchema)) input: MarkPaidInput,
    @CurrentUser() actor: Viewer,
  ) {
    return this.service.markPaid(id, input, actor);
  }
}
