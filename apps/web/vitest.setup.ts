import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// Sem `test.globals`, o Testing Library não registra o cleanup automático e
// o DOM de um teste vazaria para o próximo.
afterEach(() => {
  cleanup()
})
