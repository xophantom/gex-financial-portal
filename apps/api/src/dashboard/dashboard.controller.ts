import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../auth/authenticated-user';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { DashboardService } from './dashboard.service';

// Sem @Roles: cada papel vê o próprio escopo, decidido em SQL no repositório.
// @ApiBearerAuth() só põe o cadeado no Swagger; quem exige é o guard global.
@ApiTags('dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get('summary')
  summary(@CurrentUser() viewer: AuthenticatedUser) {
    return this.service.summary(viewer);
  }
}
