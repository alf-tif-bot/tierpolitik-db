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

const clean = (text = '') => String(text || '').replace(/\s+/g, ' ').trim()

const autoImproveSummary = ({ title = '', body = '', note = '' }) => {
  const noteClean = clean(note)
  if (noteClean.length >= 12) return noteClean
  const titleClean = clean(title)
  const bodyClean = clean(body)
  if (titleClean) {
    return `${titleClean}. Fokus: tierpolitische Einordnung und verständliche Kurzbeschreibung.`
  }
  if (bodyClean) return bodyClean.slice(0, 220)
  return 'Kurzbeschreibung automatisch überarbeitet.'
}

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
    const emailFromBody = String(body.email || '').trim()
    const newsletterOptIn = Boolean(body.newsletterOptIn)

    if (!title || !url) {
      return { statusCode: 400, headers: corsHeaders(origin), body: JSON.stringify({ ok: false, error: 'title/link missing' }) }
    }

    const id = `feedback-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const summary = `[${category}] ${message || 'Kein Zusatztext'} · Geschäft: ${businessNo}`
    const cat = category.toLowerCase()
    const isIrrelevant = cat.includes('irrelevant')
    const isDescriptionImprove = cat.includes('beschreibung')
    const isSubscription = cat.includes('status-abo') || cat.includes('abonn')
    const businessBase = businessNo.split('-')[0]
    const emailFromMessage = String(message || '').match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || ''
    const subscriptionEmail = emailFromBody || emailFromMessage

    if (isSubscription && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(subscriptionEmail)) {
      return { statusCode: 400, headers: corsHeaders(origin), body: JSON.stringify({ ok: false, error: 'valid email required' }) }
    }

    await withPgClient(async (client) => {
      await client.query(
        `insert into submissions (id, title, url, summary, created_at, processed, created_source, meta)
         values ($1,$2,$3,$4,now(),false,'user-feedback',$5::jsonb)
         on conflict (id) do nothing`,
        [id, title, url, summary, JSON.stringify({ category, businessNo, subscriptionEmail: isSubscription ? subscriptionEmail : undefined, newsletterOptIn: isSubscription ? newsletterOptIn : undefined })],
      )

      if (businessNo) {
        const motions = await client.query(
          `select id from motions
           where external_id = $1
              or external_id = $2
              or split_part(external_id, '-', 1) = $3`,
          [businessNo, businessBase, businessBase],
        )

        for (const row of motions.rows) {
          const motionId = row.id

          if (isIrrelevant) {
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

          if (isDescriptionImprove) {
            const currentVersion = await client.query(
              `select title, body, version_no
               from motion_versions
               where motion_id = $1
               order by version_no desc
               limit 1`,
              [motionId],
            )
            const titleBase = currentVersion.rows[0]?.title || title
            const bodyBase = currentVersion.rows[0]?.body || ''
            const maxVersion = Number(currentVersion.rows[0]?.version_no || 0)
            const improved = autoImproveSummary({ title: titleBase, body: bodyBase, note: message })
            const contentHash = `feedback-summary:${motionId}:${Date.now()}`

            await client.query(
              `insert into motion_versions (motion_id, title, summary, body, content_hash, version_no)
               values ($1, $2, $3, $4, $5, $6)
               on conflict (motion_id, content_hash) do nothing`,
              [motionId, titleBase, improved, bodyBase, contentHash, maxVersion + 1],
            )

            await client.query(
              `update motions
               set review_reason = coalesce(nullif(review_reason, ''), 'User feedback') || ' · user-feedback=description-improved',
                   updated_at = now()
               where id = $1`,
              [motionId],
            )
          }
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
