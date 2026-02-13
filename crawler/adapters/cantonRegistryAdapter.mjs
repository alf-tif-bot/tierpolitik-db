const CANTONS = [
  'AG', 'AI', 'AR', 'BE', 'BL', 'BS', 'FR', 'GE', 'GL', 'GR', 'JU', 'LU', 'NE', 'NW', 'OW', 'SG', 'SH', 'SO', 'SZ', 'TG', 'TI', 'UR', 'VD', 'VS', 'ZG', 'ZH',
]

export function createCantonRegistryAdapter() {
  return {
    async fetch(source) {
      const fetchedAt = new Date().toISOString()
      const sinceYear = Number(source.options?.sinceYear ?? 2020)
      const enabledCantons = Array.isArray(source.options?.cantons) && source.options.cantons.length
        ? source.options.cantons
        : CANTONS

      return enabledCantons.map((canton) => ({
        sourceId: source.id,
        sourceUrl: source.url,
        externalId: `registry-${canton.toLowerCase()}-${sinceYear}`,
        title: `Kantonsparlament ${canton}: Quell-Adapter vorbereitet`,
        summary: `Scaffold für ${canton}. Historisierung ab ${sinceYear} vorgesehen.`,
        body: 'V2 Registry Placeholder – noch keine produktive Erfassung angebunden.',
        publishedAt: `${sinceYear}-01-01T00:00:00.000Z`,
        fetchedAt,
        language: 'de',
        score: 0,
        matchedKeywords: ['kanton', 'scaffold'],
        status: 'new',
        reviewReason: 'registry-scaffold',
        meta: {
          canton,
          sinceYear,
          scaffold: true,
          targetCoverage: 'all-cantons',
        },
      }))
    },
  }
}
