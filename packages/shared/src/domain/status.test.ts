import { describe, expect, it } from 'vitest'
import {
  REQUEST_STATUSES,
  REQUEST_ACTIONS,
  allowedActionsFor,
  canTransition,
  nextStatusFor,
} from './status.js'

describe('canTransition', () => {
  it.each([
    ['PENDING', 'APPROVED'],
    ['PENDING', 'REJECTED'],
    ['APPROVED', 'PAID'],
  ] as const)('allows %s to %s', (from, to) => {
    expect(canTransition(from, to)).toBe(true)
  })

  it('refuses every transition that is not explicitly allowed', () => {
    const allowed = new Set(['PENDING>APPROVED', 'PENDING>REJECTED', 'APPROVED>PAID'])

    for (const from of REQUEST_STATUSES) {
      for (const to of REQUEST_STATUSES) {
        if (allowed.has(`${from}>${to}`)) continue
        expect(canTransition(from, to)).toBe(false)
      }
    }
  })

  it('never lets a final state be reverted', () => {
    for (const to of REQUEST_STATUSES) {
      expect(canTransition('REJECTED', to)).toBe(false)
      expect(canTransition('PAID', to)).toBe(false)
    }
  })

  it('refuses repeating the same status', () => {
    for (const status of REQUEST_STATUSES) {
      expect(canTransition(status, status)).toBe(false)
    }
  })
})

describe('nextStatusFor', () => {
  it.each([
    ['APPROVE', 'APPROVED'],
    ['REJECT', 'REJECTED'],
    ['MARK_PAID', 'PAID'],
  ] as const)('maps %s to %s', (action, status) => {
    expect(nextStatusFor(action)).toBe(status)
  })
})

describe('allowedActionsFor', () => {
  it('offers approve and reject on a pending request to finance', () => {
    expect(allowedActionsFor('PENDING', 'FINANCE')).toEqual(['APPROVE', 'REJECT'])
  })

  it('offers mark-paid on an approved request to finance', () => {
    expect(allowedActionsFor('APPROVED', 'FINANCE')).toEqual(['MARK_PAID'])
  })

  it.each(REQUEST_STATUSES)('offers nothing to a requester on %s', (status) => {
    expect(allowedActionsFor(status, 'REQUESTER')).toEqual([])
  })

  it.each(['REJECTED', 'PAID'] as const)(
    'offers nothing to finance on the final state %s',
    (status) => {
      expect(allowedActionsFor(status, 'FINANCE')).toEqual([])
    },
  )
})

// Valores fora da união chegam em runtime (JSON, banco): a máquina recusa em
// vez de responder com undefined, inclusive nomes do protótipo de Object.
describe('invalid input', () => {
  it('throws for an invalid action', () => {
    expect(() => nextStatusFor('INVALID_ACTION' as never)).toThrow('Ação inválida: INVALID_ACTION')
  })

  it('throws for an invalid from or to status', () => {
    expect(() => canTransition('BOGUS' as never, 'PAID')).toThrow('Status inválido: BOGUS')
    expect(() => canTransition('PENDING', 'BOGUS' as never)).toThrow('Status inválido: BOGUS')
  })

  it.each(['constructor', 'toString', 'valueOf', 'hasOwnProperty'])(
    'throws for the prototype name %s',
    (name) => {
      expect(() => nextStatusFor(name as never)).toThrow(`Ação inválida: ${name}`)
      expect(() => canTransition(name as never, 'PAID')).toThrow(`Status inválido: ${name}`)
      expect(() => canTransition('PENDING', name as never)).toThrow(`Status inválido: ${name}`)
    },
  )
})

describe('actions and transitions stay consistent', () => {
  it('makes every action available from some status', () => {
    for (const action of REQUEST_ACTIONS) {
      const available = REQUEST_STATUSES.some((status) =>
        allowedActionsFor(status, 'FINANCE').includes(action),
      )
      expect(available).toBe(true)
    }
  })
})
