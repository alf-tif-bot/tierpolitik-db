import fs from 'node:fs'
import path from 'node:path'

const dbPath = path.resolve(process.cwd(), 'data/crawler-db.json')
const allowedStatus = new Set(['new', 'queued', 'approved', 'published', 'rejected'])

const fail = (msg) => {
  console.error(`CONTRACT_FAIL: ${msg}`)
  process.exit(1)
}

if (!fs.existsSync(dbPath)) fail(`missing file: ${dbPath}`)

let db
try {
  db = JSON.parse(fs.readFileSync(dbPath, 'utf8').replace(/^\uFEFF/, ''))
} catch (e) {
  fail(`invalid JSON in crawler-db.json (${e?.message || e})`)
}

if (!Array.isArray(db?.items)) fail('crawler-db.json.items must be an array')

const errors = []
for (const item of db.items) {
  const id = `${item?.sourceId || '?'}:${item?.externalId || '?'}`

  if (!item?.sourceId) errors.push(`${id} missing sourceId`)
  if (!item?.externalId) errors.push(`${id} missing externalId`)
  if (!item?.title || String(item.title).trim().length < 3) errors.push(`${id} missing/too-short title`)
  if (!item?.sourceUrl || !/^https?:\/\//i.test(String(item.sourceUrl))) errors.push(`${id} missing/invalid sourceUrl`)
  if (!item?.publishedAt && !item?.fetchedAt) errors.push(`${id} missing publishedAt/fetchedAt`)

  const status = String(item?.status || '').toLowerCase()
  if (!allowedStatus.has(status)) errors.push(`${id} invalid status '${item?.status}'`)

  if (item?.reviewReason == null) errors.push(`${id} missing reviewReason`)
}

if (errors.length > 0) {
  const preview = errors.slice(0, 40)
  preview.forEach((e) => console.error(`CONTRACT_ERROR: ${e}`))
  fail(`contract violations=${errors.length}`)
}

console.log(`Contract OK: ${db.items.length} items validated`)
