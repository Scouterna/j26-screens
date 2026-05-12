import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  server: {
    proxy: {
      '/_services': {
        target: 'https://app.dev.j26.se',
        changeOrigin: true,
        secure: true,
      },
    },
  },
})