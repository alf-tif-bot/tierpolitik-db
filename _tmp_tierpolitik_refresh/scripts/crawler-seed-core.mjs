import fs from 'node:fs'
import { loadDb, saveDb, upsertItems } from '../crawler/db.mjs'

const seedPath = new URL('../data/seed-affairs.json', import.meta.url)
const seeds = JSON.parse(fs.readFileSync(seedPath, 'utf8'))

const mapLanguage = (lang) => {
  const l = String(lang || '').toUpperCase()
  if (l === 'FR') return 'fr'
  if (l === 'IT') return 'it'
  if (l === 'EN') return 'en'
  return 'de'
}

const slugify = (value) => String(value || '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/(^-|-$)/g, '')

const toIso = (value) => {
  if (!value) return null
  if (typeof value === 'string') {
    const ms = value.match(/\/Date\((\d+)\)\//)
    if (ms) return new Date(Number(ms[1])).toISOString()
    const d = new Date(value)
    if (!Number.isNaN(d.getTime())) return d.toISOString()
  }
  return null
}

const stripHtml = (value = '') => String(value).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

async function fetchAffair(id, lang) {
  const filter = `ID eq ${id} and Language eq '${lang}'`
  const params = new URLSearchParams({
    '$top': '1',
    '$filter': filter,
    '$select': 'ID,Language,BusinessShortNumber,Title,Description,TagNames,SubmissionDate,Modified,BusinessStatusText,SubmittedBy',
    '$format': 'json',
  })
  const url = `https://ws.parlament.ch/odata.svc/Business?${params.toString()}`
  const res = await fetch(url, { headers: { accept: 'application/json' } })
  if (!res.ok) return null
  const payload = await res.json()
  const rows = Array.isArray(payload?.d) ? payload.d : (Array.isArray(payload?.d?.results) ? payload.d.results : [])
  return rows[0] || null
}

async function run() {
  const incoming = []
  const fetchedAt = new Date().toISOString()

  for (const seed of seeds) {
    const langs = Array.isArray(seed.langs) && seed.langs.length ? seed.langs : ['DE']
    for (const lang of langs) {
      const row = await fetchAffair(seed.id, lang)
      if (!row?.ID || !row?.Title) continue

      const shortNo = row.BusinessShortNumber ? `${row.BusinessShortNumber} · ` : ''
      incoming.push({
        sourceId: `ch-parliament-business-${String(lang).toLowerCase()}`,
        sourceUrl: `https://www.parlament.ch/de/ratsbetrieb/suche-curia-vista/geschaeft?AffairId=${row.ID}`,
        externalId: slugify(`${row.ID}-${row.Language || lang}`),
        title: `${shortNo}${stripHtml(row.Title)}`,
        summary: stripHtml(row.Description || row.BusinessStatusText || row.TagNames || '').slice(0, 420),
        body: stripHtml(`${row.Description || ''}\n${row.TagNames || ''}`),
        publishedAt: toIso(row.SubmissionDate) || toIso(row.Modified),
        fetchedAt,
        language: mapLanguage(row.Language || lang),
        score: 0,
        matchedKeywords: ['seed-core'],
        status: 'new',
        reviewReason: `Seed import: ${seed.label || seed.id}`,
        meta: {
          submittedBy: stripHtml(row.SubmittedBy || ''),
        },
      })
    }
  }

  const db = loadDb()
  const { inserted } = upsertItems(db, incoming)
  saveDb(db)
  console.log('Seed import OK', { configured: seeds.length, fetched: incoming.length, inserted })
}

await run()
