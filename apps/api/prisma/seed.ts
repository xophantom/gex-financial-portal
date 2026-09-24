import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient, RequestStatus, UserRole } from '@prisma/client';
import argon2 from 'argon2';
import { toPrismaCategory } from '../src/requests/request-category.mapper';

// Roda sempre a partir do fonte (tsx em dev e no container, ts-jest nos
// testes), nunca compilado: o caminho até data/ na raiz do monorepo é fixo.
const DATA = join(__dirname, '..', '..', '..', 'data');

// Formato dos arquivos em data/, como vêm do enunciado (snake_case, datas em
// string, categoria com acento).
export interface SeedUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  seed_password: string;
}

export interface SeedRequest {
  id: string;
  requester_id: string;
  supplier_name: string;
  supplier_cnpj: string;
  invoice_number: string;
  amount_cents: number;
  competence: string;
  due_date: string;
  category: string;
  description: string | null;
  status: RequestStatus;
  rejection_reason: string | null;
  paid_at: string | null;
  payment_reference: string | null;
  created_at: string;
  updated_at: string;
}

export interface SeedAuditEvent {
  id: string;
  request_id: string;
  actor_id: string;
  previous_status: RequestStatus | null;
  new_status: RequestStatus;
  reason: string | null;
  created_at: string;
}

const read = <T>(file: string): T[] =>
  JSON.parse(readFileSync(join(DATA, file), 'utf8')) as T[];

// Roda a cada boot do container, então só cria o que falta: sobrescrever
// linhas existentes desfaria transições feitas pela aplicação e deixaria os
// eventos de auditoria novos incoerentes com o status.
export async function seed(prisma: PrismaClient): Promise<void> {
  const existingUsers = new Set(
    (await prisma.user.findMany({ select: { id: true } })).map(({ id }) => id),
  );

  for (const user of read<SeedUser>('seed_users.json')) {
    // argon2 é caro de propósito: só calcula para quem ainda não existe.
    if (existingUsers.has(user.id)) continue;

    await prisma.user.create({
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        passwordHash: await argon2.hash(user.seed_password, {
          type: argon2.argon2id,
        }),
      },
    });
  }

  await prisma.request.createMany({
    data: read<SeedRequest>('seed_requests.json').map((row) => ({
      id: row.id,
      requesterId: row.requester_id,
      supplierName: row.supplier_name,
      supplierCnpj: row.supplier_cnpj,
      invoiceNumber: row.invoice_number,
      amountCents: BigInt(row.amount_cents),
      competence: row.competence,
      dueDate: new Date(`${row.due_date}T00:00:00Z`),
      category: toPrismaCategory(row.category),
      description: row.description,
      status: row.status,
      rejectionReason: row.rejection_reason,
      paidAt: row.paid_at ? new Date(row.paid_at) : null,
      paymentReference: row.payment_reference,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    })),
    skipDuplicates: true,
  });

  await prisma.requestStatusEvent.createMany({
    data: read<SeedAuditEvent>('seed_audit_events.json').map((event) => ({
      id: event.id,
      requestId: event.request_id,
      actorId: event.actor_id,
      previousStatus: event.previous_status,
      newStatus: event.new_status,
      reason: event.reason,
      createdAt: new Date(event.created_at),
    })),
    skipDuplicates: true,
  });
}

if (require.main === module) {
  const prisma = new PrismaClient();
  seed(prisma)
    .then(() => prisma.$disconnect())
    .catch(async (error) => {
      console.error(error);
      await prisma.$disconnect();
      process.exit(1);
    });
}
