import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';
import request from 'supertest';
import { createTestApp, TestApp } from './helpers';

interface ExpectedBlock {
  request_count: number;
  status_counts: Record<string, number>;
  pending_amount_cents: number;
  approved_amount_cents: number;
  paid_this_month_amount_cents: number;
  overdue_count: number;
}

interface Expected {
  reference_date: string;
  finance: ExpectedBlock;
  requesters: Record<string, ExpectedBlock>;
}

interface DashboardSummary {
  reference_date: string;
  pending_amount_cents: number;
  approved_amount_cents: number;
  paid_this_month_amount_cents: number;
  overdue_count: number;
  request_count: number;
  status_counts: Record<string, number>;
}

const expected = JSON.parse(
  readFileSync(join(__dirname, '../../../data/expected_results.json'), 'utf8'),
) as Expected;

const ANA_ID = '10000000-0000-4000-8000-000000000001';
const BRUNO_ID = '10000000-0000-4000-8000-000000000002';

let app: TestApp;
let finance: string;
let ana: string;
let bruno: string;
// Cliente Prisma próprio, como em requests-create.e2e-spec.ts: só para
// inserir o usuário sem solicitações do teste de Finding 3 (não existe rota
// de cadastro de usuário — os únicos usuários do sistema vêm do seed).
let db: PrismaClient;

beforeAll(async () => {
  app = await createTestApp();
  finance = await app.tokenFor('financeiro@gex.test', 'GexFinance123!');
  ana = await app.tokenFor('solicitante@gex.test', 'GexRequester123!');
  bruno = await app.tokenFor('outro.solicitante@gex.test', 'GexRequester456!');
  db = new PrismaClient();
}, 180_000);

afterAll(async () => {
  await db.$disconnect();
  await app.close();
});

const summary = (token: string) =>
  request(app.server)
    .get('/dashboard/summary')
    .set('Authorization', `Bearer ${token}`);

const summaryOf = async (token: string): Promise<DashboardSummary> => {
  const response = await summary(token).expect(200);
  return response.body as DashboardSummary;
};

const decide = (token: string, id: string, payload: object) =>
  request(app.server)
    .post(`/requests/${id}/decision`)
    .set('Authorization', `Bearer ${token}`)
    .send(payload);

const markPaid = (token: string, id: string, payload: object) =>
  request(app.server)
    .post(`/requests/${id}/mark-paid`)
    .set('Authorization', `Bearer ${token}`)
    .send(payload);

describe('GET /dashboard/summary for finance', () => {
  it('matches every expected indicator', async () => {
    const body = await summaryOf(finance);

    expect(body).toMatchObject({
      pending_amount_cents: expected.finance.pending_amount_cents,
      approved_amount_cents: expected.finance.approved_amount_cents,
      paid_this_month_amount_cents:
        expected.finance.paid_this_month_amount_cents,
      overdue_count: expected.finance.overdue_count,
      request_count: expected.finance.request_count,
    });
    expect(body.status_counts).toEqual(expected.finance.status_counts);
  });

  it('reports amounts as JSON numbers, not BigInt strings', async () => {
    const body = await summaryOf(finance);

    for (const key of [
      'pending_amount_cents',
      'approved_amount_cents',
      'paid_this_month_amount_cents',
    ] as const) {
      expect(typeof body[key]).toBe('number');
    }
  });

  it('uses APP_TODAY as the reference date', async () => {
    const body = await summaryOf(finance);
    expect(body.reference_date).toBe(expected.reference_date);
  });

  it('excludes a payment made in the previous month', async () => {
    const body = await summaryOf(finance);
    // NF-2026-1012 foi paga em 2026-08-31 e não pode entrar em "pago no mês".
    // Lido de expected_results.json, não redigitado: o parágrafo anterior
    // deste mesmo brief avisa contra criar uma segunda fonte da verdade, e
    // hardcodar o número aqui seria exatamente isso (achado do revisor).
    expect(body.paid_this_month_amount_cents).toBe(
      expected.finance.paid_this_month_amount_cents,
    );
  });
});

