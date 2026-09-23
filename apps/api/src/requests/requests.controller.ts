import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import {
  createRequestSchema,
  listRequestsQuerySchema,
  type CreateRequestInput,
  type ListRequestsQuery,
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

  // Endpoint mínimo: só o suficiente para a Tarefa 13 provar o evento de
  // abertura na auditoria (o escopo por papel, e o 404 em vez de 403 para
  // quem não é dono, já vêm do findOne() do repositório). allowed_actions e
  // as transições (decision/mark-paid) chegam na Tarefa 14, que volta a
  // mexer aqui.
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() viewer: Viewer) {
    return this.service.findOne(id, viewer);
  }
}
