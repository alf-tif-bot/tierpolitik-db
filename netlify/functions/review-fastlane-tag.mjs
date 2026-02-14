import fs from 'node:fs'
import path from 'node:path'

const tagsPath = path.resolve(process.cwd(), 'data/review-fastlane-tags.json')

const loadTags = () => {
  try {
    if (!fs.existsSync(tagsPath)) return {}
    return JSON.parse(fs.readFileSync(tagsPath, 'utf8'))
  } catch {
    return {}
  }
}

const saveTags = (tags) => {
  fs.writeFileSync(tagsPath, JSON.stringify(tags, null, 2))
}

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

    const tags = loadTags()
    tags[id] = { fastlane, taggedAt: taggedAt.toISOString() }
    saveTags(tags)

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