describe('GET /dashboard/summary for each requester', () => {
  it.each([
    [ANA_ID, () => ana],
    [BRUNO_ID, () => bruno],
  ])('matches the expected block for %s', async (id, token) => {
    const body = await summaryOf(token());
    const want = expected.requesters[id];

    expect(body).toMatchObject({
      pending_amount_cents: want.pending_amount_cents,
      approved_amount_cents: want.approved_amount_cents,
      paid_this_month_amount_cents: want.paid_this_month_amount_cents,
      overdue_count: want.overdue_count,
      request_count: want.request_count,
    });
    expect(body.status_counts).toEqual(want.status_counts);
  });

  it('never lets a requester see the global totals', async () => {
    const body = await summaryOf(ana);
    expect(body.pending_amount_cents).not.toBe(
      expected.finance.pending_amount_cents,
    );
  });
});

// O seed não tem nenhum usuário sem solicitações, então o caminho
// COALESCE(SUM(...), 0) do repository nunca era exercitado ponta a ponta —
// só correto "por inspeção" (achado do revisor). Sem o COALESCE, SUM sobre
// zero linhas devolve NULL, e um requester recém-criado veria
// pending_amount_cents: null no primeiro render, quebrando qualquer soma ou
// formatação de moeda no frontend.
describe('GET /dashboard/summary for a requester with zero requests', () => {
  const EMAIL = 'sem-solicitacoes@gex.test';
  const PASSWORD = 'GexEmptyRequester123!';

  it('returns zero for every indicator, never null or a missing status key', async () => {
    // Não existe rota de cadastro de usuário no domínio — os únicos usuários
    // vêm do seed — então o Prisma direto é o único jeito de criar uma conta
    // sem nenhuma linha em requests para este teste.
    await db.user.create({
      data: {
        id: randomUUID(),
        name: 'Requester Sem Solicitações',
        email: EMAIL,
        role: 'REQUESTER',
        passwordHash: await argon2.hash(PASSWORD, { type: argon2.argon2id }),
      },
    });

    const token = await app.tokenFor(EMAIL, PASSWORD);
    const body = await summaryOf(token);

    expect(body).toMatchObject({
      pending_amount_cents: 0,
      approved_amount_cents: 0,
      paid_this_month_amount_cents: 0,
      overdue_count: 0,
      request_count: 0,
    });
    expect(body.status_counts).toEqual({
      PENDING: 0,
      APPROVED: 0,
      REJECTED: 0,
      PAID: 0,
    });
  });
});

// Task 13 vazou dados entre contas porque a chave de cache do idempotency
// dependia só do valor enviado pelo cliente, sem o id do dono — e todo teste
// de escopo até aquele ponto usava um único ator, o que tornava o vazamento
// invisível (bate com um ator, sempre bate). Este bloco existe para não
// repetir o erro: usa três contas reais e diferentes (financeiro + dois
// solicitantes) e prova que nenhuma delas nunca recebe o payload de outra.
describe('cache isolation across viewers (Task 13 regression)', () => {
  it('gives each of the three viewers their own numbers, never one another’s', async () => {
    const [financeBody, anaBody, brunoBody] = await Promise.all([
      summaryOf(finance),
      summaryOf(ana),
      summaryOf(bruno),
    ]);

    expect(financeBody.pending_amount_cents).toBe(
      expected.finance.pending_amount_cents,
    );
    expect(anaBody.pending_amount_cents).toBe(
      expected.requesters[ANA_ID].pending_amount_cents,
    );
    expect(brunoBody.pending_amount_cents).toBe(
      expected.requesters[BRUNO_ID].pending_amount_cents,
    );

    // As três contas têm dados diferentes no seed (ver expected_results.json);
    // se qualquer par de payloads vier idêntico, a chave de cache colidiu
    // entre viewers — exatamente a forma do vazamento da Tarefa 13.
    const payloads = [financeBody, anaBody, brunoBody];
    for (let i = 0; i < payloads.length; i += 1) {
      for (let j = i + 1; j < payloads.length; j += 1) {
        expect(payloads[i]).not.toEqual(payloads[j]);
      }
    }
  });
});

