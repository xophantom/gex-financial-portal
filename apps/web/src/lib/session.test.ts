import { beforeEach, describe, expect, it, vi } from 'vitest'
import { __resetRefreshState, refreshOnce } from './session'

describe('refreshOnce', () => {
  beforeEach(() => __resetRefreshState())

  it('issues a single refresh call when several requests race', async () => {
    const refresh = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20))
      return { access_token: 'new', refresh_token: 'new-refresh' }
    })

    const results = await Promise.all([
      refreshOnce(refresh),
      refreshOnce(refresh),
      refreshOnce(refresh),
    ])

    // Sem coalescência, cada chamada rotacionaria o refresh token e
    // invalidaria o das outras: uma navegação normal deslogaria o usuário.
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(results.every((token) => token.access_token === 'new')).toBe(true)
  })

  it('allows a new refresh after the previous one settles', async () => {
    const refresh = vi.fn(async () => ({ access_token: 'a', refresh_token: 'b' }))

    await refreshOnce(refresh)
    await refreshOnce(refresh)

    expect(refresh).toHaveBeenCalledTimes(2)
  })

  it('propagates the failure to every waiter and clears the pending state', async () => {
    const failing = vi.fn(async () => {
      throw new Error('expired')
    })

    await expect(Promise.all([refreshOnce(failing), refreshOnce(failing)])).rejects.toThrow(
      'expired',
    )
    expect(failing).toHaveBeenCalledTimes(1)

    const working = vi.fn(async () => ({ access_token: 'c', refresh_token: 'd' }))
    await expect(refreshOnce(working)).resolves.toMatchObject({ access_token: 'c' })
  })
})
