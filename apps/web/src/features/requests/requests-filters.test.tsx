import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { withNuqsTestingAdapter, type UrlUpdateEvent } from 'nuqs/adapters/testing'
import { describe, expect, it, vi } from 'vitest'
import { RequestsFilters } from './requests-filters'

function renderFilters(searchParams = '') {
  const onUrlUpdate = vi.fn<(event: UrlUpdateEvent) => void>()
  render(<RequestsFilters />, {
    wrapper: withNuqsTestingAdapter({ searchParams, onUrlUpdate, hasMemory: true }),
  })
  const lastUpdate = () => onUrlUpdate.mock.calls.at(-1)![0]
  return { onUrlUpdate, lastUpdate }
}

describe('RequestsFilters', () => {
  it('writes the chosen status to the URL', async () => {
    const { lastUpdate } = renderFilters()

    await userEvent.selectOptions(screen.getByLabelText(/status/i), 'APPROVED')

    expect(lastUpdate().searchParams.get('status')).toBe('APPROVED')
  })

  it('writes the typed supplier to the URL', async () => {
    const { lastUpdate } = renderFilters()

    await userEvent.type(screen.getByLabelText(/fornecedor/i), 'Aurora')

    await waitFor(() => expect(lastUpdate().searchParams.get('supplier')).toBe('Aurora'))
  })

  // Com shallow: true (padrão do nuqs) só a URL muda no cliente: o Server
  // Component que busca a lista não roda de novo e a tabela fica velha.
  it('asks the server for fresh data on every filter change', async () => {
    const { onUrlUpdate, lastUpdate } = renderFilters()

    await userEvent.selectOptions(screen.getByLabelText(/status/i), 'PENDING')
    await userEvent.type(screen.getByLabelText(/fornecedor/i), 'A')
    fireEvent.change(screen.getByLabelText(/vencimento de/i), { target: { value: '2026-09-01' } })
    fireEvent.change(screen.getByLabelText(/vencimento até/i), { target: { value: '2026-09-30' } })

    await waitFor(() => expect(lastUpdate().searchParams.get('due_to')).toBe('2026-09-30'))
    for (const [event] of onUrlUpdate.mock.calls) {
      expect(event.options.shallow).toBe(false)
    }
  })

  it('uses native date inputs for the due-date range', () => {
    renderFilters()

    expect(screen.getByLabelText(/vencimento de/i)).toHaveAttribute('type', 'date')
    expect(screen.getByLabelText(/vencimento até/i)).toHaveAttribute('type', 'date')
  })

  it('writes both due-date bounds to the URL', async () => {
    const { lastUpdate } = renderFilters('?due_from=2026-09-01')

    fireEvent.change(screen.getByLabelText(/vencimento até/i), { target: { value: '2026-09-30' } })

    await waitFor(() => {
      expect(lastUpdate().searchParams.get('due_from')).toBe('2026-09-01')
      expect(lastUpdate().searchParams.get('due_to')).toBe('2026-09-30')
    })
  })

  // Sem isto, o usuário filtra estando na página 4 e cai numa lista vazia.
  it('resets page back to 1 when the status filter changes', async () => {
    const { lastUpdate } = renderFilters('?page=4')

    await userEvent.selectOptions(screen.getByLabelText(/status/i), 'PENDING')

    expect(lastUpdate().searchParams.get('page') ?? '1').toBe('1')
  })

  it('resets page back to 1 when the supplier filter changes', async () => {
    const { onUrlUpdate, lastUpdate } = renderFilters('?page=4')

    await userEvent.type(screen.getByLabelText(/fornecedor/i), 'B')

    await waitFor(() => expect(onUrlUpdate).toHaveBeenCalled())
    expect(lastUpdate().searchParams.get('page') ?? '1').toBe('1')
  })

  it('resets page back to 1 when a due-date bound changes', async () => {
    const { onUrlUpdate, lastUpdate } = renderFilters('?page=4')

    fireEvent.change(screen.getByLabelText(/vencimento de/i), { target: { value: '2026-09-01' } })

    await waitFor(() => expect(onUrlUpdate).toHaveBeenCalled())
    expect(lastUpdate().searchParams.get('page') ?? '1').toBe('1')
  })
})
