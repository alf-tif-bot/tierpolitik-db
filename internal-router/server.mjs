import http from 'node:http'
import fs from 'node:fs/promises'
import path from 'node:path'

const HOST = '0.0.0.0'
const PORT = 3020
const BASE = 'http://192.168.50.219'
const STALL_PUBLIC = 'C:/Users/yokim/.openclaw/workspace/PARA/Projects/Stallbraende-Schweiz/public'

const routes = {
  '/cockpit': `${BASE}:3001/`,
  '/mission-control': `${BASE}:3001/`,
}

const staticFiles = {
  '/stallbraende': path.join(STALL_PUBLIC, 'review-stallbraende.v0.html'),
  '/stallbraende-dashboard': path.join(STALL_PUBLIC, 'dashboard-stallbraende.v0.html'),
}

const html = `<!doctype html>
<html lang="de">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Interne Projekte</title>
<style>body{font-family:Arial,sans-serif;background:#111;color:#eee;padding:24px}a{display:block;color:#93c5fd;margin:10px 0;font-size:18px}</style>
</head>
<body>
  <h1>Interne Projekte</h1>
  <a href="/cockpit">Cockpit</a>
  <a href="/mission-control">Mission Control (alt)</a>
  <a href="/stallbraende">Stallbrände Review</a>
  <a href="/stallbraende-dashboard">Stallbrände Dashboard</a>
</body></html>`

const server = http.createServer(async (req, res) => {
  const url = req.url || '/'
  if (url === '/' || url === '/index.html') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    res.end(html)
    return
  }

  if (staticFiles[url]) {
    try {
      const content = await fs.readFile(staticFiles[url], 'utf8')
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
      res.end(content)
      return
    } catch {
      res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' })
      res.end('Static file not available')
      return
    }
  }

  const target = routes[url]
  if (target) {
    res.writeHead(302, { location: target })
    res.end()
    return
  }

  res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
  res.end('Not found')
})

server.listen(PORT, HOST, () => {
  console.log(`internal-router listening on http://${HOST}:${PORT}`)
})
