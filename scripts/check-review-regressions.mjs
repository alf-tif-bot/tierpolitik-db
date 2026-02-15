import fs from 'node:fs'

const dbPath = new URL('../data/crawler-db.json', import.meta.url)
const reviewItemsPath = new URL('../data/review-items.json', import.meta.url)
const motionsPath = new URL('../data/vorstoesse.json', import.meta.url)
const reviewDecisionsPath = new URL('../data/review-decisions.json', import.meta.url)
const publishedPath = new URL('../data/crawler-published.json', import.meta.url)
const sourcesConfigPath = new URL('../crawler/config.sources.json', import.meta.url)

const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'))
const review = fs.existsSync(reviewItemsPath) ? JSON.parse(fs.readFileSync(reviewItemsPath, 'utf8')) : { ids: [] }
const motions = fs.existsSync(motionsPath) ? JSON.parse(fs.readFileSync(motionsPath, 'utf8')) : []
const reviewDecisions = fs.existsSync(reviewDecisionsPath) ? JSON.parse(fs.readFileSync(reviewDecisionsPath, 'utf8')) : {}
const published = fs.existsSync(publishedPath) ? JSON.parse(fs.readFileSync(publishedPath, 'utf8')) : []
const configuredSources = fs.existsSync(sourcesConfigPath)
  ? JSON.parse(fs.readFileSync(sourcesConfigPath, 'utf8'))
  : []

const enabledSourceIds = new Set(((configuredSources.length ? configuredSources : (db.sources || [])) || [])
  .filter((s) => s.enabled !== false)
  .map((s) => s.id))

const TARGET_SINCE_YEAR = Math.max(2020, Number(process.env.REVIEW_TARGET_SINCE_YEAR || 2020))
const targetSinceTs = Date.UTC(TARGET_SINCE_YEAR, 0, 1, 0, 0, 0)
const fixDecisionMismatches = process.argv.includes('--fix-decisions')
const pruneLegacyDecisions = process.argv.includes('--prune-legacy-decisions')
const isInTargetHorizon = (item) => {
  const iso = item?.publishedAt || item?.fetchedAt
  const ts = Date.parse(String(iso || ''))
  return !Number.isNaN(ts) && ts >= targetSinceTs
}

const langRank = (sourceId = '') => {
  const s = String(sourceId || '').toLowerCase()
  if (s.endsWith('-de')) return 0
  if (s.endsWith('-fr')) return 1
  if (s.endsWith('-it')) return 2
  return 3
}

const itemId = (item) => `${item.sourceId}:${item.externalId}`
const dbItemsById = new Map((db.items || []).map((item) => [itemId(item), item]))

const isReviewSource = (sourceId = '') => {
  const sid = String(sourceId || '')
  return sid.startsWith('ch-parliament-') || sid.startsWith('ch-municipal-') || sid.startsWith('ch-cantonal-') || sid === 'user-input'
}

const isMunicipalOverviewNoise = (item) => {
  const sid = String(item?.sourceId || '')
  if (!sid.startsWith('ch-municipal-')) return false
  const t = String(item?.title || '').toLowerCase()
  const url = String(item?.meta?.sourceLink || item?.sourceUrl || '').toLowerCase()
  return t.includes('übersichtsseite')
    || t.includes('vorstösse und grsr-revisionen')
    || t.includes('antworten auf kleine anfragen')
    || url.includes('vorstoesse-und-grsr-revisionen')
    || url.includes('antworten-auf-kleine-anfragen')
}

const MUNICIPAL_THEME_STRONG_KEYWORDS = [
  'tier', 'tierschutz', 'tierwohl', 'tierpark', 'tierversuch', 'wildtier', 'haustier',
  'zoo', 'vogel', 'hund', 'katze', 'fisch', 'jagd',
]

const MUNICIPAL_THEME_CONTEXT_KEYWORDS = [
  'biodivers', 'wald', 'siedlungsgebiet', 'landwirtschaftsgebiet', 'feuerwerk', 'lärm', 'laerm',
]

const isMunicipalTopicRelevant = (item) => {
  const sid = String(item?.sourceId || '')
  if (!sid.startsWith('ch-municipal-')) return true
  const text = `${item?.title || ''}\n${item?.summary || ''}\n${item?.body || ''}`.toLowerCase()
  const strongHits = MUNICIPAL_THEME_STRONG_KEYWORDS.filter((kw) => text.includes(kw)).length
  const contextHits = MUNICIPAL_THEME_CONTEXT_KEYWORDS.filter((kw) => text.includes(kw)).length
  return strongHits > 0 || contextHits >= 2
}

const CANTONAL_THEME_STRONG_KEYWORDS = [
  'tier', 'tierschutz', 'tierwohl', 'tierhalteverbot', 'nutztier', 'masthuhn', 'geflügel', 'schlacht',
  'tierversuch', '3r', 'wildtier', 'jagd', 'zoo', 'tierpark', 'biodivers', 'artenschutz', 'wolf', 'fuchs',
]

