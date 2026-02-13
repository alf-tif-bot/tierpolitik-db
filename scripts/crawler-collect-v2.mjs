import fs from 'node:fs'
import path from 'node:path'
import { adapters } from '../crawler/adapters/index.mjs'
import { loadSourceRegistry, summarizeRegistry } from '../crawler/source-registry.mjs'

const outPath = path.resolve(process.cwd(), 'data/crawler-v2-collect.json')

const collectFromSources = async (sources) => {
  const sourceStats = []
  const items = []

  for (const source of sources.filter((s) => s.enabled !== false)) {
    const adapterKey = source.adapter || source.type
    const adapter = adapters[adapterKey]
    if (!adapter) {
      sourceStats.push({ sourceId: source.id, ok: false, reason: `Kein Adapter: ${adapterKey}` })
      continue
    }

    try {
      const rows = await Promise.race([
        adapter.fetch(source),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Adapter timeout after 45s')), 45000)),
      ])
      items.push(...rows)
      sourceStats.push({ sourceId: source.id, ok: true, fetched: rows.length })
    } catch (error) {
      sourceStats.push({ sourceId: source.id, ok: false, reason: error.message })
    }
  }

  return { items, sourceStats }
}

const sources = loadSourceRegistry()
const registry = summarizeRegistry(sources)
const { items, sourceStats } = await collectFromSources(sources)

const payload = {
  generatedAt: new Date().toISOString(),
  registry,
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
