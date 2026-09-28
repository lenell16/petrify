import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { fixtureResponse } from './api.js'

const root = fileURLToPath(new URL('..', import.meta.url))

export default defineConfig({
  root,
  plugins: [react(), {
    name: 'fixture-routes',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const url = new URL(request.url ?? '/', 'http://127.0.0.1:5174')
        if (url.pathname.startsWith('/api/v1/')) {
          response.setHeader('Content-Type', 'application/json')
          response.setHeader('Access-Control-Allow-Origin', '*')
          const payload = fixtureResponse(url)
          response.statusCode = payload ? 200 : 404
          response.end(JSON.stringify(payload ?? { error: 'Unknown fixture media' }))
          return
        }
        if (/^\/(?:$|fieldnotes\/?$|fieldnotes\/(?:p|reel|reels)\/|p\/|reel\/|reels\/?|stories\/)/.test(url.pathname)) {
          request.url = '/fixtures/instagram.html'
        }
        next()
      })
    },
  }],
  resolve: { alias: { '@': path.join(root, 'src') } },
  server: { host: '127.0.0.1', port: 5174, strictPort: true, cors: true },
})
