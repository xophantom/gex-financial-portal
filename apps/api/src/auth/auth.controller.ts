import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req } from '@nestjs/common'
import { ApiBearerAuth } from '@nestjs/swagger'
import { loginSchema, refreshSchema, type SessionUser } from '@gex/shared'
import type { Request } from 'express'
import { ZodValidationPipe } from '../common/http/zod-validation.pipe'
import type { AuthenticatedUser } from './authenticated-user'
import { AuthService } from './auth.service'
import { CurrentUser } from './decorators/current-user.decorator'
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

  // Identidade da sessão para a interface, lida do banco a cada requisição
  // pela JwtStrategy.
  @ApiBearerAuth()
  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser): SessionUser {
    return { id: user.id, name: user.name, email: user.email, role: user.role }
  }
}
