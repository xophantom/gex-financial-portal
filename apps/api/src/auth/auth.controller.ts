import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { loginSchema } from '@gex/shared';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  // @Post responde 201 por padrão; o teste e2e (e a semântica de login, que
  // não cria um recurso novo) espera 200.
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: unknown) {
    // ZodValidationPipe ainda não existe (Tarefa 12); parse() aqui deixa o
    // ZodError chegar ao filtro global, que já sabe transformá-lo num 422
    // com detalhe por campo.
    const { email, password } = loginSchema.parse(body);
    return this.auth.login(email, password);
  }

  @Post('refresh')
  async refresh(@Body('refresh_token') refreshToken: string) {
    return this.auth.refresh(refreshToken);
  }
}
