import fs from 'node:fs'
import path from 'node:path'
import { adapters } from '../crawler/adapters/index.mjs'
import { readCollectEnv, resolveSourcePolicy, executeSourceFetch } from '../crawler/collectRuntime.mjs'
import { loadSourceRegistry, summarizeRegistry } from '../crawler/source-registry.mjs'

const outPath = path.resolve(process.cwd(), 'data/crawler-v2-collect.json')

const runtimeConfig = readCollectEnv({
  timeoutMs: 45000,
  concurrency: 4,
  retries: 1,
  backoffMs: 1200,
  backoffMaxMs: 12000,
  backoffFactor: 2,
})

const collectOneSource = async (source) => {
  const adapterKey = source.adapter || source.type
  const adapter = adapters[adapterKey]
  if (!adapter) {
    return { sourceId: source.id, ok: false, reason: `Kein Adapter: ${adapterKey}`, fetched: 0, durationMs: 0, items: [] }
  }

  const policy = resolveSourcePolicy(source, runtimeConfig)

  const result = await executeSourceFetch({
    source,
    adapter,
    policy,
    onStart: ({ sourceId, timeoutMs, retries }) => {
      console.log(`[collect:v2] start ${sourceId} (timeout=${timeoutMs}ms retries=${retries})`)
    },
    onRetry: ({ sourceId, attempt, nextAttempt, backoffMs, error }) => {
      console.warn(`[collect:v2] retry ${sourceId} (attempt ${attempt}->${nextAttempt}, wait=${backoffMs}ms): ${error.message}`)
    },
    onDone: ({ sourceId, fetched, durationMs, attempt }) => {
      console.log(`[collect:v2] done ${sourceId} (items=${fetched}, attempt=${attempt}, ms=${durationMs})`)
    },
    onFail: ({ sourceId, durationMs, attempt, error }) => {
      console.warn(`[collect:v2] fail ${sourceId} (attempt=${attempt}, ms=${durationMs}): ${error.message}`)
    },
  })

  if (result.ok) {
    return {
      sourceId: source.id,
      ok: true,
      fetched: result.rows.length,
      attempts: result.attempts,
      timeoutMs: policy.timeoutMs,
      durationMs: result.durationMs,
      items: result.rows,
    }
  }

  return {
    sourceId: source.id,
    ok: false,
    reason: result.error?.message || 'collect failed',
    attempts: result.attempts,
    timeoutMs: policy.timeoutMs,
    durationMs: result.durationMs,
    fetched: 0,
    items: [],
  }
}

const collectFromSources = async (sources) => {
  const enabledSources = sources.filter((s) => s.enabled !== false)
  const tasks = [...enabledSources]
  const runs = []

  const worker = async () => {
    while (tasks.length) {
      const source = tasks.shift()
      if (!source) break
      runs.push(await collectOneSource(source))
    }
  }

  await Promise.all(Array.from({ length: Math.min(runtimeConfig.concurrency, enabledSources.length || 1) }, () => worker()))

  const sourceStats = runs
    .map(({ items: _items, ...stat }) => stat)
    .sort((a, b) => String(a.sourceId).localeCompare(String(b.sourceId)))
  const items = runs.flatMap((run) => run.items)

  return { items, sourceStats }
}

const sources = loadSourceRegistry()
const registry = summarizeRegistry(sources)
const { items, sourceStats } = await collectFromSources(sources)

const payload = {
  generatedAt: new Date().toISOString(),
  registry,
  runtime: {
    collectConcurrency: runtimeConfig.concurrency,
    collectTimeoutMs: runtimeConfig.timeoutMs,
    collectRetries: runtimeConfig.retries,
    collectRetryBackoffMs: runtimeConfig.backoffMs,
  },
  sourceStats,
  totalItems: items.length,
  items,
}

fs.writeFileSync(outPath, JSON.stringify(payload, null, 2))
console.log('Crawler v2 Collect OK', {
  totalItems: items.length,
  sourceStats,
  outPath,
})

// Some adapters still hold network handles after timeout; force clean CLI exit for cron reliability.
process.exit(0)