const isCantonalReadableRelevant = (item) => {
  const sid = String(item?.sourceId || '')
  if (!sid.startsWith('ch-cantonal-')) return true
  const title = String(item?.title || '').trim()
  const summary = String(item?.summary || '').trim().toLowerCase()
  const text = `${title}\n${summary}\n${String(item?.body || '')}`.toLowerCase()

  const looksUnreadable =
    /^parlamentsgesch(ä|a)ft\s+/i.test(title)
    || title.toLowerCase().includes('quell-adapter vorbereitet')
    || summary.includes('0 relevante linkziele erkannt')
    || summary.includes('verifying your browser')

  if (looksUnreadable) return false
  return CANTONAL_THEME_STRONG_KEYWORDS.some((kw) => text.includes(kw))
}

const normalizeReviewStatus = (item) => {
  const sid = String(item?.sourceId || '')
  const status = String(item?.status || '')
  if (sid.startsWith('ch-cantonal-') && status === 'rejected') return 'queued'
  return status
}

const reviewCandidates = (db.items || [])
  .filter((item) => enabledSourceIds.has(item.sourceId) || String(item.sourceId || '') === 'user-input')
  .filter((item) => isReviewSource(item.sourceId))
  .filter((item) => ['new', 'queued', 'approved', 'published'].includes(normalizeReviewStatus(item)))
  .filter((item) => !isMunicipalOverviewNoise(item))
  .filter((item) => isMunicipalTopicRelevant(item))
  .filter((item) => isCantonalReadableRelevant(item))
  .filter((item) => isInTargetHorizon(item))

const expectedGrouped = new Map()
for (const item of reviewCandidates) {
  const sid = String(item.sourceId || '')
  const affair = sid.startsWith('ch-parliament-')
    ? String(item.affairId || item.externalId || '').split('-')[0]
    : `${sid}:${item.externalId}`
  const prev = expectedGrouped.get(affair)
  if (!prev) {
    expectedGrouped.set(affair, item)
    continue
  }
  const betterLang = langRank(item.sourceId) < langRank(prev.sourceId)
  const betterScore = Number(item.score || 0) > Number(prev.score || 0)
  if (betterLang || (!betterLang && betterScore)) expectedGrouped.set(affair, item)
}

const expectedReviewIds = new Set([...expectedGrouped.values()].map((item) => itemId(item)))

const reviewIdsList = Array.isArray(review.ids) ? review.ids : []
const actualReviewIds = new Set(reviewIdsList)
const isParliamentReviewId = (id) => String(id || '').startsWith('ch-parliament-')
const missingInReview = [...expectedReviewIds].filter((id) => !actualReviewIds.has(id))
const missingInReviewParliament = missingInReview.filter((id) => isParliamentReviewId(id))
const extraInReview = [...actualReviewIds].filter((id) => !expectedReviewIds.has(id))
const extraInReviewParliament = extraInReview.filter((id) => isParliamentReviewId(id))
const duplicateReviewIds = reviewIdsList
  .filter((id, idx) => reviewIdsList.indexOf(id) !== idx)
  .filter((id, idx, arr) => arr.indexOf(id) === idx)

const expectedPublishedAffairs = new Set(
  (published || [])
    .filter((item) => String(item?.sourceId || '').startsWith('ch-parliament-'))
    .map((item) => String(item?.affairId || item?.externalId || '').split('-')[0])
    .filter(Boolean),
)

const actualMotionAffairs = new Set(
  motions
    .map((m) => String(m?.geschaeftsnummer || '').split('-')[0])
    .filter(Boolean),
)

const missingInMotions = [...expectedPublishedAffairs].filter((affairId) => !actualMotionAffairs.has(affairId))

let decisionsUnknownInDb = Object.keys(reviewDecisions).filter((id) => !dbItemsById.has(id))
let decisionsUnknownLegacy = decisionsUnknownInDb.filter((id) => /^ch-parliament-business-(de|fr|it):\d+$/.test(id))
let decisionsUnknownCritical = decisionsUnknownInDb.filter((id) => !decisionsUnknownLegacy.includes(id))

if (pruneLegacyDecisions && decisionsUnknownLegacy.length) {
  for (const legacyId of decisionsUnknownLegacy) delete reviewDecisions[legacyId]
  fs.writeFileSync(reviewDecisionsPath, JSON.stringify(reviewDecisions, null, 2))
  decisionsUnknownInDb = Object.keys(reviewDecisions).filter((id) => !dbItemsById.has(id))
  decisionsUnknownLegacy = decisionsUnknownInDb.filter((id) => /^ch-parliament-business-(de|fr|it):\d+$/.test(id))
  decisionsUnknownCritical = decisionsUnknownInDb.filter((id) => !decisionsUnknownLegacy.includes(id))
}

