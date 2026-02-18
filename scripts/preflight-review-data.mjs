import fs from 'node:fs'
import path from 'node:path'

const files = [
  'data/crawler-db.json',
  'data/review-decisions.json',
  'data/review-fastlane-tags.json',
]

const CONFLICT_RX = /^<{7}|^={7}|^>{7}/m
const PLACEHOLDER_HOSTS = new Set(['example.org', 'example.com', 'example.net', 'localhost', '127.0.0.1'])

const fail = (msg) => {
  console.error(`PREFLIGHT_FAIL: ${msg}`)
  process.exit(1)
}

for (const rel of files) {
  const abs = path.resolve(process.cwd(), rel)
  if (!fs.existsSync(abs)) fail(`missing ${rel}`)

  const raw = fs.readFileSync(abs, 'utf8')
  if (CONFLICT_RX.test(raw)) fail(`merge conflict markers in ${rel}`)

  try {
    JSON.parse(raw.replace(/^\uFEFF/, ''))
  } catch (e) {
    fail(`invalid JSON in ${rel} (${e?.message || e})`)
  }
}

const db = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'data/crawler-db.json'), 'utf8').replace(/^\uFEFF/, ''))

let deadLike = 0
for (const item of db.items || []) {
  const url = String(item?.sourceUrl || '').trim()
  if (!/^https?:\/\//i.test(url)) continue
  try {
    const host = new URL(url).hostname.toLowerCase()
    if (PLACEHOLDER_HOSTS.has(host)) deadLike += 1
  } catch {
    // ignore malformed here; contract validator handles hard failures
  }
}

console.log(`Preflight OK: files=${files.length}, placeholderUrls=${deadLike}`)
