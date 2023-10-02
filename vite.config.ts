/// <reference types="vitest" />

import { defineConfig } from 'vite'

export default defineConfig({
  test: {
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['lcov'],
      exclude: ['packages/*/dist', 'tests/**/*.test.ts'],
      lines: 95,
      functions: 95,
      branches: 95,
      statements: 95
    }
  }
})
