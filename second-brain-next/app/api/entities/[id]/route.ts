import { NextRequest, NextResponse } from 'next/server'
import { patchEntity, removeEntity } from '@/lib/db'

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

const validOwner = new Set(['Tobi', 'ALF', 'Beide'])
const validStatus = new Set(['idea', 'brief', 'draft', 'review', 'approved', 'published', 'repurposed'])
const validTocAxis = new Set(['wertschoepfung', 'weltbild', 'repraesentation'])

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  let body: any
  try {
    body = await req.json()
  } catch {
    return jsonNoStore({ error: 'Ungueltiges JSON im Request-Body' }, { status: 400 })
  }

  const patch: Record<string, string | undefined> = {}

  if (typeof body.title !== 'undefined') {
    const title = String(body.title || '').trim()
    if (!title) return jsonNoStore({ error: 'title darf nicht leer sein' }, { status: 400 })
    patch.title = title
  }

  if (typeof body.notes !== 'undefined') {
    const notes = String(body.notes ?? '').trim()
    patch.notes = notes ? notes : undefined
  }

  if (typeof body.kpis !== 'undefined') {
    const kpis = String(body.kpis ?? '').trim()
    patch.kpis = kpis ? kpis : undefined
  }

  if (typeof body.owner !== 'undefined') {
    if (body.owner === null || body.owner === '') {
      patch.owner = undefined
    } else {
      if (!validOwner.has(body.owner)) return jsonNoStore({ error: 'Ungueltiger owner' }, { status: 400 })
      patch.owner = body.owner
    }
  }

  if (typeof body.status !== 'undefined') {
    if (body.status === null || body.status === '') {
      patch.status = undefined
    } else {
      if (!validStatus.has(body.status)) return jsonNoStore({ error: 'Ungueltiger status' }, { status: 400 })
      patch.status = body.status
    }
  }

  if (typeof body.tocAxis !== 'undefined') {
    if (body.tocAxis === null || body.tocAxis === '') {
      patch.tocAxis = undefined
    } else {
      if (!validTocAxis.has(body.tocAxis)) return jsonNoStore({ error: 'Ungueltige tocAxis' }, { status: 400 })
      patch.tocAxis = body.tocAxis
    }
  }

  if (Object.keys(patch).length === 0) {
    return jsonNoStore({ error: 'Keine gueltigen Felder zum Aktualisieren' }, { status: 400 })
  }

  try {
    const out = patchEntity(id, patch)
    return jsonNoStore(out)
  } catch (e) {
    return jsonNoStore({ error: (e as Error).message }, { status: 404 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const out = removeEntity(id)
    return jsonNoStore(out)
  } catch (e) {
    return jsonNoStore({ error: (e as Error).message }, { status: 404 })
  }
}

