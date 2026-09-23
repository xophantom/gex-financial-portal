import { describe, expect, it } from 'vitest'
import {
  REQUEST_STATUSES,
  REQUEST_ACTIONS,
  allowedActionsFor,
  canTransition,
  nextStatusFor,
} from './status'

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

describe('Guard: nextStatusFor invalid action', () => {
  it('throws for an invalid action', () => {
    const invalidAction = 'INVALID_ACTION' as never
    expect(() => nextStatusFor(invalidAction)).toThrow('Ação inválida: INVALID_ACTION')
  })
})

describe('Guard: canTransition invalid statuses', () => {
  it('throws for an invalid from status', () => {
    const invalidStatus = 'BOGUS' as never
    expect(() => canTransition(invalidStatus, 'PAID')).toThrow('Status inválido: BOGUS')
  })

  it('throws for an invalid to status', () => {
    const invalidStatus = 'BOGUS' as never
    expect(() => canTransition('PENDING', invalidStatus)).toThrow('Status inválido: BOGUS')
  })
})

describe('Regression: existing behavior still works', () => {
  it('still allows legal transitions', () => {
    expect(canTransition('PENDING', 'APPROVED')).toBe(true)
    expect(canTransition('PENDING', 'REJECTED')).toBe(true)
    expect(canTransition('APPROVED', 'PAID')).toBe(true)
  })

  it('still offers correct actions for finance on PENDING', () => {
    expect(allowedActionsFor('PENDING', 'FINANCE')).toEqual(['APPROVE', 'REJECT'])
  })

  it('still offers nothing to requester', () => {
    expect(allowedActionsFor('PENDING', 'REQUESTER')).toEqual([])
  })
})

describe('Invariant: every action is available somewhere', () => {
  it('ensures no dead actions', () => {
    for (const action of REQUEST_ACTIONS) {
      const available = REQUEST_STATUSES.some((status) =>
        allowedActionsFor(status, 'FINANCE').includes(action)
      )
      expect(available).toBe(true)
    }
  })
})
