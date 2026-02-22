import fs from 'node:fs'

const cantonsPath = new URL('../config.cantonal-sources.json', import.meta.url)

const loadCantons = () => {
  try {
    const payload = JSON.parse(fs.readFileSync(cantonsPath, 'utf8'))
    return Array.isArray(payload) ? payload : []
  } catch {
    return []
  }
}

export function createCantonRegistryAdapter() {
  return {
    async fetch(source) {
      const fetchedAt = new Date().toISOString()
      const defaultSinceYear = Number(source.options?.sinceYear ?? 2020)
      const enabledCantons = Array.isArray(source.options?.cantons)
        ? new Set(source.options.cantons.map((c) => String(c).toUpperCase()))
        : null

      const entries = loadCantons()
        .filter((entry) => !enabledCantons || enabledCantons.has(String(entry?.canton || '').toUpperCase()))

      return entries.map((entry) => {
        const canton = String(entry.canton || '').toUpperCase()
        const sinceYear = Number(entry.sinceYear ?? defaultSinceYear)
        const parliament = String(entry.parliament || `Kantonsparlament ${canton}`).trim()
        const url = String(entry.url || source.url)

        return {
          sourceId: source.id,
          sourceUrl: url,
          externalId: `registry-${canton.toLowerCase()}-${sinceYear}`,
          title: `${parliament}: Quell-Adapter vorbereitet`,
          summary: `Scaffold für ${canton}. Historisierung ab ${sinceYear} vorgesehen.`,
          body: `V2 Registry Placeholder – ${parliament} (${url}). Noch keine produktive Erfassung angebunden.`,
          publishedAt: `${sinceYear}-01-01T00:00:00.000Z`,
          fetchedAt,
          language: 'de',
          score: 0,
          matchedKeywords: ['kanton', 'scaffold', canton.toLowerCase()],
          status: 'new',
          reviewReason: 'registry-scaffold',
          meta: {
            canton,
            parliament,
            sinceYear,
            scaffold: true,
            targetCoverage: 'all-cantons',
            url,
            adapterHint: entry.adapter || 'cantonRegistry',
          },
        }
      })
    },
  }
}
