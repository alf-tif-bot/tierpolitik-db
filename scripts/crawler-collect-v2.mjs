import fs from 'node:fs'
import path from 'node:path'
import { adapters } from '../crawler/adapters/index.mjs'
import { loadSourceRegistry, summarizeRegistry } from '../crawler/source-registry.mjs'

const outPath = path.resolve(process.cwd(), 'data/crawler-v2-collect.json')

const parseIntSafe = (value, fallback) => {
  const n = Number.parseInt(String(value ?? ''), 10)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

const COLLECT_TIMEOUT_MS = parseIntSafe(process.env.CRAWLER_COLLECT_TIMEOUT_MS, 45000)
const COLLECT_CONCURRENCY = parseIntSafe(process.env.CRAWLER_COLLECT_CONCURRENCY, 4)

const runWithAbortTimeout = async (runner, timeoutMs) => {
  const controller = new AbortController()
  let timer
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      controller.abort(new Error(`Adapter timeout after ${timeoutMs}ms`))
      reject(new Error(`Adapter timeout after ${timeoutMs}ms`))
    }, timeoutMs)
  })

  try {
    return await Promise.race([runner(controller.signal), timeoutPromise])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

const collectOneSource = async (source) => {
  const adapterKey = source.adapter || source.type
  const adapter = adapters[adapterKey]
  if (!adapter) {
    return { sourceId: source.id, ok: false, reason: `Kein Adapter: ${adapterKey}`, fetched: 0, items: [] }
  }

  const startedAt = Date.now()
  try {
    const rows = await runWithAbortTimeout((signal) => adapter.fetch(source, { signal }), COLLECT_TIMEOUT_MS)
    return {
      sourceId: source.id,
      ok: true,
      fetched: rows.length,
      durationMs: Date.now() - startedAt,
      items: rows,
    }
  } catch (error) {
    return {
      sourceId: source.id,
      ok: false,
      reason: error.message,
      durationMs: Date.now() - startedAt,
      fetched: 0,
      items: [],
    }
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

  await Promise.all(Array.from({ length: Math.min(COLLECT_CONCURRENCY, enabledSources.length || 1) }, () => worker()))

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
    collectConcurrency: COLLECT_CONCURRENCY,
    collectTimeoutMs: COLLECT_TIMEOUT_MS,
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
