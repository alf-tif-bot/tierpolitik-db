import { withPgClient } from '../../crawler/db-postgres.mjs'

export const handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: 'Method Not Allowed' }
    }

    const body = JSON.parse(event.body || '{}')
    const title = String(body.title || '').trim()
    const url = String(body.link || '').trim()
    const category = String(body.category || 'Feedback')
    const message = String(body.message || '').trim()
    const businessNo = String(body.geschaeftsnummer || '')

    if (!title || !url) {
      return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'title/link missing' }) }
    }

    const id = `feedback-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const summary = `[${category}] ${message || 'Kein Zusatztext'} · Geschäft: ${businessNo}`

    await withPgClient(async (client) => {
      await client.query(
        `insert into submissions (id, title, url, summary, created_at, processed, created_source, meta)
         values ($1,$2,$3,$4,now(),false,'user-feedback',$5::jsonb)
         on conflict (id) do nothing`,
        [id, title, url, summary, JSON.stringify({ category, businessNo })],
      )
    })

    return {
      statusCode: 200,
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ ok: true, id }),
    }
  } catch (error) {
    return {
      statusCode: 500,
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ ok: false, error: error.message || 'feedback submit failed' }),
    }
  }
}

export default handler
