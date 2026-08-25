import { resolve } from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  root: import.meta.dirname,
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, 'src'),
      '@extension': resolve(import.meta.dirname, '../src')
    }
  },
  build: {
    outDir: '../html',
    emptyOutDir: true,
    chunkSizeWarningLimit: 10000,
    rolldownOptions: {
      input: {
        main: resolve(import.meta.dirname, 'main.html'),
        topic: resolve(import.meta.dirname, 'topic.html'),
        member: resolve(import.meta.dirname, 'member.html'),
        balance: resolve(import.meta.dirname, 'balance.html'),
        search: resolve(import.meta.dirname, 'search.html'),
        tag: resolve(import.meta.dirname, 'tag.html'),
        node: resolve(import.meta.dirname, 'node.html'),
        recentBrowse: resolve(import.meta.dirname, 'recent-browse.html'),
        createTopic: resolve(import.meta.dirname, 'create-topic.html'),
        twoFactor: resolve(import.meta.dirname, 'two-factor.html'),
        theme: resolve(import.meta.dirname, 'theme.html')
      }
    }
  }
})
