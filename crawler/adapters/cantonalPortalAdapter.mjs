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

const ANIMAL_POLICY_LINK_KEYWORDS = [
  'tier',
  'tierschutz',
  'tierwohl',
  'wildtier',
  'jagd',
  'biodivers',
  'wolf',
  'fuchs',
  'faune',
  'animaux',
  'animal',
  'animali',
  'caccia',
  'chasse',
]

const PARLIAMENT_BUSINESS_LINK_KEYWORDS = [
  'vorstoss',
  'vorstoesse',
  'vorstosse',
  'vorstösse',
  'objets',
  'interventions',
  'geschaefte',
  'geschäfte',
  'traktanden',
  'session',
  'sessions',
  'ricerca',
  'atti',
  'motion',
  'postulat',
  'interpellation',
  'initiative',
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
  'medienmitteilungen',
  'medien',
  'communique',
  'actualite',
  'actualites',
  'news',
  'akkreditierung',
  'drucken',
  'imprimer',
  'print',
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
  AI: [
    { href: 'https://www.ai.ch/politik/grosser-rat/geschaefte', text: 'Geschäfte Grosser Rat AI' },
    { href: 'https://www.ai.ch/politik/grosser-rat/protokolle', text: 'Protokolle Grosser Rat AI' },
  ],
  GL: [
    { href: 'https://www.gl.ch/parlament/landrat/geschaefte/vorstoesse.html/248', text: 'Vorstösse Landrat GL' },
    { href: 'https://www.gl.ch/parlament/landrat/geschaefte/aktuelle-geschaefte.html/241', text: 'Aktuelle Geschäfte Landrat GL' },
  ],
  NE: [
    { href: 'https://www.ne.ch/autorites/GC/objets/Pages/accueil.aspx', text: 'Objets du Grand Conseil NE' },
    { href: 'https://www.ne.ch/autorites/GC/objets/Pages/recherche.aspx', text: 'Recherche objets Grand Conseil NE' },
  ],
  ZG: [
    { href: 'https://zg.ch/de/staat-politik/geschaefte-des-kantonsrats', text: 'Geschäfte des Kantonsrats ZG' },
    { href: 'https://zg.ch/de/behoerden/kantonsrat', text: 'Kantonsrat Zug' },
  ],
  ZH: [
    { href: 'https://www.kantonsrat.zh.ch/geschaefte/', text: 'Geschäfte Kantonsrat Zürich' },
    { href: 'https://www.kantonsrat.zh.ch/geschaefte/geschaeft/?id=', text: 'Geschäftssuche Kantonsrat Zürich' },
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
  const animalBonus = ANIMAL_POLICY_LINK_KEYWORDS.reduce((acc, kw) => (combined.includes(kw) ? acc + 2 : acc), 0)
  const parliamentBusinessBonus = PARLIAMENT_BUSINESS_LINK_KEYWORDS.reduce((acc, kw) => (combined.includes(kw) ? acc + 1 : acc), 0)
  const penalty = LINK_NOISE_KEYWORDS.reduce((acc, kw) => (combined.includes(kw) ? acc + 2 : acc), 0)

  const utilityPenalty = /(?:^|\s)(print|imprimer|drucken)(?:\s|$)/i.test(text) ? 3 : 0
  const baseScore = positive + animalBonus + parliamentBusinessBonus - penalty - utilityPenalty
  return Math.max(0, baseScore)
}

const hasAnimalTheme = (url = '', text = '') => {
  if (looksLikePersonOrMemberPage(url, text)) return false
  const combined = `${url} ${text}`.toLowerCase()
  return ANIMAL_POLICY_LINK_KEYWORDS.some((kw) => {
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    if (kw.length <= 4) return new RegExp(`\\b${escaped}\\b`, 'i').test(combined)
    return combined.includes(kw)
  })
}

const mergeAbortSignals = (...signals) => {
  const valid = signals.filter(Boolean)
  if (!valid.length) return undefined
  const controller = new AbortController()

  const abortFrom = (source) => {
    if (!controller.signal.aborted) controller.abort(source?.reason)
  }

  for (const signal of valid) {
    if (signal.aborted) {
      abortFrom(signal)
      break
    }
    signal.addEventListener('abort', () => abortFrom(signal), { once: true })
  }

  return controller.signal
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

  const textLower = String(text || '').toLowerCase().trim()
  if (['drucken', 'imprimer', 'print', 'teilen', 'share'].includes(textLower)) return true

  if (href.toLowerCase().includes('/actualites/') || href.toLowerCase().includes('/news/')) return true
  return LINK_NOISE_EXTENSIONS.some((ext) => href.toLowerCase().includes(ext))
}

const looksLikePersonOrMemberPage = (href = '', text = '') => {
  const merged = `${href} ${text}`.toLowerCase()
  return [
    '/membres',
    '/deput',
    '/depute',
    '/deputes',
    '/deputees',
    '/mitglied',
    '/mitglieder',
    '/person',
    '/portrait',
    '/biographie',
    '/fraktionen',
    '/fraktion',
    '/kommissionen',
    '/commissions',
  ].some((token) => merged.includes(token))
}

const hasBusinessToken = (href = '', text = '') => {
  const merged = `${href} ${text}`.toLowerCase()
  return PARLIAMENT_BUSINESS_LINK_KEYWORDS.some((kw) => merged.includes(kw))
}

const hasBusinessIdSignal = (href = '') => {
  const lower = String(href || '').toLowerCase()
  return /[?&](id|geschaeftid|affairid|objektid|objectid|geschaeft)=\d+/.test(lower)
    || /\/(geschaeft|geschäft|objets|interventions|vorstoesse|vorstosse|vorstoss|motion|postulat|interpellation)\/?\d{2,}/.test(lower)
}

const isLikelyParliamentBusinessLink = (href = '', text = '') => {
  if (looksLikePersonOrMemberPage(href, text)) return false
  const themed = hasAnimalTheme(href, text)
  if (hasBusinessToken(href, text)) return true
  if (hasBusinessIdSignal(href)) return true
  if (themed && /\b(motion|postulat|interpellation|initiative|vorstoss|vorstösse|jagd|tierschutz|animaux|faune)\b/i.test(String(text || ''))) return true
  return false
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

const canonicalizeLinkUrl = (href = '') => {
  try {
    const parsed = new URL(href)
    parsed.hash = ''
    if (parsed.pathname !== '/') parsed.pathname = parsed.pathname.replace(/\/+$/, '')
    parsed.searchParams.sort()
    return parsed.toString()
  } catch {
    return href
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
    const themed = hasAnimalTheme(href, text)
    const businessLike = isLikelyParliamentBusinessLink(href, text)
    if (!businessLike && !themed) continue
    if (rank < 2) continue
    if (!themed && rank < 3) continue
    links.push({ href, text, rank, themed, businessLike })
  }

  return [...new Map(links
    .sort((a, b) => b.rank - a.rank)
    .map((l) => [canonicalizeLinkUrl(l.href), l])).values()].slice(0, 10)
}

const appendFallbackLinks = (canton, links) => {
  const fallback = CANTON_FALLBACK_LINKS[canton] || []

  const merged = [...links]
  for (const item of fallback) {
    const fallbackKey = canonicalizeLinkUrl(item.href)
    if (merged.some((entry) => canonicalizeLinkUrl(entry.href) === fallbackKey)) continue
    merged.push({ ...item, rank: scoreLink(canton, item.href, item.text) || 1 })
  }

  return [...new Map(merged
    .sort((a, b) => b.rank - a.rank)
    .map((l) => [canonicalizeLinkUrl(l.href), l])).values()]
    .slice(0, 10)
}

const isGenericSitzungsdienstLanding = (href = '') => {
  const lower = String(href || '').toLowerCase()
  if (!lower.includes('sitzungsdienst.net')) return false
  try {
    const parsed = new URL(href)
    const path = String(parsed.pathname || '/').replace(/\/+$/, '') || '/'
    return (path === '/' || path === '/index.html') && !parsed.search
  } catch {
    return lower.endsWith('sitzungsdienst.net') || lower.endsWith('sitzungsdienst.net/')
  }
}

const rankCandidateUrl = (entry, href = '') => {
  const lower = String(href || '').toLowerCase()
  let score = 0
  if (!lower) return score
  if (lower === String(entry?.probe?.finalUrl || '').toLowerCase()) score += 7
  if (lower === String(entry?.url || '').toLowerCase()) score += 5
  if (hasBusinessToken(href, href)) score += 4
  if (hasBusinessIdSignal(href)) score += 4
  if (hasAnimalTheme(href, href)) score += 2
  if (/\/20\d{2}\b/.test(lower) || /[?&](jahr|year)=20\d{2}/.test(lower)) score += 2
  if (isGenericSitzungsdienstLanding(href)) score -= 8
  if (/\/(kontakt|impressum|actualites|news)\b/.test(lower)) score -= 4
  return score
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

  const unique = [...new Set([
    entry?.probe?.finalUrl,
    entry?.url,
    ...configuredCandidates,
    ...fromProbe,
    ...explicitCandidates,
  ].filter(Boolean))]

  return unique
    .sort((a, b) => rankCandidateUrl(entry, b) - rankCandidateUrl(entry, a))
}

const fetchReachablePages = async (urls = [], limit = 3, parentSignal) => {
  const pages = []

  for (const url of urls) {
    if (pages.length >= limit) break
    try {
      const response = await fetch(url, {
        headers: { 'user-agent': 'tierpolitik-crawler/portal-adapter' },
        redirect: 'follow',
        signal: mergeAbortSignals(parentSignal, AbortSignal.timeout(12000)),
      })
      if (!response.ok) continue
      const html = await response.text()
      pages.push({ response, html, usedUrl: url })
    } catch {
      // try next candidate
    }
  }

  return pages
}

export function createCantonalPortalAdapter() {
  return {
    async fetch(source, { signal } = {}) {
      const fetchedAt = new Date().toISOString()
      const cantonFilter = new Set(asList(source.options?.cantons).map((c) => c.toUpperCase()))
      const rows = []
      const registryUrl = source.options?.registryUrl || 'data/cantonal-source-registry.json'

      let registry
      if (String(registryUrl).startsWith('http')) {
        const registryResponse = await fetch(registryUrl, {
          headers: { 'user-agent': 'tierpolitik-crawler/portal-adapter' },
          signal: mergeAbortSignals(signal, AbortSignal.timeout(15000)),
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

        const fetchedPages = await fetchReachablePages(candidateUrls, 3, signal)
        if (!fetchedPages.length) continue

        const leadPage = fetchedPages[0]
        const { response, html } = leadPage

        const title = (html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || entry.parliament || `${canton} Parlament`)
          .replace(/\s+/g, ' ')
          .trim()

        const parsedLinks = fetchedPages.flatMap(({ html: pageHtml, response: pageResponse }) => parseLinks(pageHtml, pageResponse.url, canton))
        const links = appendFallbackLinks(canton, parsedLinks)
        const themedLinkCount = links.filter((link) => hasAnimalTheme(link.href, link.text)).length
        const pageText = fetchedPages.map((p) => stripTags(p.html).slice(0, 2500)).join('\n')
        const language = pickLanguage(canton, pageText)

        const topLink = links[0]?.text || 'Parlamentsgeschäfte'

        rows.push({
          sourceId: source.id,
          sourceUrl: response.url,
          externalId: `cantonal-portal-${canton.toLowerCase()}`,
          title: `${canton} · ${entry.parliament}: ${topLink}`.slice(0, 260),
          summary: `${title} – ${links.length} relevante Linkziele erkannt (${themedLinkCount} thematisch, ${fetchedPages.length} Seiten gescannt, Leitlink: ${topLink})`.slice(0, 300),
          body: links.length
            ? links.map((l, idx) => `${idx + 1}. ${l.text || 'Ohne Titel'} – ${l.href}`).join('\n')
            : `Portal erreichbar (${response.url}), aber noch ohne extrahierte Vorstoss-Links.`,
          publishedAt: fetchedAt,
          fetchedAt,
          language,
          score: Math.min(0.4 + links.length * 0.05 + Math.min(0.12, fetchedPages.length * 0.03), 0.9),
          matchedKeywords: ['kanton', canton.toLowerCase(), ...new Set(links.flatMap((l) => [...BASE_KEYWORDS, ...ANIMAL_POLICY_LINK_KEYWORDS, ...(CANTON_KEYWORDS[canton] || [])].filter((kw) => `${l.href} ${l.text}`.toLowerCase().includes(kw))))].slice(0, 12),
          status: 'new',
          reviewReason: links.length ? 'cantonal-portal-links' : 'cantonal-portal-reachable',
          meta: {
            canton,
            parliament: entry.parliament,
            readiness: entry.readiness,
            extractedLinkCount: links.length,
            themedLinkCount,
            extractedLinks: links,
            adapterHint: 'cantonalPortal',
            candidateUrlsTried: candidateUrls.slice(0, 8),
            fetchedPages: fetchedPages.map((p) => ({ requestedUrl: p.usedUrl, finalUrl: p.response.url })).slice(0, 3),
          },
        })
      }

      return rows
    },
  }
}
