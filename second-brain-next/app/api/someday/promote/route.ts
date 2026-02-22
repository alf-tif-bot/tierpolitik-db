import fs from 'node:fs'
import path from 'node:path'
import { NextRequest, NextResponse } from 'next/server'
import { addTask, listTasks } from '@/lib/db'

const noStoreHeaders = {
  'cache-control': 'no-store, no-cache, must-revalidate, max-age=0',
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

const SOMEDAY_DIR = path.resolve(process.cwd(), '..', 'PARA', 'Projects', 'Someday-Maybe')

function safePathFromId(id: string) {
  let decoded = ''

  try {
    decoded = decodeURIComponent(id).trim()
  } catch {
    throw new Error('Ungültige Someday-ID')
  }

  if (!decoded.toLowerCase().endsWith('.md')) throw new Error('Ungültige Someday-ID')
  if (decoded.length > 180) throw new Error('Ungültige Someday-ID')
  if (decoded.includes('..') || decoded.includes('/') || decoded.includes('\\')) throw new Error('Ungültiger Dateiname')
  return path.join(SOMEDAY_DIR, decoded)
}

function normalizeTaskTitle(value: string) {
  return value
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('de-CH')
}

export async function POST(req: NextRequest) {
  let body: any

  try {
    body = await req.json()
  } catch {
    return jsonNoStore({ error: 'Ungueltiges JSON im Request-Body' }, { status: 400 })
  }

  try {
    const id = String(body?.id || '')
    const removeSource = Boolean(body?.removeSource)

    if (!id) return jsonNoStore({ error: 'id fehlt' }, { status: 400 })

    const filePath = safePathFromId(id)
    if (!fs.existsSync(filePath)) return jsonNoStore({ error: 'Someday-Datei nicht gefunden' }, { status: 404 })

    const content = fs.readFileSync(filePath, 'utf8')
    const title = content.match(/^#\s+(.+)$/m)?.[1]?.trim() || decodeURIComponent(id).replace(/\.md$/i, '')

    const normalizedTitle = normalizeTaskTitle(title)
    const existingTask = listTasks().find((task) => {
      if (task.status === 'done') return false
      return normalizeTaskTitle(task.title) === normalizedTitle
    })

    const task =
      existingTask ||
      addTask({
        title,
        priority: 'med',
        assignee: 'Beide',
        impact: 'med',
        area: 'ops',
      })

    if (removeSource) fs.unlinkSync(filePath)

    return jsonNoStore({
      task,
      removed: removeSource,
      deduplicated: Boolean(existingTask),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Someday-Eintrag konnte nicht verarbeitet werden'
    const status = message.includes('Ungültig') || message.includes('Ungueltig') ? 400 : 500
    return jsonNoStore({ error: message }, { status })
  }
}

