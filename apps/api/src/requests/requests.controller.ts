import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { JwtGuard } from '../auth/jwt.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

// Stub deliberado: o domínio de solicitações é da Fase 3 (próxima). Esta
// rota existe só para dar à Tarefa 11 uma rota real, protegida por
// @Roles('FINANCE'), que prove a cadeia JwtGuard + RolesGuard funcionando
// sobre HTTP de verdade — sem isso não há como testar via requisição que um
// REQUESTER é barrado de uma rota FINANCE-only (só existiria em memória).
@Controller('requests')
@UseGuards(JwtGuard, RolesGuard)
export class RequestsController {
  @Get()
  @Roles('FINANCE')
  list(@CurrentUser() user: AuthenticatedUser): { requestedBy: string } {
    return { requestedBy: user.id };
  }
}
