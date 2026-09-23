import { Test } from '@nestjs/testing'
import { AppModule } from './app.module'
import { ClockService } from './clock/clock.service'
import { PrismaService } from './prisma/prisma.service'

describe('AppModule', () => {
  // PrismaModule e ClockModule são @Global(), mas um módulo @Global() só entra
  // no container quando algo o importa. Sem este teste, os dois poderiam ficar
  // declarados e nunca instanciados sem que nenhuma suíte notasse: get() lança
  // quando o provider não existe no grafo, então a ausência de exceção aqui já
  // comprova a resolução.
  it('makes PrismaService and ClockService resolvable from the app context', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()

    const prisma = moduleRef.get(PrismaService)
    const clock = moduleRef.get(ClockService)

    // PrismaClient (a base da PrismaService) devolve um Proxy do seu próprio
    // construtor, então `instanceof PrismaService` não é confiável aqui; o
    // método herdado $connect é evidência direta de que é um client real.
    expect(prisma).toBeDefined()
    expect(typeof prisma.$connect).toBe('function')
    expect(clock).toBeInstanceOf(ClockService)

    await moduleRef.close()
  })
})
