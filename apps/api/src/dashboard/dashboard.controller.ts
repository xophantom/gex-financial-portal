import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import type { Viewer } from '../requests/requests.repository';
import { DashboardService } from './dashboard.service';

// Sem @Roles, igual a GET /requests: a rota é do domínio inteiro, não
// FINANCE-only — um solicitante também precisa do próprio resumo. O escopo
// (global vs. só as próprias solicitações) é decidido em SQL dentro do
// repository a partir do papel do viewer, nunca aqui.
//
// @ApiBearerAuth() (fix round 1, doc fix): marca esta rota como exigindo o
// esquema "bearer" no documento gerado — sem isto o cadeado do Swagger UI
// nunca aparece aqui, mesmo com o guard global exigindo o token de verdade.
@ApiTags('dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get('summary')
  summary(@CurrentUser() viewer: Viewer) {
    return this.service.summary(viewer);
  }
}
