import { beforeEach, describe, expect, it, vi } from 'vitest'
import { __resetRefreshState, refreshOnce } from './refresh'

describe('refreshOnce', () => {
  beforeEach(() => __resetRefreshState())

  it('issues a single refresh call when several requests race on the same session', async () => {
    const refresh = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20))
      return { access_token: 'new', refresh_token: 'new-refresh' }
    })

    const results = await Promise.all([
      refreshOnce('session-a', refresh),
      refreshOnce('session-a', refresh),
      refreshOnce('session-a', refresh),
    ])

    // Sem coalescência, cada chamada rotacionaria o refresh token e
    // invalidaria o das outras: uma navegação normal deslogaria o usuário.
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(results.every((token) => token.access_token === 'new')).toBe(true)
  })

  it('allows a new refresh after the previous one settles', async () => {
    const refresh = vi.fn(async () => ({ access_token: 'a', refresh_token: 'b' }))

    await refreshOnce('session-a', refresh)
    await refreshOnce('session-a', refresh)

    expect(refresh).toHaveBeenCalledTimes(2)
  })

  it('propagates the failure to every waiter and clears the pending state', async () => {
    const failing = vi.fn(async () => {
      throw new Error('expired')
    })

    await expect(
      Promise.all([refreshOnce('session-a', failing), refreshOnce('session-a', failing)]),
    ).rejects.toThrow('expired')
    expect(failing).toHaveBeenCalledTimes(1)

    const working = vi.fn(async () => ({ access_token: 'c', refresh_token: 'd' }))
    await expect(refreshOnce('session-a', working)).resolves.toMatchObject({
      access_token: 'c',
    })
  })

  it('coalesces per session: two different sessions never share a promise', async () => {
    // Uma trava única de módulo coalesceria o refresh de QUALQUER usuário
    // com o de outro, e quem perdesse a corrida receberia o token de acesso
    // da conta alheia — sequestro de sessão. Ana e
    // Bruno correm em paralelo com chaves (refresh tokens) diferentes: cada
    // um precisa rodar o PRÓPRIO closure e receber o PRÓPRIO token.
    const refreshAna = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20))
      return { access_token: 'TOKEN-DA-ANA', refresh_token: 'refresh-ana-2' }
    })
    const refreshBruno = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20))
      return { access_token: 'TOKEN-DO-BRUNO', refresh_token: 'refresh-bruno-2' }
    })

    const [ana, bruno] = await Promise.all([
      refreshOnce('refresh-ana-1', refreshAna),
      refreshOnce('refresh-bruno-1', refreshBruno),
    ])

    expect(refreshAna).toHaveBeenCalledTimes(1)
    expect(refreshBruno).toHaveBeenCalledTimes(1)
    expect(ana.access_token).toBe('TOKEN-DA-ANA')
    expect(bruno.access_token).toBe('TOKEN-DO-BRUNO')
  })
})
