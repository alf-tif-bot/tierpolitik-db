import { NextRequest, NextResponse } from 'next/server'
import { patchRadarItem, type RadarItem } from '@/lib/db'

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

const validStatus = new Set(['new', 'accepted', 'watchlist', 'rejected'])
const validImpact = new Set(['low', 'med', 'high'])
const validUrgency = new Set(['low', 'med', 'high'])
const validTocAxis = new Set(['wertschoepfung', 'weltbild', 'repraesentation'])
const validLane = new Set(['medienarbeit', 'politik', 'buchprojekt'])
const validKind = new Set(['news', 'vorstoss', 'kampagne', 'analyse'])

const trackingQueryKeys = new Set([
  'fbclid',
  'gclid',
  'igshid',
  'mc_cid',
  'mc_eid',
  'mkt_tok',
  'ref',
  'ref_src',
  'si',
  'spm',
  'utm_campaign',
  'utm_content',
  'utm_id',
  'utm_medium',
  'utm_name',
  'utm_source',
  'utm_term',
  'wt_mc',
])

function stripTrackingParams(parsed: URL) {
  parsed.hash = ''

  for (const key of [...parsed.searchParams.keys()]) {
    const normalized = key.toLowerCase()
    if (normalized.startsWith('utm_') || trackingQueryKeys.has(normalized)) {
      parsed.searchParams.delete(key)
    }
  }

  parsed.searchParams.sort()
}

function normalizePathname(pathname: string) {
  const collapsed = pathname.replace(/\/{2,}/g, '/')
  const withoutIndex = collapsed.replace(/\/(index\.(html?|php))$/i, '/')

  if (withoutIndex.length > 1) {
    return withoutIndex.replace(/\/+$/, '')
  }

  return withoutIndex
}

const maxRadarTitleLength = 220
const maxRadarSourceLength = 120
const maxRadarUrlLength = 2_048

function sanitizeRadarUrl(raw: unknown) {
  const candidate = String(raw ?? '').trim()
  if (!candidate) throw new Error('Ungueltiger url')
  if (candidate.length > maxRadarUrlLength) throw new Error(`Ungueltige URL (max. ${maxRadarUrlLength} Zeichen)`)

  const withProtocol = /^[a-z][a-z\d+.-]*:\/\//i.test(candidate) ? candidate : `https://${candidate}`

  let parsed: URL
  try {
    parsed = new URL(withProtocol)
  } catch {
    throw new Error('Ungueltige URL (nur http/https)')
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Ungueltige URL (nur http/https)')
  }

  stripTrackingParams(parsed)
  parsed.pathname = normalizePathname(parsed.pathname)

  return parsed.toString()
}

function sanitizeRadarText(raw: unknown, field: 'title' | 'source') {
  const maxLength = field === 'title' ? maxRadarTitleLength : maxRadarSourceLength
  const cleaned = String(raw ?? '')
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!cleaned) throw new Error(`Ungueltiger ${field}`)
  if (cleaned.length > maxLength) throw new Error(`${field} zu lang (max. ${maxLength} Zeichen)`)

  return cleaned
}

function normalizeEnumInput(raw: unknown) {
  if (raw === null) return null
  return typeof raw === 'string' ? raw.trim() : raw
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  let body: any
  try {
    body = await req.json()
  } catch {
    return jsonNoStore({ error: 'Ungueltiges JSON im Request-Body' }, { status: 400 })
  }

  if (!body || typeof body !== 'object') {
    return jsonNoStore({ error: 'Request-Body muss ein JSON-Objekt sein' }, { status: 400 })
  }

  const patch: Partial<Pick<RadarItem, 'status' | 'score' | 'impact' | 'urgency' | 'tocAxis' | 'lane' | 'kind' | 'title' | 'source' | 'url'>> = {}

  if (typeof body.status !== 'undefined') {
    const status = normalizeEnumInput(body.status)
    if (typeof status !== 'string' || !validStatus.has(status)) return jsonNoStore({ error: 'Ungültiger status' }, { status: 400 })
    patch.status = status as RadarItem['status']
  }

  if (typeof body.score !== 'undefined') {
    const scoreRaw = typeof body.score === 'string' ? body.score.trim().replace(',', '.') : body.score
    if (scoreRaw === '') return jsonNoStore({ error: 'Ungültiger score' }, { status: 400 })

    const score = Number(scoreRaw)
    if (!Number.isFinite(score)) return jsonNoStore({ error: 'Ungültiger score' }, { status: 400 })
    patch.score = Math.max(0, Math.min(100, score))
  }

  if (typeof body.impact !== 'undefined') {
    const impact = normalizeEnumInput(body.impact)
    if (typeof impact !== 'string' || !validImpact.has(impact)) return jsonNoStore({ error: 'Ungültiger impact' }, { status: 400 })
    patch.impact = impact as RadarItem['impact']
  }

  if (typeof body.urgency !== 'undefined') {
    const urgency = normalizeEnumInput(body.urgency)
    if (typeof urgency !== 'string' || !validUrgency.has(urgency)) return jsonNoStore({ error: 'Ungültiger urgency' }, { status: 400 })
    patch.urgency = urgency as RadarItem['urgency']
  }

  if (typeof body.tocAxis !== 'undefined') {
    const tocAxis = normalizeEnumInput(body.tocAxis)
    if (tocAxis === null || tocAxis === '') {
      patch.tocAxis = undefined
    } else {
      if (typeof tocAxis !== 'string' || !validTocAxis.has(tocAxis)) return jsonNoStore({ error: 'Ungültige tocAxis' }, { status: 400 })
      patch.tocAxis = tocAxis as RadarItem['tocAxis']
    }
  }

  if (typeof body.lane !== 'undefined') {
    const lane = normalizeEnumInput(body.lane)
    if (typeof lane !== 'string' || !validLane.has(lane)) return jsonNoStore({ error: 'Ungültiger lane' }, { status: 400 })
    patch.lane = lane as RadarItem['lane']
  }

  if (typeof body.kind !== 'undefined') {
    const kind = normalizeEnumInput(body.kind)
    if (typeof kind !== 'string' || !validKind.has(kind)) return jsonNoStore({ error: 'Ungültiger kind' }, { status: 400 })
    patch.kind = kind as RadarItem['kind']
  }

  if (typeof body.title !== 'undefined') {
    try {
      patch.title = sanitizeRadarText(body.title, 'title')
    } catch (error) {
      return jsonNoStore({ error: (error as Error).message }, { status: 400 })
    }
  }

  if (typeof body.source !== 'undefined') {
    try {
      patch.source = sanitizeRadarText(body.source, 'source')
    } catch (error) {
      return jsonNoStore({ error: (error as Error).message }, { status: 400 })
    }
  }

  if (typeof body.url !== 'undefined') {
    try {
      patch.url = sanitizeRadarUrl(body.url)
    } catch (error) {
      return jsonNoStore({ error: (error as Error).message }, { status: 400 })
    }
  }

  if (Object.keys(patch).length === 0) {
    return jsonNoStore({ error: 'Keine gültigen Felder zum Aktualisieren' }, { status: 400 })
  }

  try {
    const out = patchRadarItem(id, patch)
    return jsonNoStore(out)
  } catch (e) {
    return jsonNoStore({ error: (e as Error).message }, { status: 404 })
  }
}

