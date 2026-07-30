// Minimal, dependency-free static + heartbeat server for the /_services/screens/
// deployment. Replaces nginx as the runner stage so this same container can
// also own /api/heartbeat — nginx can only serve files, it can't receive a
// POST and remember it.
//
// The reverse proxy in front of this container strips the /_services/screens
// prefix before forwarding (the built index.html already references absolute
// asset URLs like /_services/screens/assets/x.js, and nginx's default config
// — which this replaces — only ever saw unprefixed paths). So routes here are
// unprefixed: "/", "/assets/...", "/api/heartbeat".
//
// Heartbeat state is kept in-memory. Fine for a single container instance;
// if this ever runs as multiple replicas behind a load balancer, each
// replica only knows about the screens that happened to hit it and the
// dashboard will show an incomplete picture — swap the Map for a shared
// store (Redis, a DB row, etc.) if that becomes a real deployment.

import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DIST_DIR = path.join(__dirname, 'dist')
const PORT = process.env.PORT || 80

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
}

// screenId -> { screenId, online, hdmiActive, readerCount, lastSeenAt }
const heartbeats = new Map()

const server = http.createServer((req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost')

  if (pathname === '/api/heartbeat' || pathname === '/api/heartbeat/') {
    handleHeartbeat(req, res)
    return
  }

  serveStatic(pathname, res)
})

function handleHeartbeat(req, res) {
  if (req.method === 'POST') {
    readJsonBody(req)
      .then((body) => {
        if (!body || typeof body.screenId !== 'string' || !body.screenId) {
          sendJson(res, 400, { error: 'missing screenId' })
          return
        }

        heartbeats.set(body.screenId, {
          screenId: body.screenId,
          online: body.online ?? true,
          hdmiActive: body.hdmiActive ?? null,
          readerCount: body.readerCount ?? null,
          lastSeenAt: new Date().toISOString(),
        })

        sendJson(res, 200, { ok: true })
      })
      .catch(() => sendJson(res, 400, { error: 'invalid JSON body' }))
    return
  }

  if (req.method === 'GET') {
    sendJson(res, 200, [...heartbeats.values()])
    return
  }

  sendJson(res, 405, { error: 'method not allowed' })
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', (chunk) => {
      raw += chunk
    })
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : null)
      } catch (err) {
        reject(err)
      }
    })
    req.on('error', reject)
  })
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload)
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  })
  res.end(body)
}

function serveStatic(pathname, res) {
  const requested = path.normalize(path.join(DIST_DIR, decodeURIComponent(pathname)))

  if (!requested.startsWith(DIST_DIR)) {
    res.writeHead(403)
    res.end('Forbidden')
    return
  }

  fs.stat(requested, (err, stats) => {
    if (!err && stats.isFile()) {
      streamFile(requested, res)
      return
    }

    // SPA fallback so client-side routes like ?slug=... always get index.html.
    streamFile(path.join(DIST_DIR, 'index.html'), res)
  })
}

function streamFile(filePath, res) {
  const ext = path.extname(filePath)
  res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' })
  fs.createReadStream(filePath).pipe(res)
}

server.listen(PORT, () => {
  console.log(`j26-screens server listening on :${PORT}`)
})
