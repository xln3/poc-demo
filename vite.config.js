import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    host: '0.0.0.0',  // 监听所有接口，允许局域网访问
    proxy: {
      '/sandbox': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        ws: true,
        // 转发客户端真实 IP
        configure: (proxy, options) => {
          proxy.on('proxyReq', (proxyReq, req, res) => {
            const clientIp = req.socket.remoteAddress?.replace('::ffff:', '') || '127.0.0.1';
            proxyReq.setHeader('X-Forwarded-For', clientIp);
            proxyReq.setHeader('X-Real-IP', clientIp);
          });
        },
      },
      '/health': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/rag': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/file-parser': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/cases': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/datasets': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/test-results': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/report-templates': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/mcp': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/clawdbot': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        ws: true,  // 支持 WebSocket
      },
    },
  },
})
