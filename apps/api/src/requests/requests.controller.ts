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
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger'
import type { AuthenticatedUser } from '../auth/authenticated-user'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { Roles } from '../auth/decorators/roles.decorator'
import { CreateRequestDto } from './dto/create-request.dto'
import { DecisionDto } from './dto/decision.dto'
import { ListRequestsQueryDto } from './dto/list-requests-query.dto'
import { MarkPaidDto } from './dto/mark-paid.dto'
import { RequestsService } from './requests.service'

// Sem @Roles na classe: os dois papéis usam as rotas de leitura, e o escopo
// (tudo ou só as próprias) é decidido no repositório. @ApiBearerAuth() põe o
// cadeado no Swagger; a exigência real é do guard global.
@ApiTags('requests')
@ApiBearerAuth()
@Controller('requests')
export class RequestsController {
  constructor(private readonly service: RequestsService) {}

  // Só documentação: a regra entre campos e a descrição das datas não
  // sobrevivem ao achatamento dos parâmetros de query pelo nestjs-zod. A
  // validação continua sendo o schema Zod.
  @Get()
  @ApiOperation({
    description: 'due_from não pode ser posterior a due_to, quando os dois forem informados.',
  })
  @ApiQuery({
    name: 'due_from',
    required: false,
    description: 'Data no formato AAAA-MM-DD; precisa ser uma data real do calendário',
  })
  @ApiQuery({
    name: 'due_to',
    required: false,
    description: 'Data no formato AAAA-MM-DD; precisa ser uma data real do calendário',
  })
  list(@Query() query: ListRequestsQueryDto, @CurrentUser() viewer: AuthenticatedUser) {
    return this.service.list(query, viewer)
  }

  // @Roles('REQUESTER') aqui, ao contrário do list acima: só quem solicita
  // recursos abre uma solicitação — financeiro decide sobre elas, não as cria.
  @Post()
  @Roles('REQUESTER')
  @HttpCode(201)
  create(
    @Body() input: CreateRequestDto,
    @CurrentUser() requester: AuthenticatedUser,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.service.create(input, requester, idempotencyKey)
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() viewer: AuthenticatedUser) {
    return this.service.findOne(id, viewer)
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
    @Body() input: DecisionDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.service.decide(id, input, actor)
  }

  @Post(':id/mark-paid')
  @Roles('FINANCE')
  @HttpCode(200)
  markPaid(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: MarkPaidDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.service.markPaid(id, input, actor)
  }
}
