import fs from 'node:fs'

const cantonsPath = new URL('../crawler/config.cantonal-sources.json', import.meta.url)
const outPath = new URL('../data/cantonal-source-registry.json', import.meta.url)

const cantons = JSON.parse(fs.readFileSync(cantonsPath, 'utf8'))

const classifyReadiness = (url = '') => {
  const u = String(url).toLowerCase()
  if (u.includes('ratsinfo') || u.includes('grosserrat') || u.includes('kantonsrat')) return 'platform-likely'
  if (u.includes('parlament') || u.includes('grand-conseil') || u.includes('grandconseil')) return 'site-discovery-needed'
  return 'manual-discovery-needed'
}

const sourceRows = cantons.map((entry) => {
  const readiness = classifyReadiness(entry.url)
  return {
    id: `ch-canton-${String(entry.canton).toLowerCase()}`,
    canton: entry.canton,
    parliament: entry.parliament,
    adapter: entry.adapter,
    url: entry.url,
    sinceYear: entry.sinceYear,
    status: 'scaffolded',
    readiness,
  }
})

const byReadiness = sourceRows.reduce((acc, row) => {
  acc[row.readiness] = (acc[row.readiness] || 0) + 1
  return acc
}, {})

const registry = {
  generatedAt: new Date().toISOString(),
  coverage: {
    target: 'all-cantons',
    sinceYearMin: 2020,
    totalCantons: cantons.length,
    byReadiness,
  },
  sources: sourceRows,
}

fs.writeFileSync(outPath, JSON.stringify(registry, null, 2))
console.log('Cantonal source registry built', {
  outPath: outPath.pathname,
  totalCantons: registry.coverage.totalCantons,
  byReadiness,
})
