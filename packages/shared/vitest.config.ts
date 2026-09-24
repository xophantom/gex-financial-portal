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
      // errors.ts é só tipos e uma lista de constantes (sem função, sem
      // branch); index.ts só reexporta os outros módulos. Nenhum dos dois
      // tem lógica própria para o teste exercitar — contá-los reduziria o
      // gate a perseguir 100% de arquivo vazio em vez de dinheiro/CNPJ/status.
      exclude: ['src/**/*.test.ts', 'src/errors.ts', 'src/index.ts'],
      thresholds: { lines: 95, functions: 95, branches: 90 },
    },
  },
})