const affairStatusMap = new Map()
for (const item of (db.items || []).filter((entry) => String(entry.sourceId || '').startsWith('ch-parliament-'))) {
  const affair = String(item.affairId || item.externalId || '').split('-')[0]
  if (!affair) continue
  const statuses = affairStatusMap.get(affair) || new Set()
  statuses.add(String(item.status || ''))
  affairStatusMap.set(affair, statuses)
}

const computeDecisionMismatches = () => Object.entries(reviewDecisions)
  .filter(([id, decision]) => {
    if (!dbItemsById.has(id)) return false
    const dbItem = dbItemsById.get(id)
    const dbStatus = String(dbItem?.status || '')
    const dbReviewStatus = normalizeReviewStatus(dbItem)
    const isParliament = String(dbItem?.sourceId || '').startsWith('ch-parliament-')
    const affair = String(dbItem?.affairId || dbItem?.externalId || '').split('-')[0]
    const affairStatuses = isParliament ? affairStatusMap.get(affair) || new Set([dbStatus]) : new Set([dbReviewStatus])

    if (decision?.status === 'approved') return ![...affairStatuses].some((s) => ['approved', 'published'].includes(s))
    if (decision?.status === 'rejected') return dbReviewStatus !== 'rejected'
    if (decision?.status === 'queued') return ![...affairStatuses].some((s) => ['queued', 'approved', 'published'].includes(s))
    return false
  })
  .map(([id, decision]) => {
    const dbItem = dbItemsById.get(id)
    const affair = String(dbItem?.affairId || dbItem?.externalId || '').split('-')[0]
    return {
      id,
      decision: decision?.status,
      dbStatus: normalizeReviewStatus(dbItem),
      affair,
      affairStatuses: [...(affairStatusMap.get(affair) || new Set([dbItem?.status]))],
    }
  })

let decisionsStatusMismatch = computeDecisionMismatches()

if (fixDecisionMismatches && decisionsStatusMismatch.length) {
  for (const mismatch of decisionsStatusMismatch) {
    const prev = reviewDecisions[mismatch.id] || {}
    reviewDecisions[mismatch.id] = {
      ...prev,
      status: mismatch.dbStatus,
      decidedAt: prev.decidedAt || new Date().toISOString(),
      syncedAt: new Date().toISOString(),
      syncReason: 'regression-check-db-status',
    }
  }
  fs.writeFileSync(reviewDecisionsPath, JSON.stringify(reviewDecisions, null, 2))
  decisionsStatusMismatch = computeDecisionMismatches()
}

const report = {
  generatedAt: new Date().toISOString(),
  targetSinceYear: TARGET_SINCE_YEAR,
  fixDecisionMismatches,
  pruneLegacyDecisions,
  expectedReview: expectedReviewIds.size,
  actualReview: actualReviewIds.size,
  missingInReviewCount: missingInReview.length,
  missingInReviewParliamentCount: missingInReviewParliament.length,
  missingInReview: missingInReview.slice(0, 120),
  missingInReviewParliament: missingInReviewParliament.slice(0, 120),
  extraInReviewCount: extraInReview.length,
  extraInReviewParliamentCount: extraInReviewParliament.length,
  extraInReview: extraInReview.slice(0, 120),
  extraInReviewParliament: extraInReviewParliament.slice(0, 120),
  duplicateReviewIdsCount: duplicateReviewIds.length,
  duplicateReviewIds: duplicateReviewIds.slice(0, 120),
  expectedPublishedAffairs: expectedPublishedAffairs.size,
  actualMotions: actualMotionAffairs.size,
  missingInMotionsCount: missingInMotions.length,
  missingInMotions: missingInMotions.slice(0, 120),
  reviewDecisionsCount: Object.keys(reviewDecisions).length,
  decisionsUnknownInDbCount: decisionsUnknownInDb.length,
  decisionsUnknownLegacyCount: decisionsUnknownLegacy.length,
  decisionsUnknownCriticalCount: decisionsUnknownCritical.length,
  decisionsUnknownInDb: decisionsUnknownInDb.slice(0, 120),
  decisionsStatusMismatchCount: decisionsStatusMismatch.length,
  decisionsStatusMismatch: decisionsStatusMismatch.slice(0, 120),
}

fs.writeFileSync(new URL('../data/regression-report.json', import.meta.url), JSON.stringify(report, null, 2))

if (missingInReviewParliament.length || missingInMotions.length || decisionsStatusMismatch.length || decisionsUnknownCritical.length || duplicateReviewIds.length || extraInReviewParliament.length) {
  console.error('Regression check FAILED', report)
  process.exit(1)
}

if (decisionsUnknownLegacy.length) {
  console.warn('Regression check WARN: legacy decision IDs not present in DB', {
    decisionsUnknownLegacyCount: decisionsUnknownLegacy.length,
    sample: decisionsUnknownLegacy.slice(0, 12),
  })
}

if (extraInReview.length) {
  console.warn('Regression check WARN: stale review IDs present', {
    extraInReviewCount: extraInReview.length,
    sample: extraInReview.slice(0, 12),
  })
}

console.log('Regression check OK', report)
