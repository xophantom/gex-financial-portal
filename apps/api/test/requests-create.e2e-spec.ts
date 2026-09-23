import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { createTestApp, TestApp } from './helpers';

let app: TestApp;
let requester: string;
let finance: string;
// Cliente Prisma próprio, apontado para o mesmo Postgres descartável do
// Testcontainers (helpers.ts já setou DATABASE_URL antes do compile()). Serve
// só para ler a coluna crua no teste de corrida: contar via GET /requests
// exercitaria o mesmo código de leitura que está sob teste, o que mascararia
// um bug ali (regra do projeto: nunca calcular o valor esperado pelo caminho
// que está sendo testado).
let db: PrismaClient;

interface CreatedRequest {
  id: string;
  amount_cents: number;
  status: string;
  supplier_cnpj: string;
  invoice_number: string;
  competence: string;
}

interface HistoryEvent {
  previous_status: string | null;
  new_status: string;
}

interface RequestDetail {
  history: HistoryEvent[];
}

interface ErrorBody {
  error: {
    code: string;
    message: string;
    details?: { field: string; message: string }[];
  };
}

interface RequestListBody {
  data: { invoice_number: string }[];
}

const body = () => ({
  supplier_name: 'Fornecedor Teste',
  supplier_cnpj: '10.000.000/0001-45',
  invoice_number: `NF-${randomUUID().slice(0, 8)}`,
  amount_cents: 155313,
  competence: '09/2026',
  due_date: '2026-09-30',
  category: 'SOFTWARE',
});

beforeAll(async () => {
  app = await createTestApp();
  requester = await app.tokenFor('solicitante@gex.test', 'GexRequester123!');
  finance = await app.tokenFor('financeiro@gex.test', 'GexFinance123!');
  db = new PrismaClient();
}, 180_000);

afterAll(async () => {
  await db.$disconnect();
  await app.close();
});

const post = (token: string, payload: object, key?: string) => {
  const call = request(app.server)
    .post('/requests')
    .set('Authorization', `Bearer ${token}`);

  return key
    ? call.set('Idempotency-Key', key).send(payload)
    : call.send(payload);
};

describe('POST /requests', () => {
  it('creates a request and stores the amount in cents', async () => {
    const response = await post(requester, body()).expect(201);
    const created = response.body as CreatedRequest;

    expect(created.amount_cents).toBe(155313);
    expect(created.status).toBe('PENDING');
    expect(created.supplier_cnpj).toBe('10000000000145');
    expect(created.competence).toBe('2026-09');
  });

  it('records a creation event in the audit trail', async () => {
    const createdResponse = await post(requester, body()).expect(201);
    const created = createdResponse.body as CreatedRequest;

    const detailResponse = await request(app.server)
      .get(`/requests/${created.id}`)
      .set('Authorization', `Bearer ${requester}`)
      .expect(200);
    const detail = detailResponse.body as RequestDetail;

    expect(detail.history).toHaveLength(1);
    expect(detail.history[0]).toMatchObject({
      previous_status: null,
      new_status: 'PENDING',
    });
  });

  it('refuses a duplicate CNPJ and invoice number with 409', async () => {
    const payload = body();
    await post(requester, payload).expect(201);

    const conflictResponse = await post(requester, payload).expect(409);
    const conflict = conflictResponse.body as ErrorBody;

    expect(conflict.error.code).toBe('DUPLICATE_INVOICE');
  });

  it('creates exactly one row when two identical requests race', async () => {
    const payload = body();
    const results = await Promise.all([
      post(requester, payload),
      post(requester, payload),
      post(requester, payload),
      post(requester, payload),
    ]);

    const statuses = results.map((response) => response.status).sort();
    expect(statuses.filter((status) => status === 201)).toHaveLength(1);
    expect(statuses.filter((status) => status === 409)).toHaveLength(3);

    const listResponse = await request(app.server)
      .get(
        `/requests?supplier=${encodeURIComponent(payload.supplier_name)}&page_size=100`,
      )
      .set('Authorization', `Bearer ${finance}`);
    const list = listResponse.body as RequestListBody;

    const matches = list.data.filter(
      (row) => row.invoice_number === payload.invoice_number,
    );
    expect(matches).toHaveLength(1);

    // Confirmação direta na coluna, contra o índice único: o enunciado exige
    // "sem criar registro extra", e isso é uma afirmação sobre a linha no
    // banco, não sobre quantos 201 o HTTP devolveu.
    const rows = await db.request.findMany({
      where: {
        supplierCnpj: '10000000000145',
        invoiceNumber: payload.invoice_number,
      },
    });
    expect(rows).toHaveLength(1);

    // E exatamente um evento de abertura para essa linha: duas linhas de
    // auditoria significariam duas transações de criação bem-sucedidas, ou
    // seja, o limite da transação em RequestsRepository.create não estaria
    // protegendo create+evento como uma unidade atômica.
    const events = await db.requestStatusEvent.findMany({
      where: { requestId: rows[0].id },
    });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      previousStatus: null,
      newStatus: 'PENDING',
    });
  });

  it('replays the first response for a repeated Idempotency-Key', async () => {
    const key = randomUUID();
    const payload = body();

    const firstResponse = await post(requester, payload, key).expect(201);
    const secondResponse = await post(requester, payload, key).expect(201);
    const first = firstResponse.body as CreatedRequest;
    const second = secondResponse.body as CreatedRequest;

    expect(second.id).toBe(first.id);
  });

  it('refuses finance creating a request', async () => {
    await post(finance, body()).expect(403);
  });

  it.each([
    [{ amount_cents: 0 }, 'amount_cents'],
    [{ amount_cents: -100 }, 'amount_cents'],
    [{ supplier_cnpj: '10000000000146' }, 'supplier_cnpj'],
    [{ competence: '13/2026' }, 'competence'],
    [{ category: 'OUTROS' }, 'category'],
    [{ supplier_name: '' }, 'supplier_name'],
  ])('rejects invalid %o with 422', async (patch, field) => {
    const response = await post(requester, {
      ...body(),
      ...patch,
    }).expect(422);
    const error = response.body as ErrorBody;

    expect(error.error.code).toBe('VALIDATION_ERROR');
    expect(error.error.details?.some((d) => d.field === field)).toBe(true);
  });
});
