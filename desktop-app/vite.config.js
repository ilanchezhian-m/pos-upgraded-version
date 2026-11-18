import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: './', // Crucial for Electron file:// protocol
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
  },
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url === '/favicon.ico') {
        res.statusCode = 302
        res.setHeader('Location', '/favicon.svg')
        res.end()
        return
      }
      next()
    })
  },
})
