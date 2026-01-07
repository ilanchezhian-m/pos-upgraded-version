import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
