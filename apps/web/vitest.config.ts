import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': resolve(__dirname, './src') } },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    // Todo o código da aplicação, rotas do BFF (src/app/api/**) incluídas,
    // mora em src/.
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
