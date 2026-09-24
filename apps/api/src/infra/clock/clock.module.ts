import { Global, Module } from '@nestjs/common'
import { ClockService } from './clock.service'

@Global()
@Module({
  providers: [{ provide: ClockService, useFactory: () => new ClockService(process.env) }],
  exports: [ClockService],
})
export class ClockModule {}
