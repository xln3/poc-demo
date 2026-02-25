import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Security: default to localhost-only for dev server.
// If you explicitly need LAN access, set VITE_DEV_HOST=0.0.0.0 (and restrict the port via firewall/security group).
const devHost = process.env.VITE_DEV_HOST || '127.0.0.1'
const backendTarget = process.env.VITE_BACKEND_URL || 'http://127.0.0.1:8000'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          i18n: ['i18next', 'react-i18next', 'i18next-browser-languagedetector'],
          scenarios: [
            './src/scenarios/index.js',
          ],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
  },
  server: {
    host: devHost,
    proxy: {
      '/auth': {
        target: backendTarget,
        changeOrigin: true,
      },
      '/api': {
        target: backendTarget,
        changeOrigin: true,
      },
      '/sandbox': {
        target: backendTarget,
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
        target: backendTarget,
        changeOrigin: true,
      },
      '/rag': {
        target: backendTarget,
        changeOrigin: true,
      },
      '/file-parser': {
        target: backendTarget,
        changeOrigin: true,
      },
      '/cases': {
        target: backendTarget,
        changeOrigin: true,
      },
      '/datasets': {
        target: backendTarget,
        changeOrigin: true,
      },
      '/test-results': {
        target: backendTarget,
        changeOrigin: true,
      },
      '/report-templates': {
        target: backendTarget,
        changeOrigin: true,
      },
      '/mcp': {
        target: backendTarget,
        changeOrigin: true,
      },
      '/clawdbot': {
        target: backendTarget,
        changeOrigin: true,
        ws: true,
      },
      '/eval-import': {
        target: backendTarget,
        changeOrigin: true,
      },
      '/simulator': {
        target: backendTarget,
        changeOrigin: true,
        ws: true,
      },
      '/benchmarks': {
        target: backendTarget,
        changeOrigin: true,
      },
    },
  },
})
