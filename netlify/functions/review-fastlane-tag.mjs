import { withPgClient } from '../../crawler/db-postgres.mjs'

export const handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: 'Method Not Allowed' }
    }

    const body = JSON.parse(event.body || '{}')
    const id = String(body.id || '')
    const fastlane = Boolean(body.fastlane)
    const taggedAt = body.taggedAt ? new Date(body.taggedAt) : new Date()

    if (!id.includes(':')) {
      return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'id must be sourceId:externalId' }) }
    }

    const submissionId = `fastlane-tag:${id}`

    await withPgClient(async (client) => {
      await client.query(
        `insert into submissions (id, title, url, summary, created_at, processed, created_source, meta)
         values ($1, $2, $3, $4, $5, true, 'fastlane-tag', $6::jsonb)
         on conflict (id) do update
         set created_at = excluded.created_at,
             meta = excluded.meta,
             summary = excluded.summary`,
        [
          submissionId,
          `Fastlane Tag ${id}`,
          'https://tierpolitik.netlify.app/review.html',
          fastlane ? 'tagged-fastlane' : 'untagged-fastlane',
          taggedAt.toISOString(),
          JSON.stringify({ targetId: id, fastlane, taggedAt: taggedAt.toISOString() }),
        ],
      )
    })

    return {
      statusCode: 200,
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ ok: true, id, fastlane }),
    }
  } catch (error) {
    return {
      statusCode: 500,
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ ok: false, error: error.message || 'tag failed' }),
    }
  }
}

export default handler
