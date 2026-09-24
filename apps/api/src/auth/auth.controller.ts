import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import { loginSchema } from '@gex/shared';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { Public } from './public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  // @Post responde 201 por padrão; o teste e2e (e a semântica de login, que
  // não cria um recurso novo) espera 200.
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: unknown, @Req() req: Request) {
    // ZodValidationPipe ainda não existe (Tarefa 12); parse() aqui deixa o
    // ZodError chegar ao filtro global, que já sabe transformá-lo num 422
    // com detalhe por campo.
    const { email, password } = loginSchema.parse(body);
    return this.auth.login(email, password, req.ip ?? 'unknown');
  }

  @Public()
  @Post('refresh')
  async refresh(@Body('refresh_token') refreshToken: string) {
    return this.auth.refresh(refreshToken);
  }
}
