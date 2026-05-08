import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    proxy: {
      '/newsapi': {
        target: 'https://newsapi.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/newsapi/, '')
      },
      '/issapi': {
        target: 'http://api.open-notify.org',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/issapi/, ''),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader('User-Agent', 'MissionControlDashboard/1.0')
          })
        }
      },
      '/nominatim': {
        target: 'https://nominatim.openstreetmap.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/nominatim/, ''),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader('User-Agent', 'MissionControlDashboard/1.0')
          })
        }
      },
      '/hf-router': {
        target: 'https://router.huggingface.co',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/hf-router/, '')
      },
      '/iss-fallback': {
        target: 'https://api.wheretheiss.at',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/iss-fallback/, '')
      }
    }
  }
})
