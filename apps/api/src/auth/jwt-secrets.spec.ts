import { resolveJwtRefreshSecret, resolveJwtSecret } from './jwt-secrets'

describe('jwt-secrets', () => {
  const original = { ...process.env }

  afterEach(() => {
    process.env = { ...original }
  })

  it('throws naming JWT_SECRET when it is missing', () => {
    delete process.env.JWT_SECRET
    expect(() => resolveJwtSecret()).toThrow(/JWT_SECRET/)
  })

  it('throws naming JWT_SECRET when it is empty', () => {
    process.env.JWT_SECRET = ''
    expect(() => resolveJwtSecret()).toThrow(/JWT_SECRET/)
  })

  it('returns the configured value when JWT_SECRET is set', () => {
    process.env.JWT_SECRET = 'a-real-secret'
    expect(resolveJwtSecret()).toBe('a-real-secret')
  })

  it('throws naming JWT_REFRESH_SECRET when it is missing', () => {
    delete process.env.JWT_REFRESH_SECRET
    expect(() => resolveJwtRefreshSecret()).toThrow(/JWT_REFRESH_SECRET/)
  })

  it('throws naming JWT_REFRESH_SECRET when it is empty', () => {
    process.env.JWT_REFRESH_SECRET = ''
    expect(() => resolveJwtRefreshSecret()).toThrow(/JWT_REFRESH_SECRET/)
  })

  it('returns the configured value when JWT_REFRESH_SECRET is set', () => {
    process.env.JWT_REFRESH_SECRET = 'another-real-secret'
    expect(resolveJwtRefreshSecret()).toBe('another-real-secret')
  })
})
