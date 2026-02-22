import fs from 'node:fs'
import path from 'node:path'
import { NextResponse } from 'next/server'

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

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const filePath = safePathFromId(id)
    if (!fs.existsSync(filePath)) return jsonNoStore({ error: 'Someday-Datei nicht gefunden' }, { status: 404 })
    fs.unlinkSync(filePath)
    return jsonNoStore({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Someday-Eintrag konnte nicht geloescht werden'
    const status = message.includes('Ungültig') || message.includes('Ungueltig') ? 400 : 500
    return jsonNoStore({ error: message }, { status })
  }
}

