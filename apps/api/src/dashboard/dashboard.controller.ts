import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import type { Viewer } from '../requests/requests.repository';
import { DashboardService } from './dashboard.service';

// Sem @Roles, igual a GET /requests: a rota é do domínio inteiro, não
// FINANCE-only — um solicitante também precisa do próprio resumo. O escopo
// (global vs. só as próprias solicitações) é decidido em SQL dentro do
// repository a partir do papel do viewer, nunca aqui.
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get('summary')
  summary(@CurrentUser() viewer: Viewer) {
    return this.service.summary(viewer);
  }
}
