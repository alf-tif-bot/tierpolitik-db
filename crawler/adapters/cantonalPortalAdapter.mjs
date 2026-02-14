import fs from 'node:fs'

const KEYWORDS = [
  'vorstoss',
  'vorstösse',
  'geschaefte',
  'geschäfte',
  'objets',
  'interventions',
  'motions',
  'postulats',
  'interpellationen',
  'kantonsrat',
  'grand-conseil',
  'grosser-rat',
  'landrat',
  'granconsiglio',
]

const asList = (value) => String(value || '')
  .split(',')
  .map((x) => x.trim())
  .filter(Boolean)

const scoreLink = (url = '', text = '') => {
  const combined = `${url} ${text}`.toLowerCase()
  return KEYWORDS.reduce((acc, kw) => (combined.includes(kw) ? acc + 1 : acc), 0)
}

const normalizeUrl = (href, baseUrl) => {
  try {
    return new URL(href, baseUrl).toString()
  } catch {
    return null
  }
}

const stripTags = (html = '') => String(html)
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const pickLanguage = (canton, pageText) => {
  if (['GE', 'JU', 'VD', 'VS', 'FR'].includes(canton)) return 'fr'
  if (canton === 'TI') return 'it'
  if (/\b(grand conseil|objets|interventions)\b/i.test(pageText)) return 'fr'
  if (/\b(gran consiglio)\b/i.test(pageText)) return 'it'
  return 'de'
}

const parseLinks = (html = '', baseUrl = '') => {
  const links = []
  const re = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  let m
  while ((m = re.exec(html))) {
    const href = normalizeUrl(m[1], baseUrl)
    if (!href || !href.startsWith('http')) continue
    const text = stripTags(m[2]).slice(0, 180)
    const rank = scoreLink(href, text)
    if (rank <= 0) continue
    links.push({ href, text, rank })
  }

  return [...new Map(links
    .sort((a, b) => b.rank - a.rank)
    .map((l) => [l.href, l])).values()].slice(0, 8)
}

export function createCantonalPortalAdapter() {
  return {
    async fetch(source) {
      const fetchedAt = new Date().toISOString()
      const cantonFilter = new Set(asList(source.options?.cantons).map((c) => c.toUpperCase()))
      const rows = []
      const registryUrl = source.options?.registryUrl || 'data/cantonal-source-registry.json'

      let registry
      if (String(registryUrl).startsWith('http')) {
        const registryResponse = await fetch(registryUrl, {
          headers: { 'user-agent': 'tierpolitik-crawler/portal-adapter' },
          signal: AbortSignal.timeout(15000),
        })
        if (!registryResponse.ok) throw new Error(`cantonal registry unavailable (${registryResponse.status})`)
        registry = await registryResponse.json()
      } else {
        const text = fs.readFileSync(new URL(`../../${registryUrl.replace(/^\.\//, '')}`, import.meta.url), 'utf8')
        registry = JSON.parse(text)
      }

      const entries = Array.isArray(registry?.sources) ? registry.sources : []

      for (const entry of entries) {
        const canton = String(entry?.canton || '').toUpperCase()
        if (!canton || (cantonFilter.size && !cantonFilter.has(canton))) continue

        const pageUrl = entry?.probe?.finalUrl || entry?.url
        if (!pageUrl || entry?.probe?.httpStatus === 403) continue

        try {
          const response = await fetch(pageUrl, {
            headers: { 'user-agent': 'tierpolitik-crawler/portal-adapter' },
            redirect: 'follow',
            signal: AbortSignal.timeout(12000),
          })
          if (!response.ok) continue

          const html = await response.text()
          const title = (html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || entry.parliament || `${canton} Parlament`)
            .replace(/\s+/g, ' ')
            .trim()
          const links = parseLinks(html, response.url)
          const pageText = stripTags(html).slice(0, 5000)
          const language = pickLanguage(canton, pageText)

          rows.push({
            sourceId: source.id,
            sourceUrl: response.url,
            externalId: `cantonal-portal-${canton.toLowerCase()}`,
            title: `${entry.parliament}: Portal-Parsing`,
            summary: `${title} – ${links.length} relevante Linkziele erkannt`,
            body: links.length
              ? links.map((l, idx) => `${idx + 1}. ${l.text || 'Ohne Titel'} – ${l.href}`).join('\n')
              : `Portal erreichbar (${response.url}), aber noch ohne extrahierte Vorstoss-Links.`,
            publishedAt: fetchedAt,
            fetchedAt,
            language,
            score: Math.min(0.4 + links.length * 0.05, 0.85),
            matchedKeywords: ['kanton', canton.toLowerCase(), ...new Set(links.flatMap((l) => KEYWORDS.filter((kw) => `${l.href} ${l.text}`.toLowerCase().includes(kw))))].slice(0, 12),
            status: 'new',
            reviewReason: links.length ? 'cantonal-portal-links' : 'cantonal-portal-reachable',
            meta: {
              canton,
              parliament: entry.parliament,
              readiness: entry.readiness,
              extractedLinkCount: links.length,
              extractedLinks: links,
              adapterHint: 'cantonalPortal',
            },
          })
        } catch {
          // keep crawl robust; unresolved cantons remain in registry
        }
      }

      return rows
    },
  }
}