describe('cache behaviour', () => {
  it('reflects a new request immediately after it is created', async () => {
    const before = await summaryOf(ana);

    await request(app.server)
      .post('/requests')
      .set('Authorization', `Bearer ${ana}`)
      .send({
        supplier_name: 'Cache Test',
        supplier_cnpj: '10.000.000/0001-45',
        invoice_number: `NF-CACHE-${Date.now()}`,
        amount_cents: 10_000,
        competence: '09/2026',
        due_date: '2026-09-30',
        category: 'SOFTWARE',
      })
      .expect(201);

    const after = await summaryOf(ana);

    expect(after.pending_amount_cents).toBe(
      before.pending_amount_cents + 10_000,
    );
  });

  // A criação acima só prova que o próprio cache da Ana foi invalidado. Uma
  // solicitação de um requester também muda o agregado GLOBAL que o
  // financeiro vê — se invalidate() só limpasse a chave de quem escreveu,
  // financeiro continuaria servindo o total antigo do cache pelo resto do TTL.
  it('also invalidates what finance sees when a requester creates a request', async () => {
    // Força a entrada de financeiro a existir no cache antes da escrita, para
    // que a invalidação tenha algo de fato para derrubar.
    const before = await summaryOf(finance);

    await request(app.server)
      .post('/requests')
      .set('Authorization', `Bearer ${bruno}`)
      .send({
        supplier_name: 'Cache Test Finance View',
        supplier_cnpj: '10.000.000/0001-45',
        invoice_number: `NF-CACHE-FIN-${Date.now()}`,
        amount_cents: 20_000,
        competence: '09/2026',
        due_date: '2026-09-30',
        category: 'SOFTWARE',
      })
      .expect(201);

    const after = await summaryOf(finance);

    expect(after.pending_amount_cents).toBe(
      before.pending_amount_cents + 20_000,
    );
  });

  it('reflects a decision (approve) immediately for both the requester and finance', async () => {
    // ...003 do seed: PENDING, de Ana, 9999 centavos (ver data/seed_requests.json).
    const target = '20000000-0000-4000-8000-000000000003';
    const beforeAna = await summaryOf(ana);
    const beforeFinance = await summaryOf(finance);

    await decide(finance, target, { decision: 'APPROVE' }).expect(200);

    const afterAna = await summaryOf(ana);
    const afterFinance = await summaryOf(finance);

    expect(afterAna.pending_amount_cents).toBe(
      beforeAna.pending_amount_cents - 9999,
    );
    expect(afterAna.approved_amount_cents).toBe(
      beforeAna.approved_amount_cents + 9999,
    );
    expect(afterFinance.pending_amount_cents).toBe(
      beforeFinance.pending_amount_cents - 9999,
    );
    expect(afterFinance.approved_amount_cents).toBe(
      beforeFinance.approved_amount_cents + 9999,
    );
  });

  it('reflects a mark-paid immediately for both the requester and finance', async () => {
    // ...009 do seed: APPROVED, de Ana, 150000 centavos, vencimento 2026-09-19.
    const target = '20000000-0000-4000-8000-000000000009';
    const beforeAna = await summaryOf(ana);
    const beforeFinance = await summaryOf(finance);

    await markPaid(finance, target, {
      paid_at: '2026-09-18',
      payment_reference: 'PAG-CACHE-TEST',
    }).expect(200);

    const afterAna = await summaryOf(ana);
    const afterFinance = await summaryOf(finance);

    expect(afterAna.approved_amount_cents).toBe(
      beforeAna.approved_amount_cents - 150_000,
    );
    expect(afterAna.paid_this_month_amount_cents).toBe(
      beforeAna.paid_this_month_amount_cents + 150_000,
    );
    expect(afterFinance.approved_amount_cents).toBe(
      beforeFinance.approved_amount_cents - 150_000,
    );
    expect(afterFinance.paid_this_month_amount_cents).toBe(
      beforeFinance.paid_this_month_amount_cents + 150_000,
    );
  });
});
