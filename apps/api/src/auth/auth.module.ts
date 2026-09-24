import { Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { JwtModule } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { JwtGuard } from './guards/jwt.guard'
import { RolesGuard } from './guards/roles.guard'
import { resolveJwtSecret } from './jwt-secrets'
import { JwtStrategy } from './strategies/jwt.strategy'

@Module({
  imports: [
    PassportModule,
    // registerAsync lê JWT_SECRET quando o Nest resolve os providers, não no
    // import: os testes só definem o segredo depois de subir os containers.
    // A leitura é a mesma de JwtStrategy, para sign() e verify() baterem.
    JwtModule.registerAsync({
      useFactory: () => ({ secret: resolveJwtSecret() }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    JwtGuard,
    RolesGuard,
    // Globais e negando por padrão: um controller novo já nasce protegido.
    // A ordem importa: autenticação (JwtGuard) antes de autorização.
    { provide: APP_GUARD, useClass: JwtGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [AuthService, JwtGuard, RolesGuard],
})
export class AuthModule {}
