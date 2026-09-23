import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtGuard } from './jwt.guard';
import { JwtStrategy, resolveJwtSecret } from './jwt.strategy';
import { RolesGuard } from './roles.guard';

@Module({
  imports: [
    PassportModule,
    // registerAsync adia a leitura de JWT_SECRET para a hora em que o Nest
    // resolve os providers (compile()/create()), não para quando este
    // arquivo é importado — helpers.ts de teste só define a env var depois
    // de subir os containers descartáveis, então a leitura precisa ser tardia
    // (e igual à de JwtStrategy, senão sign() e verify() usam segredos
    // diferentes).
    JwtModule.registerAsync({
      useFactory: () => ({ secret: resolveJwtSecret() }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtGuard, RolesGuard],
  exports: [AuthService, JwtGuard, RolesGuard],
})
export class AuthModule {}
