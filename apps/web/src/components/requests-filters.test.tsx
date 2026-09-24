import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'
import type { UrlUpdateEvent } from 'nuqs/adapters/testing'
import { describe, expect, it, vi } from 'vitest'
import { RequestsFilters } from './requests-filters'

function renderFilters(searchParams: string, onUrlUpdate: (event: UrlUpdateEvent) => void) {
  return render(<RequestsFilters />, {
    wrapper: ({ children }) => (
      <NuqsTestingAdapter searchParams={searchParams} onUrlUpdate={onUrlUpdate} hasMemory>
        {children}
      </NuqsTestingAdapter>
    ),
  })
}

describe('RequestsFilters', () => {
  it('writes the chosen status to the URL', async () => {
    const onUrlUpdate = vi.fn()
    renderFilters('', onUrlUpdate)

    await userEvent.selectOptions(screen.getByLabelText(/status/i), 'APPROVED')

    const last = onUrlUpdate.mock.calls.at(-1)![0] as UrlUpdateEvent
    expect(last.searchParams.get('status')).toBe('APPROVED')
  })

  it('writes the typed supplier to the URL', async () => {
    const onUrlUpdate = vi.fn()
    renderFilters('', onUrlUpdate)

    await userEvent.type(screen.getByLabelText(/fornecedor/i), 'Aurora')

    const last = onUrlUpdate.mock.calls.at(-1)![0] as UrlUpdateEvent
    expect(last.searchParams.get('supplier')).toBe('Aurora')
  })

  // Sem isto, o usuário filtra estando na página 4 e cai numa lista vazia —
  // a página antiga não existe mais para o novo conjunto de resultados.
  it('resets page back to 1 when the status filter changes', async () => {
    const onUrlUpdate = vi.fn()
    renderFilters('?page=4', onUrlUpdate)

    await userEvent.selectOptions(screen.getByLabelText(/status/i), 'PENDING')

    const last = onUrlUpdate.mock.calls.at(-1)![0] as UrlUpdateEvent
    expect(last.searchParams.get('page') ?? '1').toBe('1')
  })

  it('resets page back to 1 when the supplier filter changes', async () => {
    const onUrlUpdate = vi.fn()
    renderFilters('?page=4', onUrlUpdate)

    await userEvent.type(screen.getByLabelText(/fornecedor/i), 'B')

    const last = onUrlUpdate.mock.calls.at(-1)![0] as UrlUpdateEvent
    expect(last.searchParams.get('page') ?? '1').toBe('1')
  })

  it('resets page back to 1 when a due-date bound changes', async () => {
    const onUrlUpdate = vi.fn()
    renderFilters('?page=4', onUrlUpdate)

    await userEvent.type(screen.getByLabelText(/vencimento de/i), '2026-09-01')

    const last = onUrlUpdate.mock.calls.at(-1)![0] as UrlUpdateEvent
    expect(last.searchParams.get('page') ?? '1').toBe('1')
  })
})
