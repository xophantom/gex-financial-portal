import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// @testing-library/react só registra o cleanup automático se enxergar um
// `afterEach` GLOBAL (globalThis.afterEach) — e este projeto não liga
// `test.globals` no vitest.config.ts, então o afterEach importado por cada
// arquivo de teste é escopado ao módulo, não global. Sem isto, o DOM de um
// teste vaza para o próximo dentro do mesmo arquivo (múltiplos <button>
// "Entrar" no documento), quebrando getByRole/getByLabelText.
afterEach(() => {
  cleanup()
})
