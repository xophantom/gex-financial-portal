import { Prisma } from '@prisma/client';
import type { CreateRequestInput } from '@gex/shared';
import { RequestsService } from './requests.service';
import type { Viewer } from './requests.repository';

const requester: Viewer = {
  id: '10000000-0000-4000-8000-000000000001',
  role: 'REQUESTER',
};

const input: CreateRequestInput = {
  supplier_name: 'Fornecedor Teste',
  supplier_cnpj: '10000000000145',
  invoice_number: 'NF-0001',
  amount_cents: 155313,
  competence: '2026-09',
  due_date: '2026-09-30',
  category: 'SOFTWARE',
};

// Fabrica um PrismaClientKnownRequestError de verdade (mesma classe que o
// código de produção testa com instanceof), não um objeto plano com o mesmo
// formato — senão o teste provaria só a forma do erro, não o comportamento
// real do runtime do Prisma.
function fabricateP2002(
  target: string[],
): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError(
    'Unique constraint failed on the fields',
    { code: 'P2002', clientVersion: '6.19.3', meta: { target } },
  );
}

/* eslint-disable @typescript-eslint/require-await -- fakes precisam devolver
   Promise para bater com a assinatura real dos métodos assíncronos que
   substituem. */
function build(createImpl: () => Promise<unknown>) {
  const repository = {
    create: jest.fn(createImpl),
    findOne: jest.fn(async () => null),
  };
  const clock = { today: jest.fn(() => '2026-09-18') };
  const idempotency = {
    recall: jest.fn(async () => null),
    remember: jest.fn(async () => undefined),
    fingerprint: jest.fn(() => 'fingerprint'),
  };
  const dashboard = { invalidate: jest.fn(async () => undefined) };

  return new RequestsService(
    repository as never,
    clock as never,
    idempotency as never,
    dashboard as never,
  );
}
/* eslint-enable @typescript-eslint/require-await */

describe('RequestsService.create — mapping P2002 to DUPLICATE_INVOICE', () => {
  it('maps the (supplier_cnpj, invoice_number) violation to 409 DUPLICATE_INVOICE', async () => {
    const service = build(() =>
      Promise.reject(fabricateP2002(['supplier_cnpj', 'invoice_number'])),
    );

    await expect(service.create(input, requester)).rejects.toMatchObject({
      code: 'DUPLICATE_INVOICE',
      status: 409,
    });
  });

  // Regra do projeto: "não é alcançável hoje" já mordeu quatro vezes. As
  // únicas outras constraints únicas na transação de criação são as chaves
  // primárias (Request.id, RequestStatusEvent.id), geradas por randomUUID()
  // e portanto praticamente nunca colidem — mas no dia em que alguém
  // acrescentar uma nova constraint única a Request ou RequestStatusEvent,
  // este teste é o que impede um P2002 dela de virar "nota duplicada" para
  // o cliente.
  it('does not map a P2002 from a different constraint to DUPLICATE_INVOICE', async () => {
    const error = fabricateP2002(['id']);
    const service = build(() => Promise.reject(error));

    await expect(service.create(input, requester)).rejects.toBe(error);
  });

  it('does not map a P2002 with no meta.target at all', async () => {
    const error = new Prisma.PrismaClientKnownRequestError('no target', {
      code: 'P2002',
      clientVersion: '6.19.3',
    });
    const service = build(() => Promise.reject(error));

    await expect(service.create(input, requester)).rejects.toBe(error);
  });

  it('rethrows non-Prisma errors unchanged', async () => {
    const error = new Error('boom');
    const service = build(() => Promise.reject(error));

    await expect(service.create(input, requester)).rejects.toBe(error);
  });
});
