import fs from 'node:fs'
import { loadDb, saveDb, upsertItems } from './db.mjs'
import { sourceSchema } from './schema.mjs'

const SOURCES_PATH = new URL('./config.sources.json', import.meta.url)

export function loadSources() {
  const sources = JSON.parse(fs.readFileSync(SOURCES_PATH, 'utf8'))
  return sources.map((source) => sourceSchema.parse(source))
}

export async function runCollect({ adapters }) {
  const db = loadDb()
  const sources = loadSources().filter((source) => source.enabled)
  const rawItems = []

  for (const source of sources) {
    const adapter = adapters[source.id]
    if (!adapter) continue
    const rows = await adapter.fetch(source)
    rawItems.push(...rows)
  }

  const { inserted } = upsertItems(db, rawItems)
  db.sources = sources
  saveDb(db)
  return { inserted, fetched: rawItems.length }
}

export function runQueue({ minScore = 0.35 } = {}) {
  const db = loadDb()
  let queued = 0

  for (const item of db.items) {
    if (item.status === 'new' && item.score >= minScore) {
      item.status = 'queued'
      item.reviewReason = `Score >= ${minScore}`
      queued += 1
    }
  }

  saveDb(db)
  return { queued }
}

export function runPublish() {
  const db = loadDb()
  const approved = db.items.filter((item) => item.status === 'approved')
  const toPublish = approved.filter((item) => !db.publications.some((p) => p.id === `${item.sourceId}:${item.externalId}`))

  for (const item of toPublish) {
    db.publications.push({
      id: `${item.sourceId}:${item.externalId}`,
      publishedAt: new Date().toISOString(),
      websiteSlug: `${item.sourceId}-${item.externalId}`.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      websiteUrl: 'https://tierimfokus.ch/tierpolitik-monitor',
    })
    item.status = 'published'
  }

  saveDb(db)
  return { published: toPublish.length }
}
