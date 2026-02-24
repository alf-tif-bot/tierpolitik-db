import fs from 'node:fs'
import path from 'node:path'
import { runRelevanceFilter } from '../crawler/relevance.mjs'
import { withPgClient } from '../crawler/db-postgres.mjs'

const decisionsPath = path.resolve(process.cwd(), 'data/review-decisions.json')
const fastlaneTagsPath = path.resolve(process.cwd(), 'data/review-fastlane-tags.json')

async function writeDecisions(rows = []) {
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
}

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
    return await writeDecisions(rows)
  } catch {
    try {
      const url = process.env.REVIEW_DECISIONS_EXPORT_URL || 'https://tierpolitik.netlify.app/.netlify/functions/review-decisions-export'
      const res = await fetch(url, { headers: { 'user-agent': 'tierpolitik-crawler/score-sync' } })
      if (!res.ok) return 0
      const data = await res.json()
      const decisions = data?.decisions || {}
      const rows = Object.entries(decisions).map(([key, value]) => {
        const [source_id, external_id] = String(key).split(':')
        return {
          source_id,
          external_id,
          status: value?.status || 'queued',
          decided_at: value?.decidedAt || new Date().toISOString(),
        }
      }).filter((r) => r.source_id && r.external_id)
      return await writeDecisions(rows)
    } catch {
      return 0
    }
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
const minScore = Number(process.env.CRAWLER_MIN_SCORE || 0.14)
const fallbackMin = Number(process.env.CRAWLER_FALLBACK_MIN || 40)
const result = runRelevanceFilter({ minScore, fallbackMin })
console.log('Relevanz-Filter OK', { ...result, minScore, fallbackMin, syncedReviewDecisions: synced, syncedFastlaneTags })
