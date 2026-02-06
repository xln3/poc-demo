import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Security: default to localhost-only for dev server.
// If you explicitly need LAN access, set VITE_DEV_HOST=0.0.0.0 (and restrict the port via firewall/security group).
const devHost = process.env.VITE_DEV_HOST || '127.0.0.1'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
  },
  server: {
    host: devHost,
    proxy: {
      '/auth': {
        target: 'http://127.0.0.1:8001',
        changeOrigin: true,
      },
      '/api': {
        target: 'http://127.0.0.1:8001',
        changeOrigin: true,
      },
      '/sandbox': {
        target: 'http://127.0.0.1:8001',
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
        target: 'http://127.0.0.1:8001',
        changeOrigin: true,
      },
      '/rag': {
        target: 'http://127.0.0.1:8001',
        changeOrigin: true,
      },
      '/file-parser': {
        target: 'http://127.0.0.1:8001',
        changeOrigin: true,
      },
      '/cases': {
        target: 'http://127.0.0.1:8001',
        changeOrigin: true,
      },
      '/datasets': {
        target: 'http://127.0.0.1:8001',
        changeOrigin: true,
      },
      '/test-results': {
        target: 'http://127.0.0.1:8001',
        changeOrigin: true,
      },
      '/report-templates': {
        target: 'http://127.0.0.1:8001',
        changeOrigin: true,
      },
      '/mcp': {
        target: 'http://127.0.0.1:8001',
        changeOrigin: true,
      },
      '/clawdbot': {
        target: 'http://127.0.0.1:8001',
        changeOrigin: true,
        ws: true,  // 支持 WebSocket
      },
    },
  },
})
