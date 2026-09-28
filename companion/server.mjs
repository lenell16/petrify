import { createServer } from 'node:http'
import { timingSafeEqual } from 'node:crypto'
import { Readable } from 'node:stream'

const MAX_BYTES = 500 * 1024 * 1024

function validPath(value) {
  return typeof value === 'string' && value.length <= 1024 && value.length > 0 &&
    value.split('/').every((segment) => segment && segment !== '.' && segment !== '..' &&
      !/[\\:\u0000-\u001f]/.test(segment) && segment.trim() === segment)
}

export function createCompanionServer({ destinations, token }) {
  const pending = new Map()
  const server = createServer(async (request, response) => {
    const origin = request.headers.origin
    if (origin && /^chrome-extension:\/\/[a-z]{32}$/.test(origin)) {
      response.setHeader('Access-Control-Allow-Origin', origin)
      response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Petrify-Path, X-Petrify-Destination')
      response.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS')
      response.setHeader('Vary', 'Origin')
    }
    if (request.method === 'OPTIONS') {
      response.writeHead(origin && /^chrome-extension:\/\/[a-z]{32}$/.test(origin) ? 204 : 403).end()
      return
    }
    const provided = request.headers.authorization?.replace(/^Bearer /, '') ?? ''
    const expected = Buffer.from(token)
    const supplied = Buffer.from(provided)
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
      response.writeHead(401).end('Unauthorized')
      return
    }
    if (request.method === 'GET' && request.url === '/health') {
      response.writeHead(200).end('OK')
      return
    }
    if (request.method === 'GET' && request.url === '/destinations') {
      response.setHeader('Content-Type', 'application/json')
      response.writeHead(200).end(JSON.stringify([...destinations.values()].map(({ id, label, provider, providerName }) => ({ id, label, provider, providerName }))))
      return
    }
    if (request.method === 'POST' && request.url === '/stop') {
      response.writeHead(200).end('Stopping')
      server.close()
      return
    }
    if (request.method !== 'PUT' || request.url !== '/files') {
      response.writeHead(404).end('Not found')
      return
    }
    const key = request.headers['x-petrify-path']
    if (!validPath(key)) {
      response.writeHead(400).end('Invalid file path')
      return
    }
    const destinationId = request.headers['x-petrify-destination']
    const destination = destinations.get(destinationId)
    if (!destination) {
      response.writeHead(400).end('Unknown destination')
      return
    }
    if (Number(request.headers['content-length']) > MAX_BYTES) {
      response.writeHead(413).end('File too large')
      return
    }

    const lockKey = `${destinationId}:${key}`
    const previous = pending.get(lockKey)
    let release
    const current = new Promise((resolve) => { release = resolve })
    pending.set(lockKey, current)
    try {
      await previous
      const dot = key.lastIndexOf('.')
      const slash = key.lastIndexOf('/')
      const extension = dot > slash + 1 ? key.slice(dot) : ''
      const stem = key.slice(0, key.length - extension.length)
      let uploadKey
      for (let number = 0; ; number++) {
        uploadKey = number ? `${stem} (${number})${extension}` : key
        if (!(await destination.files.exists(uploadKey))) break
      }
      let bytes = 0
      const body = Readable.toWeb(request).pipeThrough(new TransformStream({
        transform(chunk, controller) {
          bytes += chunk.length
          if (bytes > MAX_BYTES) throw new Error('File too large')
          controller.enqueue(chunk)
        },
      }))
      await destination.files.upload(uploadKey, body, {
        contentType: request.headers['content-type'] ?? 'application/octet-stream',
      })
      response.writeHead(201).end('Saved')
    } catch (error) {
      const status = error.message === 'File too large' ? 413 : destination.provider === 'fs' && error.code === 'Provider' ? 400 : 502
      response.writeHead(status).end('Upload failed')
    } finally {
      if (pending.get(lockKey) === current) pending.delete(lockKey)
      release()
    }
  })
  return server
}
