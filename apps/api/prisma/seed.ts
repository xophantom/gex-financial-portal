import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PrismaClient, RequestCategory } from '@prisma/client'
import argon2 from 'argon2'

const DATA = join(__dirname, '../../../data')

const read = <T>(file: string): T[] =>
  JSON.parse(readFileSync(join(DATA, file), 'utf8')) as T[]

// O client do Prisma expõe o enum pelo nome declarado no schema (SERVICOS),
// não pelo valor mapeado para o banco (SERVIÇOS) — o dado de origem traz o
// valor com acento, então é preciso traduzir antes de passar para o client.
const CATEGORY_BY_LABEL = new Map<string, RequestCategory>([
  ['SOFTWARE', 'SOFTWARE'],
  ['SERVIÇOS', 'SERVICOS'],
  ['MARKETING', 'MARKETING'],
  ['INFRAESTRUTURA', 'INFRAESTRUTURA'],
])

export function toRequestCategory(label: string): RequestCategory {
  const category = CATEGORY_BY_LABEL.get(label)
  if (!category) {
    throw new Error(`unknown request category: ${label}`)
  }
  return category
}

export async function seed(prisma: PrismaClient): Promise<void> {
  for (const user of read<Record<string, string>>('seed_users.json')) {
    const passwordHash = await argon2.hash(user.seed_password, { type: argon2.argon2id })
    const data = {
      name: user.name,
      email: user.email,
      role: user.role as 'REQUESTER' | 'FINANCE',
      passwordHash,
    }

    await prisma.user.upsert({ where: { id: user.id }, create: { id: user.id, ...data }, update: data })
  }

  for (const row of read<Record<string, never>>('seed_requests.json')) {
    const data = {
      requesterId: row.requester_id,
      supplierName: row.supplier_name,
      supplierCnpj: row.supplier_cnpj,
      invoiceNumber: row.invoice_number,
      amountCents: BigInt(row.amount_cents),
      competence: row.competence,
      dueDate: new Date(`${row.due_date}T00:00:00Z`),
      category: toRequestCategory(row.category),
      description: row.description,
      status: row.status,
      rejectionReason: row.rejection_reason,
      paidAt: row.paid_at ? new Date(row.paid_at) : null,
      paymentReference: row.payment_reference,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }

    await prisma.request.upsert({ where: { id: row.id }, create: { id: row.id, ...data }, update: data })
  }

  for (const event of read<Record<string, never>>('seed_audit_events.json')) {
    const data = {
      requestId: event.request_id,
      actorId: event.actor_id,
      previousStatus: event.previous_status,
      newStatus: event.new_status,
      reason: event.reason,
      createdAt: new Date(event.created_at),
    }

    await prisma.requestStatusEvent.upsert({
      where: { id: event.id },
      create: { id: event.id, ...data },
      update: data,
    })
  }
}

if (require.main === module) {
  const prisma = new PrismaClient()
  seed(prisma)
    .then(() => prisma.$disconnect())
    .catch(async (error) => {
      console.error(error)
      await prisma.$disconnect()
      process.exit(1)
    })
}
