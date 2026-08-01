import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages 部署时 base 设为仓库名 /pds-tool/
// 本地开发时保持 /
const isProd = process.env.NODE_ENV === 'production'
const base = isProd ? '/pds-tool/' : '/'

export default defineConfig({
  base,
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
  build: {
    outDir: '../backend/static',
    emptyOutDir: true,
  },
})