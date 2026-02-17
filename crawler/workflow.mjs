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

  const sourceStats = []
  const sourceTimeoutMs = Number(process.env.CRAWLER_SOURCE_TIMEOUT_MS || 90000)

  for (const source of sources) {
    const adapterKey = source.adapter || source.type
    const adapter = adapters[adapterKey]
    if (!adapter) {
      sourceStats.push({ sourceId: source.id, ok: false, reason: `Kein Adapter: ${adapterKey}` })
      continue
    }
    const startedAt = Date.now()
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(new Error(`source timeout after ${sourceTimeoutMs}ms`)), sourceTimeoutMs)
    try {
      const rows = await adapter.fetch(source, { signal: controller.signal, timeoutMs: sourceTimeoutMs })
      rawItems.push(...rows)
      sourceStats.push({ sourceId: source.id, ok: true, fetched: rows.length, ms: Date.now() - startedAt })
    } catch (error) {
      sourceStats.push({ sourceId: source.id, ok: false, reason: error.message, ms: Date.now() - startedAt })
      console.warn(`[collect] Quelle uebersprungen (${source.id}):`, error.message)
    } finally {
      clearTimeout(timeoutId)
    }
  }

  const { inserted } = upsertItems(db, rawItems)
  db.sources = sources
  saveDb(db)
  return { inserted, fetched: rawItems.length, sourceStats }
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
