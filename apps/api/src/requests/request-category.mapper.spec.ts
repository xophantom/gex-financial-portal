import { REQUEST_CATEGORIES } from '@gex/shared'
import { fromPrismaCategory, toPrismaCategory } from './request-category.mapper'

describe('request category mapper', () => {
  it('maps the accented label to the Prisma enum key and back', () => {
    expect(toPrismaCategory('SERVIÇOS')).toBe('SERVICOS')
    expect(fromPrismaCategory('SERVICOS')).toBe('SERVIÇOS')
  })

  it('round-trips every category of the domain', () => {
    for (const category of REQUEST_CATEGORIES) {
      expect(fromPrismaCategory(toPrismaCategory(category))).toBe(category)
    }
  })

  it('throws on an unknown label instead of returning undefined', () => {
    expect(() => toPrismaCategory('UNKNOWN')).toThrow(/unknown request category: UNKNOWN/)
  })

  it('does not accept the unaccented Prisma key as a label', () => {
    expect(() => toPrismaCategory('SERVICOS')).toThrow()
  })
})
