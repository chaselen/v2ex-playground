import { resolve } from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  root: __dirname,
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@douyinfe/semi-ui/dist/css/semi.min.css': resolve(
        __dirname,
        '../node_modules/@douyinfe/semi-ui/dist/css/semi.min.css'
      )
    }
  },
  build: {
    outDir: '../html',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'main.html'),
        topic: resolve(__dirname, 'topic.html')
      }
    }
  }
})
