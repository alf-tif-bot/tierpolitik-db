import fs from 'node:fs'
import { spawnSync } from 'node:child_process'
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

const skipReviewRefresh = String(process.env.DB_SYNC_SKIP_REVIEW_REFRESH || '').trim() === '1'
if (!skipReviewRefresh) {
  const reviewBuild = spawnSync(process.execPath, [resolve(process.cwd(), 'scripts', 'build-review-view.mjs')], {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: process.env,
  })
  if ((reviewBuild.status ?? 1) !== 0) {
    throw new Error(`Review rebuild after DB sync failed with exit code ${reviewBuild.status}`)
  }
}
