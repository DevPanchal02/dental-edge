import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: './src/test/setup.ts',
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    css: true,
  },
  server: {
    proxy: {
      '/api/getTopics': {
        target: 'https://gettopics-7ukimtpi4a-uc.a.run.app',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/getTopics/, '')
      },
      '/api/getTopicStructure': {
        target: 'https://gettopicstructure-7ukimtpi4a-uc.a.run.app',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/getTopicStructure/, '')
      },
      '/api/getQuizData': {
        target: 'https://getquizdata-7ukimtpi4a-uc.a.run.app',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/getQuizData/, '')
      }
    }
  }
})