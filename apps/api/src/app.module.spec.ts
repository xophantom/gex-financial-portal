import { Test } from '@nestjs/testing';
import { AppModule } from './app.module';
import { ClockService } from './infra/clock/clock.service';
import { PrismaService } from './infra/prisma/prisma.service';

describe('AppModule', () => {
  // AuthModule exige os segredos JWT e o HealthDatabaseClient exige
  // DATABASE_URL (sem fallback); valores de teste aqui em vez de enfraquecer
  // as checagens. compile() não conecta ao banco.
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.JWT_SECRET = 'app-module-spec-secret';
    process.env.JWT_REFRESH_SECRET = 'app-module-spec-refresh-secret';
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/app';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  // PrismaModule e ClockModule são @Global(), mas um módulo @Global() só entra
  // no container quando algo o importa. Sem este teste, os dois poderiam ficar
  // declarados e nunca instanciados sem que nenhuma suíte notasse: get() lança
  // quando o provider não existe no grafo, então a ausência de exceção aqui já
  // comprova a resolução.
  it('makes PrismaService and ClockService resolvable from the app context', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    // finally: sem fechar o módulo, a conexão do Redis mantém o Jest vivo.
    try {
      const prisma = moduleRef.get(PrismaService);
      const clock = moduleRef.get(ClockService);

      // PrismaClient devolve um Proxy do próprio construtor, então
      // `instanceof PrismaService` não é confiável; $connect herdado prova
      // que é um client real.
      expect(prisma).toBeDefined();
      expect(typeof prisma.$connect).toBe('function');
      expect(clock).toBeInstanceOf(ClockService);
    } finally {
      await moduleRef.close();
    }
  });
});
