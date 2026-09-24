import { defineConfig } from 'vitest/config'

// Único gate de cobertura do projeto, e só aqui: dinheiro, CNPJ e a máquina
// de status moram neste pacote, código puro sem I/O e sem desculpa para
// ficar descoberto. Exigir percentual de controller premiaria teste escrito
// só para subir número, não teste que prova algo.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // contracts/ é só tipos e constantes, index.ts só reexporta: sem lógica
      // para exercitar.
      exclude: ['src/**/*.test.ts', 'src/schemas/test-helpers.ts', 'src/contracts/**', 'src/index.ts'],
      thresholds: { lines: 95, functions: 95, branches: 90 },
    },
  },
})
