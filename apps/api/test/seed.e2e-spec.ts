import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';
import { seed } from '../prisma/seed';
import { startTestDatabase, stopTestDatabase } from './testcontainers';

const DATA = join(__dirname, '../../../data');
const read = (file: string) =>
  JSON.parse(readFileSync(join(DATA, file), 'utf8'));

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
    expect(await prisma.user.count()).toBe(read('seed_users.json').length);
    expect(await prisma.request.count()).toBe(
      read('seed_requests.json').length,
    );
    expect(await prisma.requestStatusEvent.count()).toBe(
      read('seed_audit_events.json').length,
    );
  });

  it('stores amounts, statuses and dates exactly as provided', async () => {
    for (const row of read('seed_requests.json')) {
      const stored = await prisma.request.findUniqueOrThrow({
        where: { id: row.id },
      });

      expect(Number(stored.amountCents)).toBe(row.amount_cents);
      expect(stored.status).toBe(row.status);
      expect(stored.competence).toBe(row.competence);
      expect(stored.dueDate.toISOString().slice(0, 10)).toBe(row.due_date);
      expect(stored.paidAt?.toISOString() ?? null).toBe(
        row.paid_at ? new Date(row.paid_at).toISOString() : null,
      );
    }
  });

  it('hashes seed passwords instead of storing them', async () => {
    for (const user of read('seed_users.json')) {
      const stored = await prisma.user.findUniqueOrThrow({
        where: { id: user.id },
      });

      expect(stored.passwordHash).not.toContain(user.seed_password);
      expect(await argon2.verify(stored.passwordHash, user.seed_password)).toBe(
        true,
      );
    }
  });

  it('is idempotent: running twice changes nothing', async () => {
    await seed(prisma);

    expect(await prisma.request.count()).toBe(
      read('seed_requests.json').length,
    );
    expect(await prisma.requestStatusEvent.count()).toBe(
      read('seed_audit_events.json').length,
    );
  });

  it('keeps paid_at distinct from created_at', async () => {
    const paid = await prisma.request.findMany({ where: { status: 'PAID' } });

    expect(paid).toHaveLength(5);
    for (const request of paid) {
      expect(request.paidAt?.getTime()).not.toBe(request.createdAt.getTime());
    }
  });
});
