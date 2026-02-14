import fs from 'node:fs'

const dbPath = new URL('../data/crawler-db.json', import.meta.url)
const reviewItemsPath = new URL('../data/review-items.json', import.meta.url)
const motionsPath = new URL('../data/vorstoesse.json', import.meta.url)
const reviewDecisionsPath = new URL('../data/review-decisions.json', import.meta.url)

const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'))
const review = fs.existsSync(reviewItemsPath) ? JSON.parse(fs.readFileSync(reviewItemsPath, 'utf8')) : { ids: [] }
const motions = fs.existsSync(motionsPath) ? JSON.parse(fs.readFileSync(motionsPath, 'utf8')) : []
const reviewDecisions = fs.existsSync(reviewDecisionsPath) ? JSON.parse(fs.readFileSync(reviewDecisionsPath, 'utf8')) : {}

const FIVE_YEARS_MS = 1000 * 60 * 60 * 24 * 365 * 5
const cutoffTs = Date.now() - FIVE_YEARS_MS
const isWithin5Years = (item) => {
  const iso = item?.publishedAt || item?.fetchedAt
  const ts = Date.parse(String(iso || ''))
  return !Number.isNaN(ts) && ts >= cutoffTs
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
  return sid.startsWith('ch-parliament-') || sid.startsWith('ch-municipal-') || sid.startsWith('ch-cantonal-')
}

const reviewCandidates = (db.items || [])
  .filter((item) => isReviewSource(item.sourceId))
  .filter((item) => ['queued', 'approved', 'published'].includes(item.status))
  .filter((item) => isWithin5Years(item))

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
const extraInReview = [...actualReviewIds].filter((id) => !expectedReviewIds.has(id))
const extraInReviewParliament = extraInReview.filter((id) => isParliamentReviewId(id))
const duplicateReviewIds = reviewIdsList
  .filter((id, idx) => reviewIdsList.indexOf(id) !== idx)
  .filter((id, idx, arr) => arr.indexOf(id) === idx)

const expectedPublishedAffairs = new Set(
  (db.items || [])
    .filter((item) => String(item.sourceId || '').startsWith('ch-parliament-'))
    .filter((item) => ['approved', 'published'].includes(item.status))
    .map((item) => String(item.affairId || item.externalId || '').split('-')[0]),
)

const actualMotionAffairs = new Set(
  motions
    .map((m) => String(m?.geschaeftsnummer || '').split('-')[0])
    .filter(Boolean),
)

const missingInMotions = [...expectedPublishedAffairs].filter((affairId) => !actualMotionAffairs.has(affairId))

const decisionsUnknownInDb = Object.keys(reviewDecisions).filter((id) => !dbItemsById.has(id))
const decisionsUnknownLegacy = decisionsUnknownInDb.filter((id) => /^ch-parliament-business-(de|fr|it):\d+$/.test(id))
const decisionsUnknownCritical = decisionsUnknownInDb.filter((id) => !decisionsUnknownLegacy.includes(id))
const affairStatusMap = new Map()
for (const item of (db.items || []).filter((entry) => String(entry.sourceId || '').startsWith('ch-parliament-'))) {
  const affair = String(item.affairId || item.externalId || '').split('-')[0]
  if (!affair) continue
  const statuses = affairStatusMap.get(affair) || new Set()
  statuses.add(String(item.status || ''))
  affairStatusMap.set(affair, statuses)
}

const decisionsStatusMismatch = Object.entries(reviewDecisions)
  .filter(([id, decision]) => {
    if (!dbItemsById.has(id)) return false
    const dbItem = dbItemsById.get(id)
    const dbStatus = String(dbItem?.status || '')
    const isParliament = String(dbItem?.sourceId || '').startsWith('ch-parliament-')
    const affair = String(dbItem?.affairId || dbItem?.externalId || '').split('-')[0]
    const affairStatuses = isParliament ? affairStatusMap.get(affair) || new Set([dbStatus]) : new Set([dbStatus])

    if (decision?.status === 'approved') return ![...affairStatuses].some((s) => ['approved', 'published'].includes(s))
    if (decision?.status === 'rejected') return ![...affairStatuses].every((s) => s === 'rejected')
    if (decision?.status === 'queued') return ![...affairStatuses].some((s) => ['queued', 'approved', 'published'].includes(s))
    return false
  })
  .map(([id, decision]) => {
    const dbItem = dbItemsById.get(id)
    const affair = String(dbItem?.affairId || dbItem?.externalId || '').split('-')[0]
    return {
      id,
      decision: decision?.status,
      dbStatus: dbItem?.status,
      affair,
      affairStatuses: [...(affairStatusMap.get(affair) || new Set([dbItem?.status]))],
    }
  })

const report = {
  generatedAt: new Date().toISOString(),
  expectedReview: expectedReviewIds.size,
  actualReview: actualReviewIds.size,
  missingInReviewCount: missingInReview.length,
  missingInReview: missingInReview.slice(0, 120),
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

if (missingInReview.length || missingInMotions.length || decisionsStatusMismatch.length || decisionsUnknownCritical.length || duplicateReviewIds.length || extraInReviewParliament.length) {
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
