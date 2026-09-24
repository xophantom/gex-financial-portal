import { Injectable } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import argon2 from 'argon2'
import type { AuthResponse, SessionUser } from '@gex/shared'
import { AppException } from '../common/errors/app.exception'
import { PrismaService } from '../infra/prisma/prisma.service'
import { RedisService } from '../infra/redis/redis.service'
import { resolveJwtRefreshSecret } from './jwt-secrets'

const MAX_ATTEMPTS_PER_EMAIL = 10
const EMAIL_WINDOW_SECONDS = 300
// Mais alto que o limite por e-mail: cobre um IP tentando muitas contas
// diferentes, poucas vezes cada uma.
const MAX_ATTEMPTS_PER_IP = 30
const IP_WINDOW_SECONDS = 300

// Hash argon2id fixo verificado quando o e-mail não existe, só para pagar o
// mesmo custo de CPU de um usuário real: sem ele, o tempo de resposta
// revelaria quais e-mails têm conta. O resultado é sempre descartado.
const DUMMY_PASSWORD_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$NZgu8zFbSVZkqFpSgF0NmA$Is1czcXXrf+qFEl+t5LRNtEALabV2KLfgdtbg6nomzc'

const tooManyAttempts = () =>
  new AppException('TOO_MANY_REQUESTS', 'Muitas tentativas. Tente novamente em instantes.', 429)

@Injectable()
export class AuthService {
  // Resolvido na construção para falhar no boot sem JWT_REFRESH_SECRET; com
  // `secret: undefined` o @nestjs/jwt usaria JWT_SECRET para os dois tokens.
  private readonly refreshSecret = resolveJwtRefreshSecret()

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly redis: RedisService,
  ) {}

  // O e-mail chega normalizado (minúsculas) pelo loginSchema.
  async login(email: string, password: string, ip: string): Promise<AuthResponse> {
    const emailKey = `login:email:${email}`
    const ipKey = `login:ip:${ip}`

    // Os dois limites barram antes do argon2: checados depois, só trocariam o
    // código de erro dos chutes errados e deixariam o chute certo entrar.
    await this.rejectIfOverLimit(ipKey, MAX_ATTEMPTS_PER_IP)
    await this.enforceLimit(emailKey, MAX_ATTEMPTS_PER_EMAIL, EMAIL_WINDOW_SECONDS)

    const user = await this.prisma.user.findUnique({ where: { email } })

    let valid: boolean
    if (user) {
      valid = await argon2.verify(user.passwordHash, password)
    } else {
      await argon2.verify(DUMMY_PASSWORD_HASH, password)
      valid = false
    }

    // Mesma mensagem e mesmo status para e-mail inexistente e senha errada:
    // distinguir os dois transforma a tela de login em verificador de contas.
    if (!user || !valid) {
      // Por IP só conta falha: um escritório atrás do mesmo NAT não pode se
      // bloquear com logins que deram certo.
      await this.redis.incrWithTtl(ipKey, IP_WINDOW_SECONDS)

      throw new AppException('UNAUTHENTICATED', 'E-mail ou senha inválidos', 401)
    }

    // Só o contador do e-mail zera no sucesso: zerar o do IP deixaria um
    // atacante logar na própria conta para continuar testando as outras.
    await this.redis.delKey(emailKey)

    return this.issue(user)
  }

  async refresh(refreshToken: string): Promise<AuthResponse> {
    const payload = await this.jwt
      .verifyAsync<{ sub: string }>(refreshToken, {
        secret: this.refreshSecret,
        algorithms: ['HS256'],
      })
      .catch(() => {
        throw new AppException('UNAUTHENTICATED', 'Sessão expirada', 401)
      })

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    })
    if (!user) throw new AppException('UNAUTHENTICATED', 'Sessão expirada', 401)

    return this.issue(user)
  }

  // Fail-open: com o Redis fora (contagem null) o login segue sem limite.
  // O Redis não é fonte de verdade, e bloquear todo login por uma queda do
  // cache seria pior que a força bruta, que o argon2 já torna cara.
  private async enforceLimit(key: string, max: number, windowSeconds: number): Promise<void> {
    const attempts = await this.redis.incrWithTtl(key, windowSeconds)

    if (attempts !== null && attempts > max) throw tooManyAttempts()
  }

  // Só lê: o contador por IP é incrementado apenas nas falhas.
  private async rejectIfOverLimit(key: string, max: number): Promise<void> {
    const failures = Number((await this.redis.get(key)) ?? 0)

    if (failures >= max) throw tooManyAttempts()
  }

  // Recebe a linha inteira do Prisma, mas só os campos de SessionUser saem
  // na resposta: o passwordHash nunca chega ao cliente.
  private async issue(user: SessionUser): Promise<AuthResponse> {
    const claims = { sub: user.id, role: user.role }

    return {
      access_token: await this.jwt.signAsync(claims, { expiresIn: '15m' }),
      refresh_token: await this.jwt.signAsync(claims, {
        expiresIn: '7d',
        secret: this.refreshSecret,
      }),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    }
  }
}
