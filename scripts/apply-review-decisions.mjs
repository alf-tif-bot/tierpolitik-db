import fs from 'node:fs'
import { loadDb, saveDb } from '../crawler/db.mjs'

const decisionsPath = new URL('../data/review-decisions.json', import.meta.url)

if (!fs.existsSync(decisionsPath)) {
  console.log('Keine review-decisions.json gefunden, ueberspringe Apply-Review-Schritt')
  process.exit(0)
}

const raw = JSON.parse(fs.readFileSync(decisionsPath, 'utf8'))
const records = Array.isArray(raw)
  ? raw
  : Object.entries(raw).map(([id, value]) => ({ id, ...value }))

const db = loadDb()
const index = new Map(db.items.map((item) => [`${item.sourceId}:${item.externalId}`, item]))

const langFromSourceId = (sourceId = '') => {
  const m = String(sourceId).match(/-(de|fr|it)$/i)
  return m?.[1]?.toLowerCase() || ''
}

const stripLangSuffix = (value = '') => String(value).replace(/-(de|fr|it)$/i, '')

const resolveDecisionId = (id) => {
  if (index.has(id)) return { resolvedId: id, confidence: 'exact' }
  const [sourceId, externalId = ''] = String(id).split(':')
  if (!sourceId || !externalId) return { resolvedId: null, confidence: 'none' }

  const hasLangSuffix = /-(de|fr|it)$/i.test(externalId)
  const lang = langFromSourceId(sourceId)

  if (!hasLangSuffix && lang) {
    const suffixed = `${sourceId}:${externalId}-${lang}`
    if (index.has(suffixed)) return { resolvedId: suffixed, confidence: 'lang-suffix' }
  }

  // High-confidence fallback only for parliament sources where affair IDs are stable
  // across language variants (e.g. 2504812-de/fr/it).
  if (sourceId.startsWith('ch-parliament-')) {
    const decisionCore = stripLangSuffix(externalId)
    const candidates = [...index.keys()].filter((k) => {
      const [sid, eid = ''] = k.split(':')
      return sid === sourceId && stripLangSuffix(eid) === decisionCore
    })
    if (candidates.length === 1) return { resolvedId: candidates[0], confidence: 'parliament-core' }
  }

  return { resolvedId: null, confidence: 'none' }
}

let applied = 0
let remapped = 0
let unresolved = 0
let propagated = 0
let lowConfidenceSkipped = 0

const normalizedRaw = Array.isArray(raw) ? null : { ...raw }

for (const decision of records) {
  if (!decision?.id || !decision?.status) continue
  if (decision.status !== 'approved' && decision.status !== 'rejected') continue

  const { resolvedId, confidence } = resolveDecisionId(decision.id)
  if (!resolvedId) {
    unresolved += 1
    continue
  }

  if (confidence === 'none') {
    lowConfidenceSkipped += 1
    unresolved += 1
    continue
  }

  if (resolvedId !== decision.id && normalizedRaw) {
    normalizedRaw[resolvedId] = { status: decision.status, decidedAt: decision.decidedAt }
    delete normalizedRaw[decision.id]
    remapped += 1
  }

  const item = index.get(resolvedId)
  if (!item) {
    unresolved += 1
    continue
  }
  item.status = decision.status
  item.reviewReason = decision.note || `Review-Entscheid (${decision.status})`
  applied += 1

  const [resolvedSourceId, resolvedExternalId = ''] = String(resolvedId).split(':')
  const affairId = String(resolvedExternalId).replace(/-[a-z]{2}$/i, '').split('-')[0]

  if (resolvedSourceId.startsWith('ch-parliament-') && affairId) {
    for (const candidate of db.items) {
      if (!String(candidate.sourceId || '').startsWith('ch-parliament-')) continue
      const candidateAffair = String(candidate.externalId || '').split('-')[0]
      if (candidateAffair !== affairId) continue
      if (candidate.status === decision.status) continue
      candidate.status = decision.status
      candidate.reviewReason = decision.note || `Review-Entscheid (${decision.status})`
      propagated += 1
    }
  }
}

if (normalizedRaw) {
  fs.writeFileSync(decisionsPath, JSON.stringify(normalizedRaw, null, 2))
}

saveDb(db)
console.log('Review-Entscheidungen angewendet', {
  applied,
  propagated,
  totalDecisions: records.length,
  remapped,
  unresolved,
  lowConfidenceSkipped,
})
