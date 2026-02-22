import fs from 'node:fs'
import path from 'node:path'
import { runRelevanceFilter } from '../crawler/relevance.mjs'
import { withPgClient } from '../crawler/db-postgres.mjs'

const decisionsPath = path.resolve(process.cwd(), 'data/review-decisions.json')
const fastlaneTagsPath = path.resolve(process.cwd(), 'data/review-fastlane-tags.json')

async function syncReviewDecisionsFromDb() {
  try {
    const rows = await withPgClient(async (client) => {
      const res = await client.query(`
        select m.source_id, m.external_id, r.status, r.decided_at
        from reviews r
        join motions m on m.id = r.motion_id
        join (
          select motion_id, max(decided_at) as decided_at
          from reviews
          group by motion_id
        ) latest on latest.motion_id = r.motion_id and latest.decided_at = r.decided_at
      `)
      return res.rows
    })

    const current = fs.existsSync(decisionsPath)
      ? JSON.parse(fs.readFileSync(decisionsPath, 'utf8'))
      : {}

    const liveKeys = new Set()
    for (const row of rows) {
      const key = `${row.source_id}:${row.external_id}`
      liveKeys.add(key)
      current[key] = {
        status: String(row.status || 'queued'),
        decidedAt: new Date(row.decided_at || Date.now()).toISOString(),
      }
    }

    for (const key of Object.keys(current)) {
      if (key.startsWith('ch-parliament') && !liveKeys.has(key)) {
        delete current[key]
      }
    }

    fs.writeFileSync(decisionsPath, JSON.stringify(current, null, 2))
    return rows.length
  } catch {
    return 0
  }
}

async function syncFastlaneTagsFromDb() {
  try {
    const rows = await withPgClient(async (client) => {
      const res = await client.query(`
        select meta
        from submissions
        where created_source = 'fastlane-tag'
      `)
      return res.rows
    })

    const tags = {}
    for (const row of rows) {
      const meta = row?.meta || {}
      const targetId = String(meta?.targetId || '')
      if (!targetId.includes(':')) continue
      tags[targetId] = {
        fastlane: Boolean(meta?.fastlane),
        taggedAt: meta?.taggedAt || new Date().toISOString(),
      }
    }

    fs.writeFileSync(fastlaneTagsPath, JSON.stringify(tags, null, 2))
    return Object.keys(tags).length
  } catch {
    return 0
  }
}

const synced = await syncReviewDecisionsFromDb()
const syncedFastlaneTags = await syncFastlaneTagsFromDb()
const result = runRelevanceFilter({ minScore: 0.18, fallbackMin: 0 })
console.log('Relevanz-Filter OK', { ...result, syncedReviewDecisions: synced, syncedFastlaneTags })
