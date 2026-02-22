import { NextRequest, NextResponse } from 'next/server'
import { addLink, listAllLinkables, listLinks } from '@/lib/db'

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

const maxRelationLength = 64
const maxLinkIdLength = 120
const maxModeLength = 32

function sanitizeLinkField(raw: unknown, field: 'from' | 'to' | 'relation') {
  const value = String(raw ?? '').trim()

  if (!value) {
    throw new Error(`${field} fehlt`)
  }

  const normalized = value.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim()

  if (!normalized) {
    throw new Error(`${field} fehlt`)
  }

  if (field === 'relation' && normalized.length > maxRelationLength) {
    throw new Error(`relation zu lang (max. ${maxRelationLength} Zeichen)`)
  }

  if ((field === 'from' || field === 'to') && normalized.length > maxLinkIdLength) {
    throw new Error(`${field} zu lang (max. ${maxLinkIdLength} Zeichen)`)
  }

  return normalized
}

export async function GET(req: NextRequest) {
  const modeRaw = req.nextUrl.searchParams.get('mode')
  const mode = String(modeRaw || '').trim().toLowerCase()

  if (!mode) return jsonNoStore(listLinks())
  if (mode.length > maxModeLength) {
    return jsonNoStore({ error: `mode zu lang (max. ${maxModeLength} Zeichen)` }, { status: 400 })
  }

  if (/[^a-z-]/.test(mode)) {
    return jsonNoStore({ error: 'mode enthaelt ungueltige Zeichen', allowedPattern: '^[a-z-]+$' }, { status: 400 })
  }

  if (mode === 'linkables') return jsonNoStore(listAllLinkables())

  return jsonNoStore({ error: 'Unbekannter mode', allowedModes: ['linkables'] }, { status: 400 })
}

export async function POST(req: NextRequest) {
  let body: any
  try {
    body = await req.json()
  } catch {
    return jsonNoStore({ error: 'Ungueltiges JSON im Request-Body' }, { status: 400 })
  }

  let from: string
  let to: string
  let relation: string

  try {
    const fromInput = body?.from
    const toInput = body?.to

    if (typeof fromInput !== 'string') throw new Error('from muss ein String sein')
    if (typeof toInput !== 'string') throw new Error('to muss ein String sein')

    from = sanitizeLinkField(fromInput, 'from')
    to = sanitizeLinkField(toInput, 'to')

    const relationInput = body?.relation
    if (typeof relationInput !== 'undefined' && relationInput !== null && typeof relationInput !== 'string') {
      throw new Error('relation muss ein String sein')
    }

    const relationRaw = typeof relationInput === 'string' ? relationInput.trim() : ''
    relation = relationRaw ? sanitizeLinkField(relationRaw, 'relation') : 'related'
  } catch (error) {
    return jsonNoStore({ error: (error as Error).message }, { status: 400 })
  }

  if (from === to) {
    return jsonNoStore({ error: 'from und to duerfen nicht identisch sein' }, { status: 400 })
  }

  const existingLinks = listLinks()

  const existing = existingLinks.find((link) => link.from === from && link.to === to && link.relation === relation)
  if (existing) {
    return jsonNoStore({ ...existing, duplicate: true }, { status: 200 })
  }

  const inverseExisting = existingLinks.find((link) => link.from === to && link.to === from && link.relation === relation)
  if (inverseExisting) {
    return jsonNoStore({ ...inverseExisting, duplicateInverse: true }, { status: 200 })
  }

  try {
    const out = addLink({ from, to, relation })
    return jsonNoStore(out, { status: 201 })
  } catch (e) {
    return jsonNoStore({ error: (e as Error).message }, { status: 400 })
  }
}
