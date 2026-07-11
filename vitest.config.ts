import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, new URL('.', import.meta.url).pathname, 'V2EX_')

  return {
    resolve: {
      alias: {
        '@': new URL('./src', import.meta.url).pathname
      }
    },
    test: {
      env,
      environment: 'node',
      fileParallelism: true,
      hookTimeout: 60000,
      include: ['src/**/*.test.ts'],
      maxConcurrency: 5,
      sequence: {
        concurrent: false
      },
      testTimeout: 60000
    }
  }
})
