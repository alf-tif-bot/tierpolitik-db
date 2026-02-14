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

const reviewCandidates = (db.items || [])
  .filter((item) => String(item.sourceId || '').startsWith('ch-parliament-'))
  .filter((item) => ['queued', 'approved', 'published'].includes(item.status))
  .filter((item) => isWithin5Years(item))

const expectedGrouped = new Map()
for (const item of reviewCandidates) {
  const affair = String(item.affairId || item.externalId || '').split('-')[0]
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

const actualReviewIds = new Set(review.ids || [])
const missingInReview = [...expectedReviewIds].filter((id) => !actualReviewIds.has(id))

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
const decisionsStatusMismatch = Object.entries(reviewDecisions)
  .filter(([id, decision]) => {
    if (!dbItemsById.has(id)) return false
    const dbStatus = dbItemsById.get(id)?.status
    return decision?.status === 'approved'
      ? !['approved', 'published'].includes(dbStatus)
      : decision?.status === 'rejected'
        ? dbStatus !== 'rejected'
        : false
  })
  .map(([id, decision]) => ({
    id,
    decision: decision?.status,
    dbStatus: dbItemsById.get(id)?.status,
  }))

const report = {
  generatedAt: new Date().toISOString(),
  expectedReview: expectedReviewIds.size,
  actualReview: actualReviewIds.size,
  missingInReviewCount: missingInReview.length,
  missingInReview: missingInReview.slice(0, 120),
  expectedPublishedAffairs: expectedPublishedAffairs.size,
  actualMotions: actualMotionAffairs.size,
  missingInMotionsCount: missingInMotions.length,
  missingInMotions: missingInMotions.slice(0, 120),
  reviewDecisionsCount: Object.keys(reviewDecisions).length,
  decisionsUnknownInDbCount: decisionsUnknownInDb.length,
  decisionsUnknownInDb: decisionsUnknownInDb.slice(0, 120),
  decisionsStatusMismatchCount: decisionsStatusMismatch.length,
  decisionsStatusMismatch: decisionsStatusMismatch.slice(0, 120),
}

fs.writeFileSync(new URL('../data/regression-report.json', import.meta.url), JSON.stringify(report, null, 2))

if (missingInReview.length || missingInMotions.length || decisionsStatusMismatch.length) {
  console.error('Regression check FAILED', report)
  process.exit(1)
}

console.log('Regression check OK', report)
