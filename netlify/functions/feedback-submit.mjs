import { withPgClient } from '../../crawler/db-postgres.mjs'

const ALLOWED_ORIGINS = new Set([
  'https://monitor.tierimfokus.ch',
  'https://tierpolitik.netlify.app',
])

const corsHeaders = (origin = '') => ({
  'content-type': 'application/json; charset=utf-8',
  'access-control-allow-origin': ALLOWED_ORIGINS.has(origin) ? origin : 'https://monitor.tierimfokus.ch',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'content-type,authorization',
  'access-control-allow-credentials': 'false',
})

export const handler = async (event) => {
  const origin = String(event?.headers?.origin || event?.headers?.Origin || '')
  try {
    if (event.httpMethod === 'OPTIONS') {
      return { statusCode: 204, headers: corsHeaders(origin), body: '' }
    }
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, headers: corsHeaders(origin), body: 'Method Not Allowed' }
    }

    const body = JSON.parse(event.body || '{}')
    const title = String(body.title || '').trim()
    const url = String(body.link || '').trim()
    const category = String(body.category || 'Feedback')
    const message = String(body.message || '').trim()
    const businessNo = String(body.geschaeftsnummer || '')

    if (!title || !url) {
      return { statusCode: 400, headers: corsHeaders(origin), body: JSON.stringify({ ok: false, error: 'title/link missing' }) }
    }

    const id = `feedback-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const summary = `[${category}] ${message || 'Kein Zusatztext'} · Geschäft: ${businessNo}`
    const isIrrelevant = category.toLowerCase().includes('irrelevant')
    const businessBase = businessNo.split('-')[0]

    await withPgClient(async (client) => {
      await client.query(
        `insert into submissions (id, title, url, summary, created_at, processed, created_source, meta)
         values ($1,$2,$3,$4,now(),false,'user-feedback',$5::jsonb)
         on conflict (id) do nothing`,
        [id, title, url, summary, JSON.stringify({ category, businessNo })],
      )

      if (isIrrelevant && businessNo) {
        const motions = await client.query(
          `select id from motions
           where external_id = $1
              or external_id = $2
              or split_part(external_id, '-', 1) = $3`,
          [businessNo, businessBase, businessBase],
        )

        for (const row of motions.rows) {
          const motionId = row.id
          await client.query(
            `update motions
             set status = 'queued',
                 review_reason = coalesce(nullif(review_reason, ''), 'User feedback') || ' · user-feedback=irrelevant',
                 updated_at = now()
             where id = $1`,
            [motionId],
          )
          await client.query(
            `insert into reviews (motion_id, status, reason, reviewer, decided_at)
             values ($1, 'queued', $2, 'feedback-web', now())`,
            [motionId, 'Marked as irrelevant via home feedback'],
          )
        }
      }
    })

    return {
      statusCode: 200,
      headers: corsHeaders(origin),
      body: JSON.stringify({ ok: true, id }),
    }
  } catch (error) {
    return {
      statusCode: 500,
      headers: corsHeaders(origin),
      body: JSON.stringify({ ok: false, error: error.message || 'feedback submit failed' }),
    }
  }
}

export default handler
