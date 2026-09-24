import { Module } from '@nestjs/common'
import { DashboardController } from './dashboard.controller'
import { DashboardRepository } from './dashboard.repository'
import { DashboardService } from './dashboard.service'

@Module({
  controllers: [DashboardController],
  providers: [DashboardRepository, DashboardService],
  // Exportado para RequestsModule: create/decide/markPaid mudam os
  // indicadores que este módulo cacheia, então RequestsService precisa
  // chamar DashboardService.invalidate() ao final de cada um.
  exports: [DashboardService],
})
export class DashboardModule {}
