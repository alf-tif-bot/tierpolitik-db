import fs from 'node:fs'
import path from 'node:path'
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

const crawlerDbPath = path.resolve(process.cwd(), 'data/crawler-db.json')
const crawlerDb = fs.existsSync(crawlerDbPath)
  ? JSON.parse(fs.readFileSync(crawlerDbPath, 'utf8'))
  : { items: [] }

const findCrawlerItem = (sourceId, externalId) => {
  const externalIdFallback = String(externalId || '').replace(/-[a-z]{2}$/i, '')
  const affairId = externalIdFallback.split('-')[0]

  return (crawlerDb.items || []).find((item) => {
    if (item.sourceId !== sourceId) return false
    const ex = String(item.externalId || '')
    return ex === externalId || ex === externalIdFallback || ex.split('-')[0] === affairId
  })
}

const ALLOWED = new Set(['approved', 'rejected', 'queued'])

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
    const decisionId = String(body.id || '')
    const status = String(body.status || '')
    const decidedAt = body.decidedAt ? new Date(body.decidedAt) : new Date()

    if (!decisionId.includes(':')) {
      return { statusCode: 400, headers: corsHeaders(origin), body: JSON.stringify({ error: 'id must be sourceId:externalId' }) }
    }
    if (!ALLOWED.has(status)) {
      return { statusCode: 400, headers: corsHeaders(origin), body: JSON.stringify({ error: 'invalid status' }) }
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
        let motionId = m.rows[0]?.id

        if (!motionId) {
          const crawlerItem = findCrawlerItem(sourceId, externalId)
          const sourceUrl = crawlerItem?.sourceUrl || `https://www.parlament.ch/de/ratsbetrieb/suche-curia-vista/geschaeft?AffairId=${affairId}`
          const language = crawlerItem?.language || 'de'
          const publishedAt = crawlerItem?.publishedAt || new Date().toISOString()
          const fetchedAt = crawlerItem?.fetchedAt || new Date().toISOString()
          const score = Number(crawlerItem?.score || 0)
          const matchedKeywords = JSON.stringify(crawlerItem?.matchedKeywords || [])
          const reviewReason = crawlerItem?.reviewReason || 'autocreated from review decision'

          await client.query(
            `insert into sources (id, label, type, adapter, url, enabled, options, updated_at)
             values ($1,$2,'api','review-fallback',$3,true,'{}'::jsonb, now())
             on conflict (id) do nothing`,
            [sourceId, sourceId, sourceUrl],
          )

          const inserted = await client.query(
            `insert into motions (
              source_id, external_id, source_url, language, published_at, fetched_at,
              score, matched_keywords, status, review_reason, first_seen_at, last_seen_at, updated_at
            ) values (
              $1,$2,$3,$4,$5,$6,$7,$8::jsonb,'queued',$9,now(),now(),now()
            )
            on conflict (source_id, external_id) do update
            set source_url = excluded.source_url,
                language = excluded.language,
                published_at = excluded.published_at,
                fetched_at = excluded.fetched_at,
                score = excluded.score,
                matched_keywords = excluded.matched_keywords,
                review_reason = excluded.review_reason,
                updated_at = now()
            returning id`,
            [sourceId, externalIdFallback || externalId, sourceUrl, language, publishedAt, fetchedAt, score, matchedKeywords, reviewReason],
          )
          motionId = inserted.rows[0]?.id

          if (motionId && crawlerItem) {
            await client.query(
              `insert into motion_versions (motion_id, title, summary, body, content_hash, version_no)
               values ($1,$2,$3,$4,$5,1)
               on conflict (motion_id, content_hash) do nothing`,
              [
                motionId,
                crawlerItem.title || `Vorstoss ${externalIdFallback || externalId}`,
                crawlerItem.summary || '',
                crawlerItem.body || crawlerItem.summary || '',
                `review-fallback:${sourceId}:${externalIdFallback || externalId}`,
              ],
            )
          }
        }

        if (!motionId) throw new Error(`motion not found (${sourceId}:${externalId})`)

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
      headers: corsHeaders(origin),
      body: JSON.stringify({ ok: true, ...result }),
    }
  } catch (error) {
    return {
      statusCode: 500,
      headers: corsHeaders(origin),
      body: JSON.stringify({ ok: false, error: error.message || 'decision failed' }),
    }
  }
}

export default handler

