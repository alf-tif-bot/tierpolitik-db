import fs from 'node:fs'
import path from 'node:path'
import { NextResponse } from 'next/server'

type DbShape = {
  tasks?: unknown
  entities?: unknown
  links?: unknown
  radar?: unknown
}

const noStoreHeaders = {
  'cache-control': 'no-store, no-cache, max-age=0, must-revalidate',
}

function jsonNoStore<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, {
    ...init,
    headers: {
      ...noStoreHeaders,
      ...(init?.headers || {}),
    },
  })
}

const DB_PATH = path.resolve(process.cwd(), 'data/db.json')

function getCount(value: unknown) {
  return Array.isArray(value) ? value.length : 0
}

export async function GET() {
  const startedAt = Date.now()
  const checkedAt = new Date().toISOString()

  try {
    const dbStats = fs.statSync(DB_PATH)
    const raw = fs.readFileSync(DB_PATH, 'utf8')
    const parsed = JSON.parse(raw) as DbShape

    return jsonNoStore({
      status: 'ok',
      checkedAt,
      latencyMs: Math.max(0, Date.now() - startedAt),
      db: {
        path: DB_PATH,
        bytes: dbStats.size,
        updatedAt: dbStats.mtime.toISOString(),
      },
      counts: {
        tasks: getCount(parsed.tasks),
        entities: getCount(parsed.entities),
        links: getCount(parsed.links),
        radar: getCount(parsed.radar),
      },
    })
  } catch (error) {
    const err = error as NodeJS.ErrnoException
    const errorCode = typeof err?.code === 'string' ? err.code : null

    return jsonNoStore(
      {
        status: 'degraded',
        checkedAt,
        latencyMs: Math.max(0, Date.now() - startedAt),
        error: err?.message || 'Unbekannter Fehler',
        errorCode,
      },
      { status: 503 },
    )
  }
}


