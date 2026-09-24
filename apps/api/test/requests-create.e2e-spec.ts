import { randomUUID } from 'node:crypto';
import type {
  ErrorEnvelope,
  RequestDetailResponse,
  RequestListResponse,
  RequestResponse,
} from '@gex/shared';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { createTestApp, TestApp } from './support/test-app';

let app: TestApp;
let requester: string;
let finance: string;
let bruno: string;
// Prisma direto: conferir a corrida pela coluna crua, não pela leitura sob teste.
let db: PrismaClient;

const body = () => ({
  supplier_name: 'Fornecedor Teste',
  supplier_cnpj: '10.000.000/0001-45',
  // Já em maiúsculas, como a API normaliza.
  invoice_number: `NF-${randomUUID().slice(0, 8).toUpperCase()}`,
  amount_cents: 155313,
  competence: '09/2026',
  due_date: '2026-09-30',
  category: 'SOFTWARE',
});

beforeAll(async () => {
  app = await createTestApp();
  requester = await app.tokenFor('solicitante@gex.test', 'GexRequester123!');
  finance = await app.tokenFor('financeiro@gex.test', 'GexFinance123!');
  bruno = await app.tokenFor('outro.solicitante@gex.test', 'GexRequester456!');
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
    const created = response.body as RequestResponse;

    expect(created.amount_cents).toBe(155313);
    expect(created.status).toBe('PENDING');
    expect(created.supplier_cnpj).toBe('10000000000145');
    expect(created.competence).toBe('2026-09');
  });

  it('records a creation event in the audit trail', async () => {
    const createdResponse = await post(requester, body()).expect(201);
    const created = createdResponse.body as RequestResponse;

    const detailResponse = await request(app.server)
      .get(`/requests/${created.id}`)
      .set('Authorization', `Bearer ${requester}`)
      .expect(200);
    const detail = detailResponse.body as RequestDetailResponse;

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
    const conflict = conflictResponse.body as ErrorEnvelope;

    expect(conflict.error.code).toBe('DUPLICATE_INVOICE');
  });

  it('treats invoice numbers that differ only in case or spacing as duplicates', async () => {
    const payload = body();
    const created = await post(requester, {
      ...payload,
      invoice_number: payload.invoice_number.toLowerCase(),
    }).expect(201);
    expect((created.body as RequestResponse).invoice_number).toBe(
      payload.invoice_number.toUpperCase(),
    );

    const conflict = await post(requester, {
      ...payload,
      invoice_number: `  ${payload.invoice_number.toUpperCase()} `,
    }).expect(409);
    expect((conflict.body as ErrorEnvelope).error.code).toBe(
      'DUPLICATE_INVOICE',
    );
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
    const list = listResponse.body as RequestListResponse;

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
    const first = firstResponse.body as RequestResponse;
    const second = secondResponse.body as RequestResponse;

    expect(second.id).toBe(first.id);
  });

  // Corpos diferentes: a fingerprint sozinha já impediria o replay. O teste
  // seguinte, com corpos idênticos, é o que prova o isolamento por usuário.
  it("does not leak one requester's response to another reusing the same Idempotency-Key value with a different body", async () => {
    const key = randomUUID();
    const anaPayload = body();
    const brunoPayload = body();

    const anaResponse = await post(requester, anaPayload, key).expect(201);
    const brunoResponse = await post(bruno, brunoPayload, key).expect(201);
    const ana = anaResponse.body as RequestResponse;
    const brunoCreated = brunoResponse.body as RequestResponse;

    expect(brunoCreated.invoice_number).toBe(brunoPayload.invoice_number);
    expect(brunoCreated.invoice_number).not.toBe(ana.invoice_number);
    expect(brunoCreated.requester.id).not.toBe(ana.requester.id);
    expect(brunoCreated.requester.id).not.toBe(ana.id);
    expect(ana.requester.id).not.toBe(brunoCreated.id);

    // Ambas as linhas existem de verdade, cada uma com seu próprio evento de
    // abertura — nenhuma das duas foi silenciosamente descartada.
    const rows = await db.request.findMany({
      where: { id: { in: [ana.id, brunoCreated.id] } },
    });
    expect(rows).toHaveLength(2);
  });

  // Mesmo corpo e mesma chave para outro usuário: sem a chave isolada por
  // solicitante, Bruno receberia 201 com os dados financeiros de Ana. Com
  // ela, o pedido chega ao banco e o índice único responde 409.
  it("does not replay another requester's cached response for an identical body under the same Idempotency-Key", async () => {
    const key = randomUUID();
    const payload = body();

    const anaResponse = await post(requester, payload, key).expect(201);
    const ana = anaResponse.body as RequestResponse;

    const brunoResponse = await post(bruno, payload, key);
    expect(brunoResponse.status).toBe(409);
    const brunoError = brunoResponse.body as ErrorEnvelope;
    expect(brunoError.error.code).toBe('DUPLICATE_INVOICE');

    // Nunca a resposta cacheada de Ana: nem o id, nem o dono.
    expect(brunoResponse.body).not.toMatchObject({ id: ana.id });
    expect(JSON.stringify(brunoResponse.body)).not.toContain(ana.requester.id);
  });

  // Mesma chave com outro corpo é outro pedido: tem que ser criado, não
  // respondido com o replay do primeiro.
  it('does not silently drop a second request when the same key is reused with a different body', async () => {
    const key = randomUUID();
    const firstPayload = body();
    const secondPayload = body();

    const firstResponse = await post(requester, firstPayload, key).expect(201);
    const secondResponse = await post(requester, secondPayload, key).expect(
      201,
    );
    const first = firstResponse.body as RequestResponse;
    const second = secondResponse.body as RequestResponse;

    expect(second.id).not.toBe(first.id);
    expect(second.invoice_number).toBe(secondPayload.invoice_number);

    const rows = await db.request.findMany({
      where: { id: { in: [first.id, second.id] } },
    });
    expect(rows).toHaveLength(2);
  });

  it('refuses finance creating a request', async () => {
    await post(finance, body()).expect(403);
  });

  it.each([
    [{ amount_cents: 0 }, 'amount_cents'],
    [{ amount_cents: -100 }, 'amount_cents'],
    [{ amount_cents: 1.5 }, 'amount_cents'],
    [{ amount_cents: '155313' }, 'amount_cents'],
    [{ supplier_cnpj: '10000000000146' }, 'supplier_cnpj'],
    [{ supplier_cnpj: 'abc10000000000145xyz' }, 'supplier_cnpj'],
    [{ competence: '13/2026' }, 'competence'],
    [{ category: 'OUTROS' }, 'category'],
    [{ supplier_name: '' }, 'supplier_name'],
  ])('rejects invalid %o with 422', async (patch, field) => {
    const response = await post(requester, {
      ...body(),
      ...patch,
    }).expect(422);
    const error = response.body as ErrorEnvelope;

    expect(error.error.code).toBe('VALIDATION_ERROR');
    expect(error.error.details?.some((d) => d.field === field)).toBe(true);
  });
});
