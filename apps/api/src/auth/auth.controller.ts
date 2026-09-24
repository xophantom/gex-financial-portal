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
import { LoginDto } from './dto';
import { Public } from './public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  // @Post responde 201 por padrão; o teste e2e (e a semântica de login, que
  // não cria um recurso novo) espera 200.
  //
  // O parâmetro continua tipado como `unknown` no corpo do método (só o
  // tipo do decorator @Body vira LoginDto, para o Swagger refletir a classe
  // real) — quem valida continua sendo loginSchema.parse() logo abaixo,
  // deixando o ZodError chegar ao filtro global, que já sabe transformá-lo
  // num 422 com detalhe por campo.
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: LoginDto, @Req() req: Request) {
    const { email, password } = loginSchema.parse(body);
    return this.auth.login(email, password, req.ip ?? 'unknown');
  }

  @Public()
  @Post('refresh')
  async refresh(@Body('refresh_token') refreshToken: string) {
    return this.auth.refresh(refreshToken);
  }
}
