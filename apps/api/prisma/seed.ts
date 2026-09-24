import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { PrismaClient, RequestCategory } from '@prisma/client'
import argon2 from 'argon2'

// __dirname muda entre dev (prisma/) e build (dist/prisma/), então sobe a
// árvore até achar data/ em vez de fixar a quantidade de "../".
function findDataDir(start: string): string {
  let dir = start
  for (let i = 0; i < 8; i += 1) {
    const candidate = join(dir, 'data')
    if (existsSync(candidate)) return candidate
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  throw new Error(`could not locate the data/ directory upward from ${start}`)
}

const DATA = findDataDir(__dirname)

const read = <T>(file: string): T[] =>
  JSON.parse(readFileSync(join(DATA, file), 'utf8')) as T[]

// O client do Prisma usa a chave do enum (SERVICOS), não o valor com acento
// do @map que vem nos dados de origem.
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

// Roda a cada boot do container, então só cria o que falta: sobrescrever
// linhas existentes desfaria transições feitas pela aplicação e deixaria os
// eventos de auditoria novos incoerentes com o status.
export async function seed(prisma: PrismaClient): Promise<void> {
  const existingUsers = new Set(
    (await prisma.user.findMany({ select: { id: true } })).map(({ id }) => id),
  )

  for (const user of read<Record<string, string>>('seed_users.json')) {
    // argon2 é caro de propósito: só calcula para quem ainda não existe.
    if (existingUsers.has(user.id)) continue

    await prisma.user.create({
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role as 'REQUESTER' | 'FINANCE',
        passwordHash: await argon2.hash(user.seed_password, { type: argon2.argon2id }),
      },
    })
  }

  await prisma.request.createMany({
    data: read<Record<string, never>>('seed_requests.json').map((row) => ({
      id: row.id,
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
    })),
    skipDuplicates: true,
  })

  await prisma.requestStatusEvent.createMany({
    data: read<Record<string, never>>('seed_audit_events.json').map((event) => ({
      id: event.id,
      requestId: event.request_id,
      actorId: event.actor_id,
      previousStatus: event.previous_status,
      newStatus: event.new_status,
      reason: event.reason,
      createdAt: new Date(event.created_at),
    })),
    skipDuplicates: true,
  })
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
