import { resolve } from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import semiTheming from '@douyinfe/semi-vite-plugin'

/** 构建日志 */
type BuildLog = {
  code?: string
  id?: string | null
}

/** lottie-web 的 direct eval 已知警告 */
const isLottieDirectEvalWarning = (log: BuildLog) => {
  const id = log.id?.replaceAll('\\', '/')

  return log.code === 'EVAL' && Boolean(id?.includes('node_modules/lottie-web/'))
}

export default defineConfig({
  root: __dirname,
  base: './',
  plugins: [semiTheming({ cssLayer: true }), react()],
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
      onLog(level, log, defaultHandler) {
        if (level === 'warn' && isLottieDirectEvalWarning(log)) {
          return
        }

        defaultHandler(level, log)
      },
      input: {
        main: resolve(__dirname, 'main.html'),
        topic: resolve(__dirname, 'topic.html'),
        member: resolve(__dirname, 'member.html'),
        balance: resolve(__dirname, 'balance.html'),
        search: resolve(__dirname, 'search.html'),
        twoFactor: resolve(__dirname, 'two-factor.html'),
        theme: resolve(__dirname, 'theme.html')
      }
    }
  }
})
