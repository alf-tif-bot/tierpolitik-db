import fs from 'node:fs'
import { loadDb, saveDb, upsertItems } from './db.mjs'
import { readCollectEnv, resolveSourcePolicy, executeSourceFetch } from './collectRuntime.mjs'
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
  const runtimeConfig = readCollectEnv({
    timeoutMs: 90000,
    concurrency: 3,
    retries: 1,
    backoffMs: 1200,
    backoffMaxMs: 12000,
    backoffFactor: 2,
  })

  const tasks = [...sources]

  const worker = async () => {
    while (tasks.length) {
      const source = tasks.shift()
      if (!source) break

      const adapterKey = source.adapter || source.type
      const adapter = adapters[adapterKey]
      if (!adapter) {
        sourceStats.push({ sourceId: source.id, ok: false, reason: `Kein Adapter: ${adapterKey}` })
        continue
      }

      const policy = resolveSourcePolicy(source, runtimeConfig)
      const result = await executeSourceFetch({
        source,
        adapter,
        policy,
        onStart: ({ sourceId, timeoutMs, retries }) => {
          console.log(`[collect] start ${sourceId} (timeout=${timeoutMs}ms retries=${retries})`)
        },
        onRetry: ({ sourceId, attempt, nextAttempt, backoffMs, error }) => {
          console.warn(`[collect] retry ${sourceId} (attempt ${attempt}->${nextAttempt}, wait=${backoffMs}ms): ${error.message}`)
        },
        onDone: ({ sourceId, fetched, durationMs, attempt }) => {
          console.log(`[collect] done ${sourceId} (items=${fetched}, attempt=${attempt}, ms=${durationMs})`)
        },
        onFail: ({ sourceId, durationMs, attempt, error }) => {
          console.warn(`[collect] fail ${sourceId} (attempt=${attempt}, ms=${durationMs}): ${error.message}`)
        },
      })

      if (result.ok) {
        rawItems.push(...result.rows)
        sourceStats.push({
          sourceId: source.id,
          ok: true,
          fetched: result.rows.length,
          attempts: result.attempts,
          timeoutMs: policy.timeoutMs,
          ms: result.durationMs,
        })
      } else {
        sourceStats.push({
          sourceId: source.id,
          ok: false,
          reason: result.error?.message,
          attempts: result.attempts,
          timeoutMs: policy.timeoutMs,
          ms: result.durationMs,
        })
      }
    }
  }

  const workers = Math.min(runtimeConfig.concurrency, sources.length || 1)
  await Promise.all(Array.from({ length: workers }, () => worker()))

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
