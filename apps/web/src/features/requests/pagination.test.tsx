import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { withNuqsTestingAdapter, type UrlUpdateEvent } from 'nuqs/adapters/testing'
import { describe, expect, it, vi } from 'vitest'
import { Pagination } from './pagination'

function renderPagination(page: number, totalPages: number, searchParams = '') {
  const onUrlUpdate = vi.fn<(event: UrlUpdateEvent) => void>()
  render(<Pagination page={page} totalPages={totalPages} />, {
    wrapper: withNuqsTestingAdapter({ searchParams, onUrlUpdate, hasMemory: true }),
  })
  return onUrlUpdate
}

describe('Pagination', () => {
  it('renders nothing when there is a single page', () => {
    const { container } = render(<Pagination page={1} totalPages={1} />, {
      wrapper: withNuqsTestingAdapter(),
    })
    expect(container).toBeEmptyDOMElement()
  })

  it('moves to the next page keeping the current filters', async () => {
    const onUrlUpdate = renderPagination(2, 5, '?status=PENDING&page=2')

    await userEvent.click(screen.getByRole('button', { name: /próxima/i }))

    await waitFor(() => expect(onUrlUpdate).toHaveBeenCalledTimes(1))
    const [event] = onUrlUpdate.mock.calls[0]
    expect(event.searchParams.get('page')).toBe('3')
    expect(event.searchParams.get('status')).toBe('PENDING')
  })

  // shallow: true só trocaria a URL no cliente, sem recarregar a lista.
  it('asks the server for the new page', async () => {
    const onUrlUpdate = renderPagination(2, 5, '?page=2')

    await userEvent.click(screen.getByRole('button', { name: /anterior/i }))

    await waitFor(() => expect(onUrlUpdate).toHaveBeenCalledTimes(1))
    expect(onUrlUpdate.mock.calls[0][0].options.shallow).toBe(false)
  })

  it('disables the buttons at the edges', () => {
    renderPagination(1, 3)

    expect(screen.getByRole('button', { name: /anterior/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /próxima/i })).toBeEnabled()
  })
})
