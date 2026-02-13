import fs from 'node:fs'

const dbPath = new URL('../data/crawler-db.json', import.meta.url)
const outPath = new URL('../data/crawler-published.json', import.meta.url)
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'))

const published = db.items
  .filter((item) => item.status === 'approved' || item.status === 'published' || item.score >= 0.25)
  .slice(0, 30)
  .map((item) => ({
    id: `${item.sourceId}:${item.externalId}`,
    title: item.title,
    summary: item.summary,
    sourceId: item.sourceId,
    publishedAt: item.publishedAt,
    score: item.score,
    matchedKeywords: item.matchedKeywords,
  }))

fs.writeFileSync(outPath, JSON.stringify(published, null, 2))
console.log(`Website-Feed exportiert (${published.length} Eintraege)`)
