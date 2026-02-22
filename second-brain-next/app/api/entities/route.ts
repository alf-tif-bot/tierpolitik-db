import { NextRequest, NextResponse } from 'next/server'
import { addEntity, listEntities } from '@/lib/db'

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

function normalizeTitle(raw: string): string {
  return raw
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('de-CH')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const validTypes = new Set(['project', 'content', 'client', 'memory', 'doc', 'person', 'office'])
const validOwners = new Set(['Tobi', 'ALF', 'Beide'])
const validStatuses = new Set(['idea', 'brief', 'draft', 'review', 'approved', 'published', 'repurposed'])
const validTocAxes = new Set(['wertschoepfung', 'weltbild', 'repraesentation'])

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get('type') as any
  return jsonNoStore(listEntities(type || undefined))
}

export async function POST(req: NextRequest) {
  let body: any

  try {
    body = await req.json()
  } catch {
    return jsonNoStore({ error: 'Ungueltiges JSON im Request-Body' }, { status: 400 })
  }

  const type = String(body?.type || '').trim()
  const title = String(body?.title || '').trim()

  if (!type || !title) {
    return jsonNoStore({ error: 'type/title fehlt' }, { status: 400 })
  }

  if (!validTypes.has(type)) {
    return jsonNoStore({ error: 'Ungueltiger entity type' }, { status: 400 })
  }

  const normalizedTitle = normalizeTitle(title)
  const duplicate = listEntities(type as any).find((entity) => normalizeTitle(entity.title) === normalizedTitle)
  if (duplicate) {
    return jsonNoStore({ ...duplicate, duplicate: true }, { status: 200 })
  }

  const out = addEntity({
    type: type as any,
    title,
    notes: body.notes ? String(body.notes) : undefined,
    owner: validOwners.has(body.owner) ? body.owner : undefined,
    status: validStatuses.has(body.status) ? body.status : undefined,
    kpis: body.kpis ? String(body.kpis) : undefined,
    tocAxis: validTocAxes.has(body.tocAxis) ? body.tocAxis : undefined,
  })

  return jsonNoStore(out, { status: 201 })
}

