import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'

const { version } = JSON.parse(readFileSync('./package.json', 'utf-8')) as { version: string }

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/csp-paperback/',
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  test: {
    environment: 'jsdom',
    // Let jsdom own per-test Web Storage instead of Node's process-wide globals.
    execArgv: ['--no-experimental-webstorage'],
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/test/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'json-summary', 'html'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.d.ts',
        'src/main.tsx',
        'src/test/**',
      ],
      thresholds: {
        statements: 65,
        branches: 61,
        functions: 62,
        lines: 68,
        // Protect core behavior independently of UI code exercised by Playwright.
        'src/engine/**': { statements: 91, branches: 87, functions: 91, lines: 92 },
        'src/store/**': { statements: 86, branches: 80, functions: 89, lines: 89 },
        'src/utils/clip/**': { statements: 90, branches: 84, functions: 87, lines: 93 },
      },
    },
  },
})
