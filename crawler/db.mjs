import fs from 'node:fs'
import { dbSchema } from './schema.mjs'

const DB_PATH = new URL('../data/crawler-db.json', import.meta.url)

export function loadDb() {
  const exists = fs.existsSync(DB_PATH)
  if (!exists) {
    const fresh = { sources: [], items: [], publications: [], updatedAt: new Date().toISOString() }
    fs.writeFileSync(DB_PATH, JSON.stringify(fresh, null, 2))
    return fresh
  }
  const parsed = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'))
  return dbSchema.parse(parsed)
}

export function saveDb(db) {
  const valid = dbSchema.parse({ ...db, updatedAt: new Date().toISOString() })
  fs.writeFileSync(DB_PATH, JSON.stringify(valid, null, 2))
  return valid
}

export function upsertItems(db, incomingItems) {
  const index = new Map(db.items.map((item) => [`${item.sourceId}:${item.externalId}`, item]))
  let inserted = 0

  for (const item of incomingItems) {
    const key = `${item.sourceId}:${item.externalId}`
    if (!index.has(key)) {
      db.items.push(item)
      inserted += 1
      continue
    }

    const prev = index.get(key)
    Object.assign(prev, {
      ...prev,
      ...item,
      score: prev.score,
      matchedKeywords: prev.matchedKeywords,
      status: prev.status,
      reviewReason: prev.reviewReason,
    })
  }

  return { db, inserted }
}
