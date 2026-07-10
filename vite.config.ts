import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: true,  // 暴露到局域网，方便手机同 WiFi 调试
    hmr: false,  // Disable HMR to prevent crashes on Windows when editing files
    proxy: {
      '/api': {
        // 指向 VPS 上的 API（避免连本地 3002 端口没有 RPC 权限导致验证失败）
        target: 'http://103.119.13.58:3002',
        changeOrigin: true,
      },
    },
  },
  build: {
    target: 'esnext',
    cssCodeSplit: true,
    reportCompressedSize: false,  // 加快构建速度
  },
})
