import { Module } from '@nestjs/common';
import { DashboardModule } from '../dashboard/dashboard.module';
import { IdempotencyService } from './idempotency.service';
import { RequestsController } from './requests.controller';
import { RequestsRepository } from './requests.repository';
import { RequestsService } from './requests.service';

@Module({
  // DashboardModule: create/decide/markPaid precisam invalidar o cache de
  // indicadores que passam a estar errados a cada uma dessas transições.
  imports: [DashboardModule],
  controllers: [RequestsController],
  providers: [RequestsRepository, RequestsService, IdempotencyService],
})
export class RequestsModule {}
