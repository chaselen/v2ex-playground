import { resolve } from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  root: __dirname,
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@extension': resolve(__dirname, '../src')
    }
  },
  build: {
    outDir: '../html',
    emptyOutDir: true,
    chunkSizeWarningLimit: 10000,
    rolldownOptions: {
      input: {
        main: resolve(__dirname, 'main.html'),
        topic: resolve(__dirname, 'topic.html'),
        member: resolve(__dirname, 'member.html'),
        balance: resolve(__dirname, 'balance.html'),
        search: resolve(__dirname, 'search.html'),
        tag: resolve(__dirname, 'tag.html'),
        node: resolve(__dirname, 'node.html'),
        recentBrowse: resolve(__dirname, 'recent-browse.html'),
        twoFactor: resolve(__dirname, 'two-factor.html'),
        theme: resolve(__dirname, 'theme.html')
      }
    }
  }
})
