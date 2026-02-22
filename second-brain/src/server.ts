import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { addEntity, listEntities, uid, updateEntity } from './store.js'
import { EntityType } from './types.js'

const PORT = Number(process.env.PORT ?? 8787)
const PUBLIC_DIR = path.resolve('public')

const now = () => new Date().toISOString()

function sendJson(res: http.ServerResponse, code: number, data: unknown) {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(data, null, 2))
}

function readBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', (chunk) => (raw += chunk))
    req.on('end', () => {
      if (!raw) return resolve({})
      try {
        resolve(JSON.parse(raw))
      } catch (err) {
        reject(err)
      }
    })
    req.on('error', reject)
  })
}

function serveStatic(reqPath: string, res: http.ServerResponse) {
  const safePath = reqPath === '/' ? '/index.html' : reqPath
  const full = path.resolve(PUBLIC_DIR, `.${safePath}`)
  if (!full.startsWith(PUBLIC_DIR) || !fs.existsSync(full) || fs.statSync(full).isDirectory()) {
    res.writeHead(404)
    res.end('Not found')
    return
  }

  const ext = path.extname(full)
  const contentType =
    ext === '.html'
      ? 'text/html; charset=utf-8'
      : ext === '.css'
        ? 'text/css; charset=utf-8'
        : ext === '.js'
          ? 'application/javascript; charset=utf-8'
          : 'text/plain; charset=utf-8'

  res.writeHead(200, { 'content-type': contentType })
  res.end(fs.readFileSync(full))
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host}`)

    if (url.pathname === '/api/entities' && req.method === 'GET') {
      const type = url.searchParams.get('type') as EntityType | null
      return sendJson(res, 200, listEntities(type ?? undefined))
    }

    if (url.pathname === '/api/tasks' && req.method === 'POST') {
      const body = await readBody(req)
      if (!body.title) return sendJson(res, 400, { error: 'title fehlt' })

      const task = addEntity({
        id: uid('task'),
        type: 'task',
        title: String(body.title),
        notes: body.notes ? String(body.notes) : undefined,
        tags: Array.isArray(body.tags) ? body.tags.map(String) : [],
        status: ['open', 'doing', 'done'].includes(body.status) ? body.status : 'open',
        priority: ['low', 'med', 'high'].includes(body.priority) ? body.priority : 'med',
        due: body.due ? String(body.due) : undefined,
        assignee: body.assignee ? String(body.assignee) : undefined,
        createdAt: now(),
        updatedAt: now(),
      })

      return sendJson(res, 201, task)
    }

    if (url.pathname.startsWith('/api/tasks/') && req.method === 'PATCH') {
      const id = url.pathname.split('/').pop()!
      const body = await readBody(req)
      const updated = updateEntity(id, {
        ...(body.status ? { status: body.status } : {}),
        ...(body.assignee ? { assignee: body.assignee } : {}),
        ...(body.priority ? { priority: body.priority } : {}),
      } as any)
      return sendJson(res, 200, updated)
    }

    if (url.pathname === '/api/projects' && req.method === 'POST') {
      const body = await readBody(req)
      if (!body.title) return sendJson(res, 400, { error: 'title fehlt' })
      const project = addEntity({
        id: uid('project'),
        type: 'project',
        title: String(body.title),
        notes: body.notes ? String(body.notes) : undefined,
        tags: Array.isArray(body.tags) ? body.tags.map(String) : [],
        createdAt: now(),
        updatedAt: now(),
      } as any)
      return sendJson(res, 201, project)
    }

    return serveStatic(url.pathname, res)
  } catch (error) {
    return sendJson(res, 500, { error: (error as Error).message })
  }
})

server.listen(PORT, () => {
  console.log(`Second Brain UI läuft auf http://localhost:${PORT}`)
})
