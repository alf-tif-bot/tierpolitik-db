import fs from 'node:fs'
import { resolve } from 'node:path'
import {
  withPgClient,
  ensureSource,
  upsertMotionWithVersion,
  insertReviewSnapshot,
  upsertSubmission,
} from '../crawler/db-postgres.mjs'

const jsonDbPath = resolve(process.cwd(), 'data', 'crawler-db.json')
const submissionPath = resolve(process.cwd(), 'data', 'user-input.json')

const jsonDb = JSON.parse(fs.readFileSync(jsonDbPath, 'utf8'))
const submissions = fs.existsSync(submissionPath)
  ? JSON.parse(fs.readFileSync(submissionPath, 'utf8'))
  : []

const ITEMS_BATCH = 400
const SUBMISSIONS_BATCH = 200

await withPgClient(async (client) => {
  // Phase 1: ensure sources (single small transaction)
  await client.query('begin')
  try {
    for (const source of jsonDb.sources || []) {
      await ensureSource(client, source)
    }

    const knownSourceIds = new Set((jsonDb.sources || []).map((s) => s.id))
    const itemSourceIds = new Set((jsonDb.items || []).map((i) => i.sourceId).filter(Boolean))
    for (const sourceId of itemSourceIds) {
      if (knownSourceIds.has(sourceId)) continue
      await ensureSource(client, {
        id: sourceId,
        label: sourceId,
        type: 'api',
        adapter: null,
        url: 'https://placeholder.local/imported-source',
        enabled: true,
        options: { importedBy: 'migrate-json-to-db' },
      })
    }
    await client.query('commit')
  } catch (error) {
    await client.query('rollback')
    throw error
  }

  let motionsUpserted = 0
  let reviewsCreated = 0

  // Phase 2: migrate items in chunks (prevents long-running mega transaction)
  const items = jsonDb.items || []
  for (let i = 0; i < items.length; i += ITEMS_BATCH) {
    const chunk = items.slice(i, i + ITEMS_BATCH)
    await client.query('begin')
    try {
      for (const item of chunk) {
        const motionId = await upsertMotionWithVersion(client, item)
        motionsUpserted += 1

        if (['approved', 'rejected', 'queued', 'published'].includes(item.status)) {
          await insertReviewSnapshot(client, motionId, item)
          reviewsCreated += 1
        }
      }
      await client.query('commit')
    } catch (error) {
      await client.query('rollback')
      throw error
    }

    if ((i / ITEMS_BATCH) % 5 === 0) {
      console.log('Migration progress', {
        processed: Math.min(i + chunk.length, items.length),
        total: items.length,
      })
    }
  }

  let submissionsUpserted = 0
  for (let i = 0; i < submissions.length; i += SUBMISSIONS_BATCH) {
    const chunk = submissions.slice(i, i + SUBMISSIONS_BATCH)
    await client.query('begin')
    try {
      for (const row of chunk) {
        await upsertSubmission(client, row)
        submissionsUpserted += 1
      }
      await client.query('commit')
    } catch (error) {
      await client.query('rollback')
      throw error
    }
  }

  await client.query(
    `insert into migration_runs (kind, details)
     values ('json_to_db', $1::jsonb)`,
    [JSON.stringify({
      sources: (jsonDb.sources || []).length,
      motionsUpserted,
      reviewsCreated,
      submissionsUpserted,
      migratedAt: new Date().toISOString(),
      strategy: 'chunked',
      itemsBatch: ITEMS_BATCH,
    })],
  )

  console.log('Migration JSON -> DB abgeschlossen', {
    sources: (jsonDb.sources || []).length,
    motionsUpserted,
    reviewsCreated,
    submissionsUpserted,
  })
})
