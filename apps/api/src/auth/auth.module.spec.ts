import { JwtModule } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { resolveJwtSecret } from './jwt-secrets';

// Testa exatamente a mesma expressão que AuthModule usa para configurar o
// JwtModule (`JwtModule.registerAsync({ useFactory: () => ({ secret:
// resolveJwtSecret() }) })`), isolada de PrismaModule/RedisModule — que abrem
// conexões reais e, quando compile() rejeita no meio da montagem do módulo,
// deixam esse socket aberto (visto na prática: a suíte inteira não saía
// depois que AppModule passou a rejeitar sem JWT_SECRET). Isto prova a mesma
// coisa — "resolver o provider JWT sem a env var falha, nomeando a
// variável" — sem esse efeito colateral.
describe('AuthModule JWT provider', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('refuses to resolve the JWT provider when JWT_SECRET is missing', async () => {
    delete process.env.JWT_SECRET;

    await expect(
      Test.createTestingModule({
        imports: [
          JwtModule.registerAsync({
            useFactory: () => ({ secret: resolveJwtSecret() }),
          }),
        ],
      }).compile(),
    ).rejects.toThrow(/JWT_SECRET/);
  });
});
