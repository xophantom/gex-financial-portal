import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { Roles } from '../auth/roles.decorator';

// Stub deliberado: o domínio de solicitações é da Fase 3 (próxima). Esta
// rota existe só para dar à Tarefa 11 uma rota real, protegida por
// @Roles('FINANCE'), que prove a cadeia JwtGuard + RolesGuard funcionando
// sobre HTTP de verdade — sem isso não há como testar via requisição que um
// REQUESTER é barrado de uma rota FINANCE-only (só existiria em memória).
//
// Sem @UseGuards aqui de propósito (fix round 2): JwtGuard e RolesGuard são
// APP_GUARD globais agora — default-nega — então este controller já nasce
// protegido sem precisar lembrar de anotar nada além do @Roles.
@Controller('requests')
export class RequestsController {
  @Get()
  @Roles('FINANCE')
  list(@CurrentUser() user: AuthenticatedUser): { requestedBy: string } {
    return { requestedBy: user.id };
  }
}
