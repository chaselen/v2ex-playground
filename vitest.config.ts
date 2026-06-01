import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname
    }
  },
  test: {
    environment: 'node',
    fileParallelism: false,
    hookTimeout: 60000,
    include: ['src/**/*.test.ts'],
    sequence: {
      concurrent: false
    },
    testTimeout: 60000
  }
})
