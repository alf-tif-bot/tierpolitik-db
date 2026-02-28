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
})

export const handler = async (event) => {
  const origin = String(event?.headers?.origin || event?.headers?.Origin || '')

  if (event?.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders(origin), body: '' }
  }

  if (event?.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: corsHeaders(origin),
      body: JSON.stringify({ ok: false, error: 'Method Not Allowed' }),
    }
  }

  try {
    const includeDecided = String(event?.queryStringParameters?.includeDecided || '').toLowerCase() === 'true'
    const limit = Math.min(5000, Math.max(1, Number(event?.queryStringParameters?.limit || 500)))

    const rows = await withPgClient(async (client) => {
      const res = await client.query(
        `select
          m.source_id,
          m.external_id,
          m.source_url,
          m.language,
          m.published_at,
          m.fetched_at,
          m.score,
          m.matched_keywords,
          m.status as motion_status,
          m.review_reason,
          mv.title,
          mv.summary,
          mv.body,
          lr.status as review_status,
          lr.decided_at
        from motions m
        left join lateral (
          select title, summary, body
          from motion_versions mv
          where mv.motion_id = m.id
          order by mv.version_no desc
          limit 1
        ) mv on true
        left join lateral (
          select status, decided_at
          from reviews r
          where r.motion_id = m.id
          order by r.decided_at desc nulls last
          limit 1
        ) lr on true
        where ($1::boolean = true)
           or coalesce(lr.status, m.status, 'new') in ('new','queued')
        order by coalesce(m.published_at, m.fetched_at) desc nulls last, m.updated_at desc
        limit $2`,
        [includeDecided, limit],
      )
      return res.rows
    })

    const items = rows.map((r) => ({
      id: `${r.source_id}:${r.external_id}`,
      sourceId: r.source_id,
      externalId: r.external_id,
      sourceUrl: r.source_url,
      language: r.language || 'de',
      title: r.title || '',
      summary: r.summary || '',
      body: r.body || '',
      publishedAt: r.published_at ? new Date(r.published_at).toISOString() : null,
      fetchedAt: r.fetched_at ? new Date(r.fetched_at).toISOString() : null,
      score: Number(r.score || 0),
      matchedKeywords: Array.isArray(r.matched_keywords) ? r.matched_keywords : [],
      status: r.review_status || r.motion_status || 'new',
      reviewReason: r.review_reason || '',
      decidedAt: r.decided_at ? new Date(r.decided_at).toISOString() : null,
    }))

    return {
      statusCode: 200,
      headers: corsHeaders(origin),
      body: JSON.stringify({ ok: true, count: items.length, items }),
    }
  } catch (error) {
    return {
      statusCode: 500,
      headers: corsHeaders(origin),
      body: JSON.stringify({ ok: false, error: error?.message || 'review-items failed' }),
    }
  }
}

export default handler
