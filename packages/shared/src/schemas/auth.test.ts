import { describe, expect, it } from 'vitest'
import { loginSchema, refreshSchema } from './auth.js'
import { ENGLISH_DEFAULT, firstIssue, localizedIssues } from './test-helpers.js'

describe('loginSchema', () => {
  it('rejects a missing email', () => {
    const result = loginSchema.safeParse({ password: 'segredo123' })
    const issue = firstIssue(result)

    expect(issue.path).toEqual(['email'])
    expect(issue.message).not.toMatch(ENGLISH_DEFAULT)
  })

  it('rejects a missing password', () => {
    const result = loginSchema.safeParse({ email: 'financeiro@empresa.com' })
    const issue = firstIssue(result)

    expect(issue.path).toEqual(['password'])
    expect(issue.message).not.toMatch(ENGLISH_DEFAULT)
  })

  it('rejects a malformed email', () => {
    const result = loginSchema.safeParse({ email: 'não-é-email', password: 'segredo123' })
    const issue = firstIssue(result)

    expect(issue.path).toEqual(['email'])
    expect(issue.message).toBe('E-mail inválido')
  })

  it('normalizes the email to trimmed lowercase', () => {
    const parsed = loginSchema.parse({ email: '  Financeiro@Empresa.COM ', password: 'segredo123' })
    expect(parsed.email).toBe('financeiro@empresa.com')
  })

  it('accepts a valid login payload', () => {
    expect(() =>
      loginSchema.parse({ email: 'financeiro@empresa.com', password: 'segredo123' }),
    ).not.toThrow()
  })
})

describe('refreshSchema', () => {
  it.each([{}, { refresh_token: '' }, { refresh_token: 42 }])('rejects %j', (input) => {
    const issue = firstIssue(refreshSchema.safeParse(input))

    expect(issue.path).toEqual(['refresh_token'])
    expect(issue.message).toBe('Informe o refresh token')
  })
})

describe('localized error messages', () => {
  it('never leaks an English default message', () => {
    const issues = localizedIssues([
      { name: 'loginSchema', schema: loginSchema, input: {} },
      { name: 'loginSchema (corpo nulo)', schema: loginSchema, input: null },
      { name: 'refreshSchema', schema: refreshSchema, input: {} },
      { name: 'refreshSchema (lista)', schema: refreshSchema, input: [] },
    ])

    for (const { name, message } of issues) {
      expect(message, `${name}: "${message}"`).not.toMatch(ENGLISH_DEFAULT)
    }
  })
})
