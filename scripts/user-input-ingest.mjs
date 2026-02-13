import fs from 'node:fs'
import { loadDb, saveDb } from '../crawler/db.mjs'

const inputPath = new URL('../data/user-input.json', import.meta.url)
const input = JSON.parse(fs.readFileSync(inputPath, 'utf8'))
const db = loadDb()

let imported = 0
for (const row of input.filter((x) => !x.processed)) {
  db.items.push({
    sourceId: 'user-input',
    sourceUrl: row.url,
    externalId: row.id,
    title: row.title,
    summary: row.summary || 'Eingereicht durch User-Input-Kanal',
    body: row.summary || '',
    publishedAt: row.createdAt || null,
    fetchedAt: new Date().toISOString(),
    language: 'de',
    score: 0.5,
    matchedKeywords: ['user-input'],
    status: 'queued',
    reviewReason: 'Direkt aus User-Input importiert',
  })
  row.processed = true
  imported += 1
}

saveDb(db)
fs.writeFileSync(inputPath, JSON.stringify(input, null, 2))
console.log('User-Input ingest OK', { imported })
