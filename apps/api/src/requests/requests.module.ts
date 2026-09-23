import { Module } from '@nestjs/common';
import { IdempotencyService } from './idempotency.service';
import { RequestsController } from './requests.controller';
import { RequestsRepository } from './requests.repository';
import { RequestsService } from './requests.service';

@Module({
  controllers: [RequestsController],
  providers: [RequestsRepository, RequestsService, IdempotencyService],
})
export class RequestsModule {}
