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

await withPgClient(async (client) => {
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

    let motionsUpserted = 0
    let reviewsCreated = 0

    for (const item of jsonDb.items || []) {
      const motionId = await upsertMotionWithVersion(client, item)
      motionsUpserted += 1

      if (['approved', 'rejected', 'queued', 'published'].includes(item.status)) {
        await insertReviewSnapshot(client, motionId, item)
        reviewsCreated += 1
      }
    }

    let submissionsUpserted = 0
    for (const row of submissions) {
      await upsertSubmission(client, row)
      submissionsUpserted += 1
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
      })],
    )

    await client.query('commit')
    console.log('Migration JSON -> DB abgeschlossen', {
      sources: (jsonDb.sources || []).length,
      motionsUpserted,
      reviewsCreated,
      submissionsUpserted,
    })
  } catch (error) {
    await client.query('rollback')
    throw error
  }
})
