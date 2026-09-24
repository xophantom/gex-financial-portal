import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';
import { seed, toRequestCategory } from '../prisma/seed';
import { startTestDatabase, stopTestDatabase } from './testcontainers';

interface SeedUserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  seed_password: string;
}

interface SeedRequestRow {
  id: string;
  requester_id: string;
  supplier_name: string;
  supplier_cnpj: string;
  invoice_number: string;
  amount_cents: number;
  competence: string;
  due_date: string;
  category: string;
  description: string;
  status: string;
  rejection_reason: string | null;
  paid_at: string | null;
  payment_reference: string | null;
  created_at: string;
  updated_at: string;
}

interface SeedAuditEventRow {
  id: string;
  request_id: string;
  actor_id: string;
  previous_status: string | null;
  new_status: string;
  reason: string | null;
  created_at: string;
}

const DATA = join(__dirname, '../../../data');

// A fronteira com o disco é o único lugar não confiável: um `as T[]` aqui,
// e o resto do arquivo trabalha com campos de verdade (string, number, null),
// não com `any` se propagando por toda comparação de asserção.
const read = <T>(file: string): T[] =>
  JSON.parse(readFileSync(join(DATA, file), 'utf8')) as T[];

const isoOrNull = (value: string | null) =>
  value ? new Date(value).toISOString() : null;

let prisma: PrismaClient;

beforeAll(async () => {
  const url = await startTestDatabase();
  prisma = new PrismaClient({ datasources: { db: { url } } });
  await seed(prisma);
}, 180_000);

afterAll(async () => {
  await prisma?.$disconnect();
  await stopTestDatabase();
});

describe('seed', () => {
  it('loads every user, request and audit event', async () => {
    expect(await prisma.user.count()).toBe(
      read<SeedUserRow>('seed_users.json').length,
    );
    expect(await prisma.request.count()).toBe(
      read<SeedRequestRow>('seed_requests.json').length,
    );
    expect(await prisma.requestStatusEvent.count()).toBe(
      read<SeedAuditEventRow>('seed_audit_events.json').length,
    );
  });

  it('stores every request field exactly as provided', async () => {
    // Coluna crua, não toRequestCategory(): comparar com a própria função
    // sob teste não pegaria um mapeamento trocado.
    const rawCategories = await prisma.$queryRaw<
      Array<{ id: string; category: string }>
    >`
      SELECT id, category::text AS category FROM requests
    `;
    const rawCategoryById = new Map(
      rawCategories.map((row) => [row.id, row.category]),
    );

    for (const row of read<SeedRequestRow>('seed_requests.json')) {
      const stored = await prisma.request.findUniqueOrThrow({
        where: { id: row.id },
      });

      expect(stored.requesterId).toBe(row.requester_id);
      expect(stored.supplierName).toBe(row.supplier_name);
      expect(stored.supplierCnpj).toBe(row.supplier_cnpj);
      expect(stored.invoiceNumber).toBe(row.invoice_number);
      expect(Number(stored.amountCents)).toBe(row.amount_cents);
      expect(stored.competence).toBe(row.competence);
      expect(stored.dueDate.toISOString().slice(0, 10)).toBe(row.due_date);
      expect(rawCategoryById.get(row.id)).toBe(row.category);
      expect(stored.description).toBe(row.description);
      expect(stored.status).toBe(row.status);
      expect(stored.rejectionReason).toBe(row.rejection_reason);
      expect(stored.paidAt?.toISOString() ?? null).toBe(isoOrNull(row.paid_at));
      expect(stored.paymentReference).toBe(row.payment_reference);
      expect(stored.createdAt.toISOString()).toBe(
        new Date(row.created_at).toISOString(),
      );
      expect(stored.updatedAt.toISOString()).toBe(
        new Date(row.updated_at).toISOString(),
      );
    }
  });

  it('stores every audit event field exactly as provided', async () => {
    for (const event of read<SeedAuditEventRow>('seed_audit_events.json')) {
      const stored = await prisma.requestStatusEvent.findUniqueOrThrow({
        where: { id: event.id },
      });

      expect(stored.requestId).toBe(event.request_id);
      expect(stored.actorId).toBe(event.actor_id);
      expect(stored.previousStatus).toBe(event.previous_status);
      expect(stored.newStatus).toBe(event.new_status);
      expect(stored.reason).toBe(event.reason);
      expect(stored.createdAt.toISOString()).toBe(
        new Date(event.created_at).toISOString(),
      );
    }
  });

  it('ends every audit chain at the request current status', () => {
    const events = read<SeedAuditEventRow>('seed_audit_events.json');
    const requests = read<SeedRequestRow>('seed_requests.json');

    for (const request of requests) {
      const chain = events
        .filter((event) => event.request_id === request.id)
        .sort(
          (a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
        );

      expect(chain.length).toBeGreaterThan(0);
      expect(chain[chain.length - 1].new_status).toBe(request.status);
    }
  });

  it('throws when given an unknown category label', () => {
    expect(() => toRequestCategory('UNKNOWN')).toThrow(
      /unknown request category: UNKNOWN/,
    );
  });

  it('hashes seed passwords instead of storing them', async () => {
    for (const user of read<SeedUserRow>('seed_users.json')) {
      const stored = await prisma.user.findUniqueOrThrow({
        where: { id: user.id },
      });

      expect(stored.passwordHash).not.toContain(user.seed_password);
      expect(await argon2.verify(stored.passwordHash, user.seed_password)).toBe(
        true,
      );
      // verify() aceita qualquer variante; o prefixo prende argon2id.
      expect(stored.passwordHash.startsWith('$argon2id$')).toBe(true);
    }
  });

  it('is idempotent: running twice changes nothing', async () => {
    await seed(prisma);

    expect(await prisma.request.count()).toBe(
      read<SeedRequestRow>('seed_requests.json').length,
    );
    expect(await prisma.requestStatusEvent.count()).toBe(
      read<SeedAuditEventRow>('seed_audit_events.json').length,
    );
  });

  // O seed roda a cada boot do container: não pode desfazer o que a aplicação
  // gravou nem deixar a auditoria incoerente com o status.
  it('preserves changes made after the first run', async () => {
    const target = '20000000-0000-4000-8000-000000000001';
    const financeId = '10000000-0000-4000-8000-000000000003';
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: financeId },
    });

    await prisma.request.update({
      where: { id: target },
      data: { status: 'APPROVED' },
    });
    await prisma.requestStatusEvent.create({
      data: {
        id: randomUUID(),
        requestId: target,
        actorId: financeId,
        previousStatus: 'PENDING',
        newStatus: 'APPROVED',
      },
    });

    await seed(prisma);

    const stored = await prisma.request.findUniqueOrThrow({
      where: { id: target },
      include: { events: { orderBy: { createdAt: 'desc' } } },
    });
    expect(stored.status).toBe('APPROVED');
    expect(stored.events[0].newStatus).toBe('APPROVED');
    // Sem recalcular argon2 para quem já existe.
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: financeId } }))
        .passwordHash,
    ).toBe(user.passwordHash);
  });

  it('keeps paid_at distinct from created_at', async () => {
    const paid = await prisma.request.findMany({ where: { status: 'PAID' } });

    expect(paid).toHaveLength(5);
    for (const request of paid) {
      expect(request.paidAt?.getTime()).not.toBe(request.createdAt.getTime());
    }
  });
});
