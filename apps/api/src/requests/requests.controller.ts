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
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import {
  createRequestSchema,
  decisionSchema,
  listRequestsQuerySchema,
  markPaidSchema,
} from '@gex/shared';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import {
  CreateRequestDto,
  DecisionDto,
  ListRequestsQueryDto,
  MarkPaidDto,
} from './dto';
import type { Viewer } from './requests.repository';
import { RequestsService } from './requests.service';

// Sem @Roles aqui de propósito: GET /requests é do domínio inteiro, não
// FINANCE-only — o enunciado exige que um solicitante liste as próprias
// solicitações. O escopo (tudo vs. só as próprias) é decidido no where() do
// repositório a partir do papel do viewer, não recusando a rota. JwtGuard e
// RolesGuard continuam cobrindo isto via APP_GUARD global; sem @Roles, o
// RolesGuard deixa passar qualquer usuário autenticado, que é exatamente o
// que se quer aqui.
//
// @ApiBearerAuth() (fix round 1, doc fix): sem isto o documento registra o
// esquema "bearer" (DocumentBuilder().addBearerAuth() em configure-app.ts)
// mas não marca nenhum endpoint como exigindo-o — o cadeado no Swagger UI
// só aparece nas rotas que carregam este decorator.
@ApiTags('requests')
@ApiBearerAuth()
@Controller('requests')
export class RequestsController {
  constructor(private readonly service: RequestsService) {}

  // @ApiOperation description (fix round 1, doc fix): listRequestsQuerySchema
  // tem uma regra entre campos (due_from <= due_to, via .refine() no schema
  // do objeto inteiro) que o Swagger não tem onde pendurar — parâmetros de
  // query são documentados um a um, então uma description no nível do
  // objeto Zod não sobrevive ao achatamento em `parameters[]`. Só esta nota
  // operação-a-operação torna a regra visível para quem lê o /docs.
  //
  // @ApiQuery() em due_from/due_to: tentei carregar a description via
  // `.describe()` no próprio schema Zod primeiro (isoDate.optional()
  // .describe(...)) — funciona para devolver `due_date` (usado direto,
  // sem .optional(), num body DTO), mas confirmei gerando o doc de verdade
  // que nestjs-zod não propaga a description por este caminho específico
  // (ZodOptional envolvendo o ZodEffects do .refine(isCalendarDate) num
  // parâmetro de query, não num body). Isto aqui é a saída explícita para
  // fechar a lacuna, não uma segunda definição da validação — devo
  // permanecer text-only, a regra de calendário continua vivendo só no
  // isoDate.refine() do schema.
  @Get()
  @ApiOperation({
    description:
      'due_from não pode ser posterior a due_to, quando os dois forem informados.',
  })
  @ApiQuery({
    name: 'due_from',
    required: false,
    description:
      'Data no formato AAAA-MM-DD; precisa ser uma data real do calendário',
  })
  @ApiQuery({
    name: 'due_to',
    required: false,
    description:
      'Data no formato AAAA-MM-DD; precisa ser uma data real do calendário',
  })
  list(
    @Query(new ZodValidationPipe(listRequestsQuerySchema))
    query: ListRequestsQueryDto,
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
    @Body(new ZodValidationPipe(createRequestSchema)) input: CreateRequestDto,
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
    @Body(new ZodValidationPipe(decisionSchema)) input: DecisionDto,
    @CurrentUser() actor: Viewer,
  ) {
    return this.service.decide(id, input, actor);
  }

  @Post(':id/mark-paid')
  @Roles('FINANCE')
  @HttpCode(200)
  markPaid(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(markPaidSchema)) input: MarkPaidDto,
    @CurrentUser() actor: Viewer,
  ) {
    return this.service.markPaid(id, input, actor);
  }
}
