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
let applied = 0

for (const decision of records) {
  if (!decision?.id || !decision?.status) continue
  if (decision.status !== 'approved' && decision.status !== 'rejected') continue

  const item = index.get(decision.id)
  if (!item) continue
  item.status = decision.status
  item.reviewReason = decision.note || `Review-Entscheid (${decision.status})`
  applied += 1
}

saveDb(db)
console.log('Review-Entscheidungen angewendet', { applied, totalDecisions: records.length })
