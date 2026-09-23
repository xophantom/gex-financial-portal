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

  it('marks overdue rows against APP_TODAY, not the wall clock', async () => {
    const response = await list(finance, '?page_size=100').expect(200);
    const body = response.body as RequestListBody;
    const overdue = body.data.filter((row) => row.is_overdue);

    expect(overdue).toHaveLength(4);
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
