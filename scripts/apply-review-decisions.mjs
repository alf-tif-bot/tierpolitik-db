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

const resolveDecisionId = (id) => {
  if (index.has(id)) return id
  const [sourceId, externalId = ''] = String(id).split(':')
  if (!sourceId || !externalId) return null

  const hasLangSuffix = /-[a-z]{2}$/i.test(externalId)
  const lang = langFromSourceId(sourceId)

  if (!hasLangSuffix && lang) {
    const suffixed = `${sourceId}:${externalId}-${lang}`
    if (index.has(suffixed)) return suffixed
  }

  const affairId = externalId.replace(/-[a-z]{2}$/i, '').split('-')[0]
  if (affairId) {
    const candidates = [...index.keys()].filter((k) => {
      const [sid, eid = ''] = k.split(':')
      return sid === sourceId && String(eid).split('-')[0] === affairId
    })
    if (candidates.length) return candidates[0]
  }

  return null
}

let applied = 0
let remapped = 0
let unresolved = 0
let propagated = 0

const normalizedRaw = Array.isArray(raw) ? null : { ...raw }

for (const decision of records) {
  if (!decision?.id || !decision?.status) continue
  if (decision.status !== 'approved' && decision.status !== 'rejected') continue

  const resolvedId = resolveDecisionId(decision.id)
  if (!resolvedId) {
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
console.log('Review-Entscheidungen angewendet', { applied, propagated, totalDecisions: records.length, remapped, unresolved })
