import fs from 'node:fs'
import path from 'node:path'

const workspace = path.resolve(process.cwd(), '..')
const dbPath = path.resolve(process.cwd(), 'data/db.json')
const publishedPath = path.resolve(workspace, 'tierpolitik-vorstoesse-db/data/crawler-published.json')

function loadJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

function saveJson(file, obj) {
  fs.writeFileSync(file, JSON.stringify(obj, null, 2))
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n))
}

function ageDaysFrom(input) {
  if (!input) return 999
  const d = new Date(input)
  if (Number.isNaN(d.getTime())) return 999
  return (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24)
}

const REGION_TERMS = [
  'schweiz', 'bern', 'zürich', 'basel', 'österreich', 'deutschland', 'dach',
  'eu', 'europe', 'england', 'uk', 'grossbritannien', 'britain',
  'usa', 'united states', 'australien', 'australia'
]

const RELEVANT_TERMS = [
  'tierschutz', 'tierrecht', 'tierrechte', 'nutztiere', 'tierhaltung',
  'tierschutzgesetz', 'tierschutzrecht', 'schlachthof', 'schlacht', 'massentierhaltung',
  'tiertransport', 'tierversuch', 'wildtier', 'zoo', 'pelz', 'animal welfare',
  'animal rights', 'livestock', 'factory farming', 'animal law'
]

const NOISE_TERMS = ['hundeschule', 'haustier', 'welpe', 'katzenvideo', 'tiervideo', 'lustig']

function containsAny(text, terms) {
  return terms.some((t) => text.includes(t))
}

function isRelevantNews(p) {
  const title = String(p?.title || '').toLowerCase()
  const summary = String(p?.summary || '').toLowerCase()
  const sourceId = String(p?.sourceId || '').toLowerCase()
  const keywords = Array.isArray(p?.matchedKeywords) ? p.matchedKeywords.map((k) => String(k).toLowerCase()) : []
  const text = `${title} ${summary} ${sourceId} ${keywords.join(' ')}`

  if (containsAny(text, NOISE_TERMS)) return false
  if (!containsAny(text, RELEVANT_TERMS)) return false
  if (!containsAny(text, REGION_TERMS)) return false

  const score = Number(p?.score) || 0
  const fresh = ageDaysFrom(p?.publishedAt) <= 10
  return score >= 0.7 && fresh
}

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 5)
}

function normalizeTitleKey(text) {
  return String(text || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

function canonicalizeUrl(rawUrl) {
  const candidate = String(rawUrl || '').trim()
  if (!candidate) return ''

  try {
    const parsed = new URL(candidate)
    parsed.hash = ''

    // Tracking params create noisy duplicates for the same article.
    for (const key of [...parsed.searchParams.keys()]) {
      const lower = key.toLowerCase()
      if (lower.startsWith('utm_') || lower === 'fbclid' || lower === 'gclid' || lower === 'igshid' || lower === 'mc_cid' || lower === 'mc_eid') {
        parsed.searchParams.delete(key)
      }
    }

    parsed.pathname = parsed.pathname.replace(/\/+$/, '') || '/'
    parsed.search = parsed.searchParams.toString() ? `?${parsed.searchParams.toString()}` : ''
    return parsed.toString()
  } catch {
    return candidate
  }
}

function buildFeedbackProfiles(radarRows) {
  const accepted = new Map()
  const rejected = new Map()

  for (const r of radarRows) {
    if (r?.kind !== 'news') continue
    const words = tokenize(`${r.title || ''} ${r.source || ''}`)
    const target = r.status === 'accepted' ? accepted : r.status === 'rejected' ? rejected : null
    if (!target) continue
    for (const w of words) target.set(w, (target.get(w) || 0) + 1)
  }

  return { accepted, rejected }
}

function scoreFromPublished(p, feedback) {
  let score = 45 + Math.round((Number(p?.score) || 0) * 40)
  const keywords = Array.isArray(p?.matchedKeywords) ? p.matchedKeywords.length : 0
  score += Math.min(10, keywords * 2)
  const recencyBoost = Math.max(0, 12 - Math.floor(ageDaysFrom(p?.publishedAt) / 2))
  score += recencyBoost

  const words = tokenize(`${p?.title || ''} ${p?.summary || ''}`)
  let acceptedHits = 0
  let rejectedHits = 0
  for (const w of words) {
    if ((feedback.accepted.get(w) || 0) >= 2) acceptedHits++
    if ((feedback.rejected.get(w) || 0) >= 2) rejectedHits++
  }
  score += Math.min(10, acceptedHits * 2)
  score -= Math.min(12, rejectedHits * 3)

  return clamp(score, 20, 98)
}

const db = loadJson(dbPath)
const published = fs.existsSync(publishedPath) ? loadJson(publishedPath) : []
if (!Array.isArray(db.radar)) db.radar = []

const existingByTitleKey = new Set(db.radar.map((r) => normalizeTitleKey(r.title)))
const existingByUrl = new Set(db.radar.map((r) => canonicalizeUrl(r.url)))
const feedback = buildFeedbackProfiles(db.radar)

let inserted = 0
let skipped = 0

const publishedSorted = (Array.isArray(published) ? published : [])
  .slice()
  .sort((a, b) => String(b?.publishedAt || '').localeCompare(String(a?.publishedAt || '')))

for (const p of publishedSorted) {
  if (inserted >= 30) break
  if (!isRelevantNews(p)) {
    skipped++
    continue
  }

  const title = String(p?.title || '').replace(/\s+/g, ' ').trim()
  const titleKey = normalizeTitleKey(title)
  const rawUrl = String(p?.id || '').includes('http') ? String(p.id) : `https://radar.local/item/${encodeURIComponent(String(p?.id || 'unknown'))}`
  const url = canonicalizeUrl(rawUrl)
  if (!title || !titleKey || existingByTitleKey.has(titleKey) || existingByUrl.has(url)) {
    skipped++
    continue
  }

  const score = scoreFromPublished(p, feedback)
  const impact = score >= 82 ? 'high' : score >= 65 ? 'med' : 'low'
  const urgency = ageDaysFrom(p?.publishedAt) <= 3 ? 'high' : ageDaysFrom(p?.publishedAt) <= 10 ? 'med' : 'low'
  const nowIso = new Date().toISOString()

  db.radar.push({
    id: `radar_news_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    title,
    source: `News Feed (${p.sourceId || 'source'})`,
    url,
    lane: 'medienarbeit',
    kind: 'news',
    score,
    impact,
    urgency,
    tocAxis: 'weltbild',
    status: 'new',
    createdAt: nowIso,
    updatedAt: nowIso,
  })

  existingByTitleKey.add(titleKey)
  existingByUrl.add(url)
  inserted++
}

// Fokus: nur Medienarbeit + News anzeigen, akzeptierte/hold behalten.
db.radar = db.radar.filter((r) => {
  if (r.lane !== 'medienarbeit') return false
  if (r.kind !== 'news') return false
  if (r.status === 'accepted' || r.status === 'watchlist') return true
  return r.score >= 65 && r.status !== 'rejected'
})

if (db.radar.length > 180) {
  db.radar.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
  db.radar = db.radar.slice(0, 180)
}

saveJson(dbPath, db)
console.log(`News radar sync complete: +${inserted} inserted, ${skipped} skipped, total ${db.radar.length}`)
