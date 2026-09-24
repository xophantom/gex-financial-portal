import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import type { Viewer } from '../requests/requests.repository';
import { DashboardService } from './dashboard.service';

// Sem @Roles: cada papel vê o próprio escopo, decidido em SQL no repositório.
// @ApiBearerAuth() só põe o cadeado no Swagger; quem exige é o guard global.
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
