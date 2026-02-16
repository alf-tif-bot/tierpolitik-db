import fs from 'node:fs'

const BASE_KEYWORDS = [
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

const LINK_NOISE_KEYWORDS = [
  'kontakt',
  'contact',
  'impressum',
  'datenschutz',
  'accessibilite',
  'barrierefreiheit',
  'sitemap',
  'newsletter',
  'medienmitteilung',
  'communique',
  '.ics',
  'direkt zum inhalt',
  'skiplink',
  'service navigation',
  'langue active',
  'sprungmarke',
]

const LINK_NOISE_EXTENSIONS = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.zip', '.jpg', '.jpeg', '.png']

const CANTON_KEYWORDS = {
  AG: ['grweb', 'grossrat', 'geschaefte'],
  AR: ['parlamentsdienst', 'kantonsrat', 'vorstoss'],
  BE: ['gr.be.ch', 'grosser-rat', 'geschaefte'],
  BL: ['landrat', 'geschaefte-des-landrats'],
  GE: ['grandconseil', 'recherche', 'dossiers'],
  JU: ['interventions-parlementaires-deposees', 'questions-ecrites', 'interpellations'],
  OW: ['kantonsratview', 'kantonsratmain', 'geschaefte'],
  SZ: ['geschaefte-des-kantonsrats', 'behoerden/kantonsrat'],
  TI: ['gran consiglio', 'ricerca messaggi e atti', 'atti parlamentari', 'mozioni', 'interrogazioni'],
  VD: ['objets-et-rapports-de-commissions', 'grand conseil', 'bulletin'],
  VS: ['objets-parlementaires', 'interventions-parlementaires'],
  TG: ['parlament.tg.ch', 'grosser-rat', 'geschaefte'],
  ZG: ['geschaefte-des-kantonsrats', 'behoerden/kantonsrat'],
  ZH: ['kantonsrat.zh.ch/geschaefte', 'geschaeft'],
}

const CANTON_FALLBACK_LINKS = {
  AG: [
    { href: 'https://www.ag.ch/de/ueber-uns/grosser-rat/geschaefte', text: 'Geschäfte Grosser Rat' },
    { href: 'https://www.ag.ch/grossrat/grweb/', text: 'GRweb Aargau' },
  ],
  AR: [
    { href: 'https://ar.ch/kantonsrat/parlamentsdienst', text: 'Parlamentsdienst AR' },
    { href: 'https://ar.ch/kantonsrat/parlamentsdienst/parlamentarische-vorstoesse', text: 'Parlamentarische Vorstösse AR' },
  ],
  BE: [
    { href: 'https://www.gr.be.ch/de/start/geschaefte.html', text: 'Geschäfte Grosser Rat Bern' },
    { href: 'https://www.gr.be.ch/de/start/suche-geschaefte.html', text: 'Geschäftssuche Grosser Rat Bern' },
  ],
  BL: [
    { href: 'https://www.baselland.ch/politik-und-behorden/landrat-parlament/geschaefte-des-landrats', text: 'Geschäfte des Landrats BL' },
    { href: 'https://bl.ratsinfomanagement.net/', text: 'Ratsinfo BL' },
  ],
  BS: [
    { href: 'https://grosserrat.bs.ch/geschaefte', text: 'Geschäfte Grosser Rat BS' },
    { href: 'https://grosserrat.bs.ch/geschaefte/suche', text: 'Geschäftssuche Grosser Rat BS' },
  ],
  FR: [
    { href: 'https://www.fr.ch/parlinfo', text: 'Parlinfo Fribourg' },
    { href: 'https://www.fr.ch/parlinfo/programmes-et-dates-des-sessions-du-grand-conseil', text: 'Sessions Grand Conseil FR' },
  ],
  GE: [
    { href: 'https://ge.ch/grandconseil/recherche-objets', text: 'Recherche objets parlementaires' },
    { href: 'https://ge.ch/grandconseil/search', text: 'Recherche Grand Conseil' },
    { href: 'https://ge.ch/grandconseil/memorial/dossiers/', text: 'Mémorial – Dossiers' },
  ],
  TI: [
    { href: 'https://www4.ti.ch/poteri/gc/ricerca-messaggi-e-atti/ricerca/risultati', text: 'Ricerca messaggi e atti' },
    { href: 'https://www4.ti.ch/index.php?id=83058', text: 'Ricerca messaggi governativi e atti parlamentari' },
  ],
  VD: [
    { href: 'https://www.vd.ch/gc/objets-et-rapports-de-commissions', text: 'Objets et rapports de commissions' },
    { href: 'https://www.vd.ch/toutes-les-autorites/grand-conseil/bulletin-du-grand-conseil', text: 'Bulletin du Grand Conseil' },
  ],
  VS: [
    { href: 'https://www.vs.ch/fr/web/gc/objets-parlementaires', text: 'Objets parlementaires' },
    { href: 'https://www.vs.ch/fr/web/gc/interventions-parlementaires', text: 'Interventions parlementaires' },
  ],
  GR: [
    { href: 'https://gr.ratsinfomanagement.net/', text: 'Ratsinfo Graubünden' },
    { href: 'https://www.gr.ch/DE/institutionen/parlament/Seiten/geschaefte.aspx', text: 'Geschäfte Grosser Rat GR' },
  ],
  SO: [
    { href: 'https://ratsinfo.so.ch/', text: 'Ratsinfo Solothurn' },
    { href: 'https://ratsinfo.so.ch/geschaefte', text: 'Geschäfte' },
    { href: 'https://ratsinfo.so.ch/interventionen', text: 'Interventionen' },
  ],
  LU: [
    { href: 'https://www.lu.ch/kr/geschaefte', text: 'Geschäfte Kantonsrat Luzern' },
    { href: 'https://www.lu.ch/kr/geschaefte?jahr=2020', text: 'Geschäfte ab 2020' },
  ],
  SG: [
    { href: 'https://www.ratsinfo.sg.ch/', text: 'Ratsinfo St. Gallen' },
    { href: 'https://www.ratsinfo.sg.ch/geschaefte', text: 'Geschäfte Kantonsrat SG' },
  ],
  SH: [
    { href: 'https://www.sh.ch/CMS/Webseite/Kanton-Schaffhausen/Beh-rde/Kantonsrat-2215832-DE.html', text: 'Kantonsrat Schaffhausen' },
    { href: 'https://www.sh.ch/CMS/Webseite/Kanton-Schaffhausen/Parlamentarische-Vorstoesse-3341988-DE.html', text: 'Parlamentarische Vorstösse SH' },
  ],
  UR: [
    { href: 'https://www.ur.ch/landrat/geschaefte', text: 'Geschäfte Landrat Uri' },
    { href: 'https://www.ur.ch/landrat', text: 'Landrat Uri' },
  ],
  NW: [
    { href: 'https://www.nw.ch/landrat', text: 'Landrat Nidwalden' },
    { href: 'https://www.nw.ch/landratmain', text: 'Landratmain Nidwalden' },
  ],
  OW: [
    { href: 'https://www.ow.ch/kantonsratview', text: 'Kantonsrat Obwalden' },
    { href: 'https://www.ow.ch/kantonsratview?open=VOR', text: 'Vorstösse Kantonsrat OW' },
  ],
  TG: [
    { href: 'https://parlament.tg.ch/', text: 'Grosser Rat Thurgau' },
    { href: 'https://parlament.tg.ch/traktanden-und-vorlagen', text: 'Traktanden und Vorlagen TG' },
  ],
  JU: [
    { href: 'https://www.jura.ch/fr/Autorites/PLT/Documents-du-Parlement/Suivi-des-interventions/Suivi-des-interventions.html', text: 'Suivi des interventions JU' },
    { href: 'https://www.jura.ch/fr/Autorites/PLT/Interventions-parlementaires-deposees/Interventions-parlementaires-deposees.html', text: 'Interventions parlementaires JU' },
  ],
}

const asList = (value) => String(value || '')
  .split(',')
  .map((x) => x.trim())
  .filter(Boolean)

const scoreLink = (canton = '', url = '', text = '') => {
  const combined = `${url} ${text}`.toLowerCase()
  const cantonKeywords = CANTON_KEYWORDS[canton] || []
  const keywords = [...BASE_KEYWORDS, ...cantonKeywords]
  const positive = keywords.reduce((acc, kw) => (combined.includes(kw) ? acc + 1 : acc), 0)
  const penalty = LINK_NOISE_KEYWORDS.reduce((acc, kw) => (combined.includes(kw) ? acc + 2 : acc), 0)
  return Math.max(0, positive - penalty)
}

const normalizeUrl = (href, baseUrl) => {
  try {
    return new URL(href, baseUrl).toString()
  } catch {
    return null
  }
}

const isSameDocumentAnchor = (href = '', baseUrl = '') => {
  try {
    const target = new URL(href, baseUrl)
    const base = new URL(baseUrl)
    return target.origin === base.origin
      && target.pathname === base.pathname
      && target.search === base.search
      && Boolean(target.hash)
  } catch {
    return false
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

const isLikelyNoiseLink = (href = '', text = '') => {
  const merged = `${href} ${text}`.toLowerCase()
  if (LINK_NOISE_KEYWORDS.some((kw) => merged.includes(kw))) return true
  return LINK_NOISE_EXTENSIONS.some((ext) => href.toLowerCase().includes(ext))
}

const isSameSiteOrParliamentHost = (href = '', baseUrl = '') => {
  try {
    const link = new URL(href)
    const base = new URL(baseUrl)
    const linkHost = link.hostname.replace(/^www\./, '')
    const baseHost = base.hostname.replace(/^www\./, '')
    if (linkHost === baseHost) return true

    const linkPath = `${link.pathname}${link.search}`.toLowerCase()
    const sameCountryGov = linkHost.endsWith('.ch') && baseHost.endsWith('.ch')
    const hasParliamentPathHint = [
      'parlament', 'parliament', 'grandconseil', 'kantonsrat', 'landrat', 'grosserrat',
      'vorstoss', 'vorstoesse', 'objets', 'interventions', 'geschaefte', 'gesch%C3%A4fte'.toLowerCase(),
    ].some((token) => linkPath.includes(token))

    if (sameCountryGov && hasParliamentPathHint) return true
    return linkHost.includes('ratsinfo') || linkHost.includes('sitzungsdienst')
  } catch {
    return false
  }
}

const parseLinks = (html = '', baseUrl = '', canton = '') => {
  const links = []
  const re = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  let m
  while ((m = re.exec(html))) {
    const href = normalizeUrl(m[1], baseUrl)
    if (!href || !href.startsWith('http')) continue
    if (isSameDocumentAnchor(href, baseUrl)) continue
    const text = stripTags(m[2]).slice(0, 180)
    if (text.length < 3) continue
    if (isLikelyNoiseLink(href, text)) continue
    if (!isSameSiteOrParliamentHost(href, baseUrl)) continue
    const rank = scoreLink(canton, href, text)
    if (rank < 2) continue
    links.push({ href, text, rank })
  }

  return [...new Map(links
    .sort((a, b) => b.rank - a.rank)
    .map((l) => [l.href, l])).values()].slice(0, 10)
}

const appendFallbackLinks = (canton, links) => {
  const fallback = CANTON_FALLBACK_LINKS[canton] || []
  if (!fallback.length) return links

  const merged = [...links]
  for (const item of fallback) {
    if (merged.some((entry) => entry.href === item.href)) continue
    merged.push({ ...item, rank: scoreLink(canton, item.href, item.text) || 1 })
  }

  return merged
    .sort((a, b) => b.rank - a.rank)
    .slice(0, 10)
}

const candidateUrlsFromRegistry = (entry) => {
  const fromProbe = Array.isArray(entry?.probe?.candidatesTried)
    ? entry.probe.candidatesTried
      .filter((candidate) => candidate?.ok)
      .map((candidate) => candidate?.finalUrl || candidate?.url)
    : []

  const explicitCandidates = Array.isArray(entry?.probe?.candidatesTried)
    ? entry.probe.candidatesTried.map((candidate) => candidate?.url)
    : []

  const configuredCandidates = Array.isArray(entry?.urlCandidates)
    ? entry.urlCandidates
    : []

  return [...new Set([
    entry?.probe?.finalUrl,
    entry?.url,
    ...configuredCandidates,
    ...fromProbe,
    ...explicitCandidates,
  ].filter(Boolean))]
}

const fetchFirstReachable = async (urls = []) => {
  for (const url of urls) {
    try {
      const response = await fetch(url, {
        headers: { 'user-agent': 'tierpolitik-crawler/portal-adapter' },
        redirect: 'follow',
        signal: AbortSignal.timeout(12000),
      })
      if (!response.ok) continue
      const html = await response.text()
      return { response, html, usedUrl: url }
    } catch {
      // try next candidate
    }
  }
  return null
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

        const candidateUrls = candidateUrlsFromRegistry(entry)
        if (!candidateUrls.length || entry?.probe?.httpStatus === 403) continue

        const fetched = await fetchFirstReachable(candidateUrls)
        if (!fetched) continue

        const { response, html, usedUrl } = fetched

        const title = (html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || entry.parliament || `${canton} Parlament`)
          .replace(/\s+/g, ' ')
          .trim()
        const parsedLinks = parseLinks(html, response.url, canton)
        const links = appendFallbackLinks(canton, parsedLinks)
        const pageText = stripTags(html).slice(0, 5000)
        const language = pickLanguage(canton, pageText)

        const topLink = links[0]?.text || 'Parlamentsgeschäfte'

        rows.push({
          sourceId: source.id,
          sourceUrl: response.url,
          externalId: `cantonal-portal-${canton.toLowerCase()}`,
          title: `${canton} · ${entry.parliament}: ${topLink}`.slice(0, 260),
          summary: `${title} – ${links.length} relevante Linkziele erkannt (Leitlink: ${topLink})`.slice(0, 300),
          body: links.length
            ? links.map((l, idx) => `${idx + 1}. ${l.text || 'Ohne Titel'} – ${l.href}`).join('\n')
            : `Portal erreichbar (${response.url}), aber noch ohne extrahierte Vorstoss-Links.`,
          publishedAt: fetchedAt,
          fetchedAt,
          language,
          score: Math.min(0.4 + links.length * 0.05, 0.85),
          matchedKeywords: ['kanton', canton.toLowerCase(), ...new Set(links.flatMap((l) => [...BASE_KEYWORDS, ...(CANTON_KEYWORDS[canton] || [])].filter((kw) => `${l.href} ${l.text}`.toLowerCase().includes(kw))))].slice(0, 12),
          status: 'new',
          reviewReason: links.length ? 'cantonal-portal-links' : 'cantonal-portal-reachable',
          meta: {
            canton,
            parliament: entry.parliament,
            readiness: entry.readiness,
            extractedLinkCount: links.length,
            extractedLinks: links,
            adapterHint: 'cantonalPortal',
            candidateUrlsTried: candidateUrls.slice(0, 8),
            fetchUrl: usedUrl,
          },
        })
      }

      return rows
    },
  }
}
