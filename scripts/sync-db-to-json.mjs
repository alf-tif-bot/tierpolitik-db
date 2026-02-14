import fs from 'node:fs'
import { resolve } from 'node:path'
import { withPgClient, loadJsonCompatibleSnapshot } from '../crawler/db-postgres.mjs'

const outPath = resolve(process.cwd(), 'data', 'crawler-db.json')

const sanitizeItem = (item) => {
  const fallbackTitle = `Parlamentsgeschäft ${item?.externalId || item?.affairId || 'ohne-id'}`
  const title = String(item?.title || '').trim()
  const safeTitle = title.length >= 5 ? title : fallbackTitle
  const summary = String(item?.summary || '').trim()

  return {
    ...item,
    title: safeTitle,
    summary: summary || safeTitle,
  }
}

const snapshot = await withPgClient(async (client) => loadJsonCompatibleSnapshot(client))
const sanitized = {
  ...snapshot,
  items: (snapshot.items || []).map(sanitizeItem),
}

fs.writeFileSync(outPath, JSON.stringify(sanitized, null, 2))
console.log('DB -> JSON Sync abgeschlossen:', outPath, { items: sanitized.items.length, sources: sanitized.sources.length })
