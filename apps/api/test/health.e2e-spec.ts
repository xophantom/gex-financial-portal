import request from 'supertest'
import { createTestApp, TestApp } from './support/test-app'

interface HealthBody {
  status: string
  checks: { database: string; redis: string }
}

let app: TestApp

beforeAll(async () => {
  app = await createTestApp()
}, 180_000)

afterAll(async () => app.close())

describe('GET /health', () => {
  it('reports ok when database and redis answer', async () => {
    const response = await request(app.server).get('/health').expect(200)
    const body = response.body as HealthBody

    expect(body.status).toBe('ok')
    expect(body.checks.database).toBe('up')
    expect(body.checks.redis).toBe('up')
  })

  it('needs no authentication, so the container healthcheck can call it', async () => {
    await request(app.server).get('/health').expect(200)
  })

  it('reports degraded with 200 when only redis is down', async () => {
    // finally: o Redis volta mesmo se a asserção falhar; senão os testes
    // seguintes rodariam com ele pausado.
    await app.stopRedis()
    try {
      const response = await request(app.server).get('/health').expect(200)
      const body = response.body as HealthBody

      expect(body.status).toBe('degraded')
      expect(body.checks.redis).toBe('down')
    } finally {
      await app.startRedis()
    }
  })

  it('reports unhealthy with 503 when the database is down', async () => {
    // finally, e aqui é crítico: com o Postgres pausado, o afterAll
    // (app.close() → $disconnect()) travaria contra um socket congelado.
    await app.stopDatabase()
    try {
      const response = await request(app.server).get('/health').expect(503)
      const body = response.body as HealthBody

      expect(body.status).toBe('unhealthy')
    } finally {
      await app.startDatabase()
    }
  })
})

describe('GET /docs', () => {
  it('serves the generated API documentation', async () => {
    await request(app.server).get('/docs').expect(200)
  })
})
