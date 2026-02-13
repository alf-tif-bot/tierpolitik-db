import fs from 'node:fs'
import path from 'node:path'
import { sourceSchema } from './schema.mjs'

const DEFAULT_CONFIG = new URL('./config.sources.v2.json', import.meta.url)

export function loadSourceRegistry(configPath = DEFAULT_CONFIG) {
  const resolved = typeof configPath === 'string' ? path.resolve(process.cwd(), configPath) : configPath
  const payload = JSON.parse(fs.readFileSync(resolved, 'utf8'))
  return payload.map((source) => sourceSchema.parse(source))
}

export function summarizeRegistry(sources = []) {
  const enabled = sources.filter((s) => s.enabled !== false)
  const byAdapter = enabled.reduce((acc, s) => {
    const key = s.adapter || s.type
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})

  return {
    total: sources.length,
    enabled: enabled.length,
    byAdapter,
  }
}
