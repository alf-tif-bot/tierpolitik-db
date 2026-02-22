import { NextRequest, NextResponse } from 'next/server'
import { addRadarItem, listRadar, patchRadarItem } from '@/lib/db'

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

function normalizeRegionText(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function regionPriority(row: { title?: string; source?: string; url?: string }) {
  const text = normalizeRegionText(`${row.title || ''} ${row.source || ''} ${row.url || ''}`)

  const swissTerms = [
    'schweiz',
    'suisse',
    'svizzera',
    'bern',
    'zurich',
    'zuerich',
    'basel',
    '.ch',
    'bundesrat',
    'nationalrat',
    'standerat',
    'staenderat',
  ]
  if (swissTerms.some((t) => text.includes(t))) return 3

  const dachTerms = ['deutschland', 'osterreich', '.de', '.at', 'germany', 'austria', 'dach']
  if (dachTerms.some((t) => text.includes(t))) return 2

  return 1
}

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

function normalizeHostname(hostname: string) {
  let host = hostname.toLowerCase()

  while (/^(www|m|mobile|amp)\./i.test(host)) {
    host = host.replace(/^(www|m|mobile|amp)\./i, '')
  }

  return host
}

const maxRadarTitleLength = 220
const maxRadarSourceLength = 120
const maxRadarUrlLength = 2_048

function sanitizeRadarUrl(raw: unknown) {
  const candidate = String(raw ?? '').trim()
  if (!candidate) throw new Error('url fehlt')
  if (candidate.length > maxRadarUrlLength) {
    throw new Error(`URL zu lang (max. ${maxRadarUrlLength} Zeichen)`)
  }

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

  if (!cleaned) {
    throw new Error(`${field} fehlt`)
  }

  if (cleaned.length > maxLength) {
    throw new Error(`${field} zu lang (max. ${maxLength} Zeichen)`)
  }

  return cleaned
}

function normalizeUrl(url?: string) {
  if (!url) return ''
  try {
    const parsed = new URL(url)
    stripTrackingParams(parsed)

    const normalizedHost = normalizeHostname(parsed.hostname)
    const isDefaultPort = (parsed.protocol === 'https:' && parsed.port === '443') || (parsed.protocol === 'http:' && parsed.port === '80')
    const normalizedPort = parsed.port && !isDefaultPort ? `:${parsed.port}` : ''

    const normalizedPathname = normalizePathname(parsed.pathname)
    const normalizedBase = `${normalizedHost}${normalizedPort}${normalizedPathname}${parsed.search}`
    const isHttpLikeProtocol = parsed.protocol === 'http:' || parsed.protocol === 'https:'

    return (isHttpLikeProtocol ? normalizedBase : `${parsed.protocol}//${normalizedBase}`).toLowerCase()
  } catch {
    return url.trim().toLowerCase().replace(/\/$/, '')
  }
}

function normalizeRadarText(value?: string) {
  return (value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

function radarDomainKey(url?: string) {
  if (!url) return ''

  try {
    return normalizeHostname(new URL(url).hostname)
  } catch {
    return ''
  }
}

function statusDedupeRank(status?: string) {
  if (status === 'accepted') return 4
  if (status === 'watchlist') return 3
  // Keep newly surfaced signals above rejected ones, so duplicates can re-enter triage.
  if (status === 'new') return 2
  if (status === 'rejected') return 1
  return 0
}

function pickBetterRadarRow<T extends { score: number; status?: string }>(current: T, incoming: T) {
  const statusDelta = statusDedupeRank(incoming.status) - statusDedupeRank(current.status)
  if (statusDelta !== 0) return statusDelta > 0 ? incoming : current

  const incomingScore = normalizeRadarScore(incoming.score)
  const currentScore = normalizeRadarScore(current.score)
  if (incomingScore !== currentScore) return incomingScore > currentScore ? incoming : current

  return current
}

function pickBetterRadarRowForDedupe<T extends { score: number; status?: string; updatedAt?: string }>(current: T, incoming: T) {
  const preferred = pickBetterRadarRow(current, incoming)
  if (preferred === incoming) return incoming

  const sameStatusRank = statusDedupeRank(incoming.status) === statusDedupeRank(current.status)
  const sameScore = normalizeRadarScore(incoming.score) === normalizeRadarScore(current.score)

  // Tie-break identical rank/score duplicates by freshness so board views stay current.
  if (sameStatusRank && sameScore && updatedAtDesc(incoming, current) < 0) {
    return incoming
  }

  return current
}

function dedupeRadar<T extends { id: string; title: string; source?: string; url: string; lane?: string; score: number; status?: string; updatedAt?: string }>(rows: T[]) {
  const byUrl = new Map<string, T>()

  for (const row of rows) {
    const normalizedUrl = normalizeUrl(row.url)
    const key = normalizedUrl || `id:${row.id}`
    const prev = byUrl.get(key)
    byUrl.set(key, prev ? pickBetterRadarRowForDedupe(prev, row) : row)
  }

  const byFingerprint = new Map<string, T>()

  for (const row of byUrl.values()) {
    const fingerprint = buildRadarFingerprint(row)
    const key = fingerprint || `id:${row.id}`

    const prevByFingerprint = byFingerprint.get(key)
    byFingerprint.set(key, prevByFingerprint ? pickBetterRadarRowForDedupe(prevByFingerprint, row) : row)
  }

  return [...byFingerprint.values()]
}

function normalizeRadarScore(score: unknown) {
  const parsed = typeof score === 'number' ? score : Number(score)
  if (!Number.isFinite(parsed)) return 0
  return Math.max(0, Math.min(100, parsed))
}

function findBestDuplicateByUrl<T extends { id: string; url: string; score: number; status?: string; updatedAt?: string }>(rows: T[], incomingUrl: string) {
  let best: T | undefined

  for (const row of rows) {
    if (normalizeUrl(row.url) !== incomingUrl) continue

    if (!best) {
      best = row
      continue
    }

    const picked = pickBetterRadarRow(best, row)
    if (picked === row) {
      best = row
      continue
    }

    // Tie-breaker when rank+score are equal: keep the freshest item.
    if (updatedAtDesc(row, best) < 0) {
      best = row
    }
  }

  return best
}

function buildRadarFingerprint(row: { title?: string; source?: string; lane?: string; url?: string }) {
  const title = normalizeRadarText(row.title)
  const source = normalizeRadarText(row.source)
  const domain = radarDomainKey(row.url)

  // Lane is intentionally excluded: the same signal can get re-classified
  // (e.g. politik vs medienarbeit) and should still collapse to one item.
  if (title.length >= 12) {
    return `${title}|${source}|${domain}`
  }

  // For short headlines, only dedupe when source and domain also match.
  if (title.length >= 6 && source.length >= 4 && domain) {
    return `${title}|${source}|${domain}`
  }

  return ''
}

function findBestDuplicateByFingerprint<T extends { id: string; title: string; source?: string; lane?: string; url: string; score: number; status?: string; updatedAt?: string }>(
  rows: T[],
  incoming: { title: string; source?: string; lane?: string; url: string },
) {
  const incomingFingerprint = buildRadarFingerprint(incoming)
  if (!incomingFingerprint) return undefined

  let best: T | undefined

  for (const row of rows) {
    if (buildRadarFingerprint(row) !== incomingFingerprint) continue

    if (!best) {
      best = row
      continue
    }

    const picked = pickBetterRadarRow(best, row)
    if (picked === row) {
      best = row
      continue
    }

    if (updatedAtDesc(row, best) < 0) {
      best = row
    }
  }

  return best
}

function computeRadarStats(rows: Array<{ status: string; score: number; lane: string }>) {
  const total = rows.length
  const accepted = rows.filter((r) => r.status === 'accepted').length
  const watchlist = rows.filter((r) => r.status === 'watchlist').length
  const rejected = rows.filter((r) => r.status === 'rejected').length
  const fresh = rows.filter((r) => r.status === 'new').length
  const highScore = rows.filter((r) => normalizeRadarScore(r.score) >= 80).length
  const lanePolitik = rows.filter((r) => r.lane === 'politik').length
  const laneMedien = rows.filter((r) => r.lane === 'medienarbeit').length
  const laneBuch = rows.filter((r) => r.lane === 'buchprojekt').length
  return { total, accepted, watchlist, rejected, fresh, highScore, lanePolitik, laneMedien, laneBuch }
}

const urgencyPriority: Record<string, number> = { high: 3, med: 2, low: 1 }
const impactPriority: Record<string, number> = { high: 3, med: 2, low: 1 }

function parseRadarTimestamp(value?: string) {
  if (!value) return 0
  const ts = Date.parse(value)
  return Number.isFinite(ts) ? ts : 0
}

function updatedAtDesc(a: { updatedAt?: string }, b: { updatedAt?: string }) {
  return parseRadarTimestamp(b.updatedAt) - parseRadarTimestamp(a.updatedAt)
}

function freshnessPriority(updatedAt?: string) {
  const updatedAtTs = parseRadarTimestamp(updatedAt)
  if (!updatedAtTs) return 0

  const ageMs = Date.now() - updatedAtTs
  if (ageMs <= 2 * 24 * 60 * 60 * 1000) return 3
  if (ageMs <= 7 * 24 * 60 * 60 * 1000) return 2
  if (ageMs <= 21 * 24 * 60 * 60 * 1000) return 1
  return 0
}

function parseLimit(value: string | null, fallback: number, max: number) {
  if (!value) return fallback

  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback

  return Math.max(1, Math.min(max, Math.trunc(parsed)))
}

export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get('mode')
  const rows = dedupeRadar(listRadar())

  if (mode === 'stats') return jsonNoStore(computeRadarStats(rows))

  if (mode === 'top') {
    const urgencyWeight: Record<string, number> = { high: 15, med: 8, low: 2 }
    const impactWeight: Record<string, number> = { high: 9, med: 4, low: 0 }
    const limit = parseLimit(req.nextUrl.searchParams.get('limit'), 3, 20)

    const ranked = rows
      .filter((r) => r.status === 'new' || r.status === 'watchlist')
      .map((r) => ({
        ...r,
        _rank:
          normalizeRadarScore(r.score) +
          (urgencyWeight[r.urgency] || 0) +
          (impactWeight[r.impact] || 0) +
          freshnessPriority(r.updatedAt) * 6 +
          regionPriority(r) * 3 +
          (r.lane === 'politik' ? 6 : 0),
      }))
      .sort((a, b) => {
        const rankDelta = b._rank - a._rank
        if (rankDelta !== 0) return rankDelta

        const urgencyDelta = (urgencyPriority[b.urgency] ?? 0) - (urgencyPriority[a.urgency] ?? 0)
        if (urgencyDelta !== 0) return urgencyDelta

        const impactDelta = (impactPriority[b.impact] ?? 0) - (impactPriority[a.impact] ?? 0)
        if (impactDelta !== 0) return impactDelta

        const freshnessDelta = freshnessPriority(b.updatedAt) - freshnessPriority(a.updatedAt)
        if (freshnessDelta !== 0) return freshnessDelta

        const regionDelta = regionPriority(b) - regionPriority(a)
        if (regionDelta !== 0) return regionDelta

        const scoreDelta = normalizeRadarScore(b.score) - normalizeRadarScore(a.score)
        if (scoreDelta !== 0) return scoreDelta

        return updatedAtDesc(a, b)
      })
      .slice(0, limit)
      .map(({ _rank, ...rest }) => rest)

    return jsonNoStore(ranked)
  }

  if (mode === 'board') {
    const statusPriority: Record<string, number> = { new: 0, watchlist: 1, accepted: 2, rejected: 3 }
    const limit = parseLimit(req.nextUrl.searchParams.get('limit'), 200, 500)

    const boardRows = [...rows]
      .sort((a, b) => {
        const statusDelta = (statusPriority[a.status] ?? 99) - (statusPriority[b.status] ?? 99)
        if (statusDelta !== 0) return statusDelta

        const urgencyDelta = (urgencyPriority[b.urgency] ?? 0) - (urgencyPriority[a.urgency] ?? 0)
        if (urgencyDelta !== 0) return urgencyDelta

        const impactDelta = (impactPriority[b.impact] ?? 0) - (impactPriority[a.impact] ?? 0)
        if (impactDelta !== 0) return impactDelta

        const freshnessDelta = freshnessPriority(b.updatedAt) - freshnessPriority(a.updatedAt)
        if (freshnessDelta !== 0) return freshnessDelta

        const regionDelta = regionPriority(b) - regionPriority(a)
        if (regionDelta !== 0) return regionDelta

        const scoreDelta = normalizeRadarScore(b.score) - normalizeRadarScore(a.score)
        if (scoreDelta !== 0) return scoreDelta

        return updatedAtDesc(a, b)
      })
      .slice(0, limit)

    return jsonNoStore(boardRows)
  }

  const limit = parseLimit(req.nextUrl.searchParams.get('limit'), 120, 300)

  const actionable = rows
    .filter((r) => r.status === 'new')
    .filter((r) => (r.lane === 'politik' ? true : r.score >= 70))
    .sort((a, b) => {
      const urgencyDelta = (urgencyPriority[b.urgency] ?? 0) - (urgencyPriority[a.urgency] ?? 0)
      if (urgencyDelta !== 0) return urgencyDelta

      const impactDelta = (impactPriority[b.impact] ?? 0) - (impactPriority[a.impact] ?? 0)
      if (impactDelta !== 0) return impactDelta

      const freshnessDelta = freshnessPriority(b.updatedAt) - freshnessPriority(a.updatedAt)
      if (freshnessDelta !== 0) return freshnessDelta

      const regionDelta = regionPriority(b) - regionPriority(a)
      if (regionDelta !== 0) return regionDelta

      const scoreDelta = normalizeRadarScore(b.score) - normalizeRadarScore(a.score)
      if (scoreDelta !== 0) return scoreDelta

      return updatedAtDesc(a, b)
    })
    .slice(0, limit)

  return jsonNoStore(actionable)
}

export async function POST(req: NextRequest) {
  let body: any

  try {
    body = await req.json()
  } catch {
    return jsonNoStore({ error: 'Ungueltiges JSON im Request-Body' }, { status: 400 })
  }

  let title: string
  let source: string
  try {
    title = sanitizeRadarText(body?.title, 'title')
    source = sanitizeRadarText(body?.source, 'source')
  } catch (error) {
    return jsonNoStore({ error: (error as Error).message }, { status: 400 })
  }

  let url: string
  try {
    url = sanitizeRadarUrl(body?.url)
  } catch (error) {
    return jsonNoStore({ error: (error as Error).message }, { status: 400 })
  }

  const parsedScore = Number(String(body?.score ?? '').replace(',', '.'))
  const safeScore = Number.isFinite(parsedScore) ? Math.max(0, Math.min(100, parsedScore)) : 50

  const lane = ['medienarbeit', 'politik', 'buchprojekt'].includes(body.lane) ? body.lane : undefined
  const kind = ['news', 'vorstoss', 'kampagne', 'analyse'].includes(body.kind) ? body.kind : undefined
  const impact = ['low', 'med', 'high'].includes(body.impact) ? body.impact : undefined
  const urgency = ['low', 'med', 'high'].includes(body.urgency) ? body.urgency : undefined
  const tocAxis = ['wertschoepfung', 'weltbild', 'repraesentation'].includes(body.tocAxis) ? body.tocAxis : undefined
  const status = ['new', 'accepted', 'watchlist', 'rejected'].includes(body.status) ? body.status : undefined

  const incoming = {
    title,
    source,
    url,
    lane: lane || 'medienarbeit',
    kind: kind || 'news',
    score: safeScore,
    impact: impact || 'med',
    urgency: urgency || 'med',
    tocAxis,
    status: status || 'new',
  } as const

  const existingRows = listRadar()
  const normalizedIncomingUrl = normalizeUrl(incoming.url)
  const duplicateByUrl = findBestDuplicateByUrl(existingRows, normalizedIncomingUrl)
  const duplicateByFingerprint = findBestDuplicateByFingerprint(existingRows, incoming)
  const duplicate = duplicateByUrl && duplicateByFingerprint
    ? pickBetterRadarRowForDedupe(duplicateByUrl, duplicateByFingerprint)
    : duplicateByUrl || duplicateByFingerprint

  if (duplicate) {
    // If a previously rejected signal resurfaces organically, re-open it for triage.
    const shouldReviveRejected = !status && duplicate.status === 'rejected'
    const mergedStatus = shouldReviveRejected
      ? 'new'
      : status && statusDedupeRank(status) > statusDedupeRank(duplicate.status)
        ? status
        : duplicate.status
    const mergedUrgency = urgency && (urgencyPriority[urgency] ?? 0) > (urgencyPriority[duplicate.urgency] ?? 0) ? urgency : duplicate.urgency
    const mergedImpact = impact && (impactPriority[impact] ?? 0) > (impactPriority[duplicate.impact] ?? 0) ? impact : duplicate.impact

    const updated = patchRadarItem(duplicate.id, {
      title: incoming.title,
      source: incoming.source,
      url: incoming.url,
      lane: lane || duplicate.lane,
      kind: kind || duplicate.kind,
      tocAxis: tocAxis ?? duplicate.tocAxis,
      status: mergedStatus,
      urgency: mergedUrgency,
      impact: mergedImpact,
      score: Math.max(normalizeRadarScore(duplicate.score), normalizeRadarScore(incoming.score)),
    })

    return jsonNoStore(updated, { status: 200 })
  }

  const out = addRadarItem(incoming)

  return jsonNoStore(out, { status: 201 })
}
