import { withPgClient } from '../../crawler/db-postgres.mjs'

const ALLOWED_ORIGINS = new Set([
  'https://monitor.tierimfokus.ch',
  'https://tierpolitik.netlify.app',
])

const corsHeaders = (origin = '') => ({
  'content-type': 'application/json; charset=utf-8',
  'access-control-allow-origin': ALLOWED_ORIGINS.has(origin) ? origin : 'https://tierpolitik.netlify.app',
  'access-control-allow-methods': 'GET,OPTIONS',
  'access-control-allow-headers': 'content-type,authorization',
  'access-control-allow-credentials': 'false',
})

export const handler = async (event) => {
  const origin = String(event?.headers?.origin || event?.headers?.Origin || '')
  if (event?.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders(origin), body: '' }
  }

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

    const decisions = {}
    for (const row of rows) {
      const key = `${row.source_id}:${row.external_id}`
      decisions[key] = {
        status: String(row.status || 'queued'),
        decidedAt: new Date(row.decided_at || Date.now()).toISOString(),
      }
    }

    return {
      statusCode: 200,
      headers: corsHeaders(origin),
      body: JSON.stringify({ ok: true, count: rows.length, decisions }),
    }
  } catch (error) {
    return {
      statusCode: 500,
      headers: corsHeaders(origin),
      body: JSON.stringify({ ok: false, error: error?.message || 'export failed' }),
    }
  }
}

export default handler
