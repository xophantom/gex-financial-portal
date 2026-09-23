import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { createTestApp, TestApp } from './helpers';

let app: TestApp;
let finance: string;
let requesterAna: string;

interface RequesterInfo {
  id: string;
  name: string;
}

interface RequestListItem {
  id: string;
  invoice_number: string;
  status: string;
  supplier_name: string;
  due_date: string;
  amount_cents: number;
  is_overdue: boolean;
  requester: RequesterInfo;
}

interface RequestListBody {
  data: RequestListItem[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}

interface ErrorBody {
  error: {
    code: string;
    message: string;
    details?: { field: string; message: string }[];
  };
}

interface SeedRequestFixtureRow {
  invoice_number: string;
  due_date: string;
  status: string;
}

// Lido do fixture cru, não do banco: compara a saída da API contra a fonte
// da verdade dos dados de seed, não contra o que o próprio seed.ts gravou —
// se o seed corrompesse due_date ou status ao gravar, este teste ainda pegaria
// a divergência entre a API e o fixture original.
const readSeedRequests = (): SeedRequestFixtureRow[] =>
  JSON.parse(
    readFileSync(join(__dirname, '../../../data/seed_requests.json'), 'utf8'),
  ) as SeedRequestFixtureRow[];

beforeAll(async () => {
  app = await createTestApp();
  finance = await app.tokenFor('financeiro@gex.test', 'GexFinance123!');
  requesterAna = await app.tokenFor('solicitante@gex.test', 'GexRequester123!');
}, 180_000);

afterAll(async () => app.close());

const list = (token: string, query = '') =>
  request(app.server)
    .get(`/requests${query}`)
    .set('Authorization', `Bearer ${token}`);

describe('GET /requests scoping', () => {
  it('shows all 16 requests to finance', async () => {
    const response = await list(finance).expect(200);
    const body = response.body as RequestListBody;

    expect(body.total).toBe(16);
  });

  it('shows a requester only their own 8', async () => {
    const response = await list(requesterAna).expect(200);
    const body = response.body as RequestListBody;

    expect(body.total).toBe(8);
    for (const row of body.data) {
      expect(row.requester.id).toBe('10000000-0000-4000-8000-000000000001');
    }
  });

  it('includes the requester name without an extra round trip', async () => {
    const response = await list(finance, '?page_size=1').expect(200);
    const body = response.body as RequestListBody;

    expect(body.data[0].requester.name).toEqual(expect.any(String));
  });

  it('returns amount_cents as a JSON number, not a BigInt string', async () => {
    const response = await list(finance, '?page_size=1').expect(200);
    const body = response.body as RequestListBody;

    expect(typeof body.data[0].amount_cents).toBe('number');
  });
});

describe('GET /requests pagination', () => {
  it('paginates and reports the totals', async () => {
    const response = await list(finance, '?page=2&page_size=5').expect(200);
    const body = response.body as RequestListBody;

    expect(body.data).toHaveLength(5);
    expect(body).toMatchObject({
      page: 2,
      page_size: 5,
      total: 16,
      total_pages: 4,
    });
  });

  it.each([
    '?page=0',
    '?page=-1',
    '?page=abc',
    '?page_size=0',
    '?page_size=-5',
  ])('rejects %s with 422 instead of a database error', async (query) => {
    const response = await list(finance, query).expect(422);
    const body = response.body as ErrorBody;

    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a page_size above the cap', async () => {
    await list(finance, '?page_size=101').expect(422);
  });
});

describe('GET /requests filters', () => {
  it('filters by status', async () => {
    const response = await list(finance, '?status=PENDING').expect(200);
    const body = response.body as RequestListBody;

    expect(body.total).toBe(5);
    expect(body.data.every((row) => row.status === 'PENDING')).toBe(true);
  });

  it('rejects a status outside the enum', async () => {
    await list(finance, '?status=CANCELLED').expect(422);
  });

  it('searches suppliers case-insensitively and partially', async () => {
    const response = await list(finance, '?supplier=aurora').expect(200);
    const body = response.body as RequestListBody;

    expect(body.total).toBeGreaterThan(0);
    expect(body.data[0].supplier_name).toContain('Aurora');
  });

  it('treats LIKE wildcards in the search as literal text', async () => {
    const response = await list(finance, '?supplier=%25').expect(200);
    const body = response.body as RequestListBody;

    expect(body.total).toBe(0);
  });

  it('treats an underscore in the search as literal text', async () => {
    const response = await list(finance, '?supplier=_').expect(200);
    const body = response.body as RequestListBody;

    expect(body.total).toBe(0);
  });

  it('filters by due-date range inclusively on both ends', async () => {
    const response = await list(
      finance,
      '?due_from=2026-09-10&due_to=2026-09-10',
    ).expect(200);
    const body = response.body as RequestListBody;

    expect(body.total).toBe(1);
    expect(body.data[0].due_date).toBe('2026-09-10');
  });

  it('rejects an inverted due-date range with a clear message', async () => {
    const response = await list(
      finance,
      '?due_from=2026-09-30&due_to=2026-09-01',
    ).expect(422);
    const body = response.body as ErrorBody;

    expect(body.error.details?.[0].message).toMatch(/posterior/i);
  });

  it('marks exactly the overdue rows against APP_TODAY, not the wall clock', async () => {
    const response = await list(finance, '?page_size=100').expect(200);
    const body = response.body as RequestListBody;

    // Deriva o conjunto esperado do fixture cru, reaplicando a regra do
    // domínio (não chamando o código sob teste): um total de 4 aqui não
    // prova nada sobre QUAIS 4 — um off-by-one na fronteira da data, ou
    // comparar contra created_at em vez de due_date, ainda produziria 4
    // linhas, só que as erradas, e o teste antigo (toHaveLength(4)) passaria
    // do mesmo jeito.
    const expectedOverdueInvoiceNumbers = readSeedRequests()
      .filter(
        (row) =>
          (row.status === 'PENDING' || row.status === 'APPROVED') &&
          row.due_date < '2026-09-18',
      )
      .map((row) => row.invoice_number)
      .sort();

    const actualOverdueInvoiceNumbers = body.data
      .filter((row) => row.is_overdue)
      .map((row) => row.invoice_number)
      .sort();

    expect(actualOverdueInvoiceNumbers).toEqual(expectedOverdueInvoiceNumbers);
  });

  it('does not mark a request due exactly on APP_TODAY as overdue', async () => {
    const response = await list(
      finance,
      '?due_from=2026-09-18&due_to=2026-09-18',
    ).expect(200);
    const body = response.body as RequestListBody;

    expect(body.data.every((row) => !row.is_overdue)).toBe(true);
  });
});

// Colocado por último de propósito: insere linhas extras na mesma tabela que
// as suítes acima já contaram (16 no total, 5 PENDING etc.). Rodando depois
// que essas asserções de total já passaram, esta suíte não perturba nenhuma
// delas — e o afterAll() apaga as linhas antes do app.close() do arquivo.
describe('GET /requests pagination has a total order', () => {
  const COLLISION_SUPPLIER = 'Colisao Ordenacao E2E';
  const COLLISION_COUNT = 10;
  const PAGE_SIZE = 3;
  const collisionIds = Array.from(
    { length: COLLISION_COUNT },
    (_, index) => `99999999-0000-4000-8000-${String(index).padStart(12, '0')}`,
  );

  let prisma: PrismaClient;

  beforeAll(async () => {
    // process.env.DATABASE_URL já foi setado por createTestApp() (chamado no
    // beforeAll do topo do arquivo, que roda antes de qualquer describe
    // filho) — um client Prisma próprio, fora do pool da aplicação, deixa
    // este teste simular escritas concorrentes sem precisar de nenhuma rota
    // de escrita (a Tarefa 12 só implementa leitura).
    prisma = new PrismaClient();

    // Mesmo due_date e mesmo created_at para todas: sem um desempate único
    // no ORDER BY, essas linhas empatam nas duas colunas usadas hoje.
    const dueDate = new Date('2099-01-01T00:00:00Z');
    const createdAt = new Date('2099-01-01T00:00:00.000Z');

    for (const [index, id] of collisionIds.entries()) {
      await prisma.request.create({
        data: {
          id,
          requesterId: '10000000-0000-4000-8000-000000000001',
          supplierName: COLLISION_SUPPLIER,
          supplierCnpj: `9999999900${String(index).padStart(4, '0')}`,
          invoiceNumber: `COLISAO-${index}`,
          amountCents: 1000n,
          competence: '2099-01',
          dueDate,
          category: 'SOFTWARE',
          status: 'PENDING',
          createdAt,
          updatedAt: createdAt,
        },
      });
    }
  });

  afterAll(async () => {
    await prisma.request.deleteMany({
      where: { supplierName: COLLISION_SUPPLIER },
    });
    await prisma.$disconnect();
  });

  // Duas consultas skip/take separadas e sem alteração nenhuma na tabela
  // entre elas tendem a devolver a mesma ordem de empate por acidente (mesmo
  // plano, mesmo layout físico) — o que mascararia o bug num teste ingênuo.
  // O que de fato muda a ordem de empate em produção é uma escrita
  // concorrente entre a página N e a N+1; touch() reproduz exatamente isso,
  // criando uma nova versão de tupla para cada linha empatada.
  const touchAllCollisionRows = async () => {
    for (const id of [...collisionIds].reverse()) {
      await prisma.request.update({
        where: { id },
        data: { description: `touched-${Date.now()}-${Math.random()}` },
      });
    }
  };

  it('returns every row exactly once across pages despite concurrent writes', async () => {
    const seenIds: string[] = [];
    const pageCount = Math.ceil(COLLISION_COUNT / PAGE_SIZE);

    for (let page = 1; page <= pageCount; page += 1) {
      const response = await list(
        finance,
        `?supplier=${encodeURIComponent(COLLISION_SUPPLIER)}&page=${page}&page_size=${PAGE_SIZE}`,
      ).expect(200);
      const body = response.body as RequestListBody;

      seenIds.push(...body.data.map((row) => row.id));
      await touchAllCollisionRows();
    }

    expect(new Set(seenIds).size).toBe(seenIds.length);
    expect([...seenIds].sort()).toEqual([...collisionIds].sort());
  });
});
