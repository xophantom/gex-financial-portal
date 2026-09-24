import type { RequestCategory } from '@gex/shared'
import type { RequestCategory as PrismaRequestCategory } from '@prisma/client'

// O enum do Prisma não aceita acento no identificador: a chave é SERVICOS e o
// valor gravado no banco (via @map) é SERVIÇOS. O client expõe a chave; o
// domínio, a API e os dados de seed usam o rótulo com acento. Este é o único
// lugar que conhece as duas grafias — usado pelo repositório e pelo seed.
const PRISMA_TO_CATEGORY = new Map<PrismaRequestCategory, RequestCategory>([
  ['SOFTWARE', 'SOFTWARE'],
  ['SERVICOS', 'SERVIÇOS'],
  ['MARKETING', 'MARKETING'],
  ['INFRAESTRUTURA', 'INFRAESTRUTURA'],
])

// Derivado do mesmo Map para que as duas direções nunca divirjam.
const CATEGORY_TO_PRISMA = new Map<RequestCategory, PrismaRequestCategory>(
  Array.from(PRISMA_TO_CATEGORY, ([key, label]) => [label, key]),
)

export function fromPrismaCategory(category: PrismaRequestCategory): RequestCategory {
  const label = PRISMA_TO_CATEGORY.get(category)
  if (!label) {
    throw new Error(`unknown Prisma request category: ${category}`)
  }
  return label
}

// Aceita string e não só RequestCategory: o seed lê o rótulo de um JSON sem
// tipo, e um valor fora da lista tem que falhar aqui, não virar undefined.
export function toPrismaCategory(label: string): PrismaRequestCategory {
  const key = CATEGORY_TO_PRISMA.get(label as RequestCategory)
  if (!key) {
    throw new Error(`unknown request category: ${label}`)
  }
  return key
}
