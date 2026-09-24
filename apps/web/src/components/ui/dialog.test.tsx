import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { DialogOverlay } from './dialog'

function Harness() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Abrir
      </button>
      {open && (
        <DialogOverlay onClose={() => setOpen(false)}>
          <div role="dialog" aria-label="Exemplo">
            <label htmlFor="campo">Campo</label>
            <input id="campo" />
          </div>
        </DialogOverlay>
      )}
    </>
  )
}

describe('DialogOverlay', () => {
  it('focuses the first field on open and gives focus back to the opener on Escape', async () => {
    render(<Harness />)
    const opener = screen.getByRole('button', { name: 'Abrir' })

    await userEvent.click(opener)
    expect(screen.getByLabelText('Campo')).toHaveFocus()

    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(opener).toHaveFocus()
  })

  it('closes when the backdrop is clicked', async () => {
    const onClose = vi.fn()
    render(
      <DialogOverlay onClose={onClose}>
        <p>Conteúdo</p>
      </DialogOverlay>,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('stops listening for Escape once unmounted', async () => {
    const onClose = vi.fn()
    const { unmount } = render(
      <DialogOverlay onClose={onClose}>
        <p>Conteúdo</p>
      </DialogOverlay>,
    )

    unmount()
    await userEvent.keyboard('{Escape}')
    expect(onClose).not.toHaveBeenCalled()
  })
})
