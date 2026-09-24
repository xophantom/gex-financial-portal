import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common'
import { loginSchema, refreshSchema } from '@gex/shared'
import type { Request } from 'express'
import { ZodValidationPipe } from '../common/http/zod-validation.pipe'
import { AuthService } from './auth.service'
import { Public } from './decorators/public.decorator'
import { LoginDto } from './dto/login.dto'
import { RefreshDto } from './dto/refresh.dto'

// 200 e não o 201 padrão de POST: login e refresh não criam recurso.
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body(new ZodValidationPipe(loginSchema)) body: LoginDto, @Req() req: Request) {
    return this.auth.login(body.email, body.password, req.ip ?? 'unknown')
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body(new ZodValidationPipe(refreshSchema)) body: RefreshDto) {
    return this.auth.refresh(body.refresh_token)
  }
}
