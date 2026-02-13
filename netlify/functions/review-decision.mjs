import { withPgClient } from '../../crawler/db-postgres.mjs'

const ALLOWED = new Set(['approved', 'rejected', 'queued'])

export const handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: 'Method Not Allowed' }
    }

    const body = JSON.parse(event.body || '{}')
    const decisionId = String(body.id || '')
    const status = String(body.status || '')
    const decidedAt = body.decidedAt ? new Date(body.decidedAt) : new Date()

    if (!decisionId.includes(':')) {
      return { statusCode: 400, body: JSON.stringify({ error: 'id must be sourceId:externalId' }) }
    }
    if (!ALLOWED.has(status)) {
      return { statusCode: 400, body: JSON.stringify({ error: 'invalid status' }) }
    }

    const [sourceId, externalIdRaw] = decisionId.split(':')
    const externalId = String(externalIdRaw || '')
    const externalIdFallback = externalId.replace(/-[a-z]{2}$/i, '')
    const affairId = externalIdFallback.split('-')[0]

    const result = await withPgClient(async (client) => {
      await client.query('begin')
      try {
        const m = await client.query(
          `select id
           from motions
           where
             (source_id = $1 and (external_id = $2 or external_id = $3))
             or external_id = $2
             or external_id = $3
             or split_part(external_id, '-', 1) = $4
           order by
             case when source_id = $1 then 0 else 1 end,
             updated_at desc
           limit 1`,
          [sourceId, externalId, externalIdFallback, affairId],
        )
        if (!m.rows.length) throw new Error(`motion not found (${sourceId}:${externalId})`)

        const motionId = m.rows[0].id

        await client.query(
          `update motions
           set status = $2,
               review_reason = $3,
               updated_at = now(),
               last_seen_at = now()
           where id = $1`,
          [motionId, status, 'Decision via review UI'],
        )

        await client.query(
          `insert into reviews (motion_id, status, reason, reviewer, decided_at)
           values ($1,$2,$3,$4,$5)`,
          [motionId, status, 'Decision via review UI', 'review-web', decidedAt.toISOString()],
        )

        await client.query('commit')
        return { motionId, status }
      } catch (error) {
        await client.query('rollback')
        throw error
      }
    })

    return {
      statusCode: 200,
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ ok: true, ...result }),
    }
  } catch (error) {
    return {
      statusCode: 500,
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ ok: false, error: error.message || 'decision failed' }),
    }
  }
}

export default handler
