import fs from 'node:fs'
import crypto from 'node:crypto'

const municipalSourcesPath = new URL('../config.municipal-sources.json', import.meta.url)

const MOTION_KEYWORDS = [
  'motion', 'postulat', 'interpellation', 'anfrage', 'antrag', 'vorstoss', 'vorstösse',
  'schriftliche anfrage', 'dringliche motion', 'dringliches postulat', 'parlamentarische initiative',
]

const STATUS_KEYWORDS = [
  'eingereicht', 'hängig', 'haengig', 'überwiesen', 'ueberwiesen', 'abgelehnt', 'angenommen',
  'abgeschrieben', 'zurückgezogen', 'zurueckgezogen', 'beantwortet', 'in bearbeitung',
]

const normalizeText = (value = '') => String(value)
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const parseList = (value) => String(value || '')
  .split(',')
  .map((x) => x.trim().toLowerCase())
  .filter(Boolean)

const detectTypeHint = (text = '') => {
  const low = text.toLowerCase()
  if (low.includes('dringliche motion') || low.includes('motion')) return 'Motion'
  if (low.includes('dringliches postulat') || low.includes('postulat')) return 'Postulat'
  if (low.includes('interpellation')) return 'Interpellation'
  if (low.includes('schriftliche anfrage') || low.includes('anfrage')) return 'Anfrage'
  if (low.includes('parlamentarische initiative') || low.includes('initiative')) return 'Volksinitiative'
  return null
}

const detectStatusHint = (text = '') => {
  const low = text.toLowerCase()
  if (low.includes('überwiesen') || low.includes('ueberwiesen') || low.includes('hängig') || low.includes('haengig') || low.includes('in bearbeitung')) return 'In Beratung'
  if (low.includes('angenommen') || low.includes('erheblich erklärt') || low.includes('erheblich erklaert')) return 'Angenommen'
  if (low.includes('abgelehnt') || low.includes('nicht überwiesen') || low.includes('nicht ueberwiesen')) return 'Abgelehnt'
  if (low.includes('abgeschrieben') || low.includes('abgeschlosse')) return 'Abgeschrieben'
  if (low.includes('zurückgezogen') || low.includes('zurueckgezogen')) return 'Zurückgezogen'
  if (low.includes('eingereicht') || low.includes('neu')) return 'Eingereicht'
  return null
}

const classifyMunicipalEntry = (text = '') => {
  const low = String(text).toLowerCase()
  if (low.includes('interpellation')) return 'Interpellation'
  if (low.includes('postulat')) return 'Postulat'
  if (low.includes('motion')) return 'Motion'
  if (low.includes('anfrage')) return 'Anfrage'
  if (low.includes('vorstoss') || low.includes('vorstösse')) return 'Vorstösse'
  if (low.includes('antwort')) return 'Antworten auf Anfragen'
  if (low.includes('kommission')) return 'Kommissionsgeschäft'
  return 'Parlamentsgeschäft'
}

const normalizeMunicipalTitle = (raw = '') => {
  const text = String(raw || '').replace(/\s+/g, ' ').trim()
  const low = text.toLowerCase()

  if (!text) return 'Unbenanntes Parlamentsgeschäft'
  if (low.includes('vorstösse und grsr-revisionen')) return ''
  if (low.includes('antworten auf kleine anfragen')) return ''

  return text
}

const extractHtmlTitle = (html = '') => {
  const h1 = normalizeText(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || '')
  if (h1) return h1
  const og = normalizeText(html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i)?.[1] || '')
  if (og) return og
  const t = normalizeText(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || '')
  return t
}

const enrichMunicipalTitle = async (href, fallbackTitle) => {
  const cleanedFallback = normalizeMunicipalTitle(fallbackTitle)
  if (cleanedFallback) return cleanedFallback
  try {
    const res = await fetch(href, {
      headers: { 'user-agent': 'tierpolitik-crawler/municipal-adapter' },
      redirect: 'follow',
      signal: AbortSignal.timeout(9000),
    })
    if (!res.ok) return cleanedFallback || 'Parlamentsgeschäft'
    const html = await res.text()
    const extracted = normalizeMunicipalTitle(extractHtmlTitle(html))
    return extracted || cleanedFallback || 'Parlamentsgeschäft'
  } catch {
    return cleanedFallback || 'Parlamentsgeschäft'
  }
}

const scoreLink = (href = '', text = '') => {
  const low = `${href} ${text}`.toLowerCase()
  const motionHits = MOTION_KEYWORDS.reduce((acc, kw) => (low.includes(kw) ? acc + 1 : acc), 0)
  const statusHits = STATUS_KEYWORDS.reduce((acc, kw) => (low.includes(kw) ? acc + 1 : acc), 0)
  return motionHits * 2 + statusHits
}

const normalizeUrl = (href, baseUrl) => {
  try {
    return new URL(href, baseUrl).toString()
  } catch {
    return null
  }
}

const isOverviewUrl = (href = '') => {
  const low = String(href || '').toLowerCase()
  return low.includes('vorstoesse-und-grsr-revisionen') || low.includes('antworten-auf-kleine-anfragen')
}

const isOverviewTitle = (title = '') => {
  const low = String(title || '').toLowerCase()
  return low.includes('übersichtsseite') || low.includes('vorstösse und grsr-revisionen') || low.includes('antworten auf kleine anfragen')
}

const isBernDetailUrl = (href = '') => /(?:\/geschaefte\/)?detail\.php\?gid=[a-f0-9]+/i.test(String(href || ''))

const parseLinks = (html = '', baseUrl = '') => {
  const links = []
  const re = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  let m
  while ((m = re.exec(html))) {
    const href = normalizeUrl(m[1], baseUrl)
    if (!href || !href.startsWith('http')) continue
    const text = normalizeText(m[2]).slice(0, 220)
    let score = scoreLink(href, text)
    if (isBernDetailUrl(href)) score = Math.max(score, 3)
    if (isOverviewUrl(href)) score -= 2
    if (score <= 0) continue
    links.push({ href, text, score, typeHint: detectTypeHint(text), statusHint: detectStatusHint(text) })
  }

  return [...new Map(
    links
      .sort((a, b) => b.score - a.score)
      .map((link) => [link.href, link]),
  ).values()]
}

const expandOverviewLinks = async (links = []) => {
  const expanded = []

  for (const link of links) {
    if (!isOverviewUrl(link.href)) {
      expanded.push(link)
      continue
    }

    try {
      const res = await fetch(link.href, {
        headers: { 'user-agent': 'tierpolitik-crawler/municipal-adapter' },
        redirect: 'follow',
        signal: AbortSignal.timeout(12000),
      })
      if (!res.ok) continue
      const html = await res.text()
      const nested = parseLinks(html, res.url)
        .filter((nestedLink) => !isOverviewUrl(nestedLink.href))
        .map((nestedLink) => ({ ...nestedLink, score: nestedLink.score + 1 }))
      expanded.push(...nested)
    } catch {
      // ignore nested page failures
    }
  }

  return [...new Map(expanded.map((l) => [l.href, l])).values()]
    .sort((a, b) => b.score - a.score)
}

const loadMunicipalSources = () => {
  try {
    const parsed = JSON.parse(fs.readFileSync(municipalSourcesPath, 'utf8'))
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const hashId = (input = '') => crypto.createHash('sha1').update(input).digest('hex').slice(0, 12)

const fetchBernApiRows = async ({ municipalityName, canton, parliament, language, sourceId, apiEndpoint, maxItemsPerCity, fetchedAt }) => {
  const body = new URLSearchParams({
    'params[draw]': '1',
    'params[start]': '0',
    'params[length]': String(Math.max(30, maxItemsPerCity * 4)),
    volltext: '',
    title: '',
    number: '',
    commission: '',
    typ: '',
    submission: '',
    partei: '',
    direction: '',
    referendum: '',
    stand: '',
    year: '',
    date_start: '',
    date_end: '',
    due: '0',
  })

  const response = await fetch(apiEndpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'x-requested-with': 'XMLHttpRequest',
      'user-agent': 'tierpolitik-crawler/municipal-adapter',
    },
    body,
    signal: AbortSignal.timeout(25000),
  })

  if (!response.ok) return []
  const payload = await response.json().catch(() => null)
  const data = Array.isArray(payload?.data) ? payload.data : []

  return data
    .slice(0, Math.max(20, maxItemsPerCity * 2))
    .map((entry) => {
      const guid = String(entry?.['@attributes']?.OBJ_GUID || '').trim()
      if (!guid) return null
      const titleRaw = String(entry?.Titel || '').trim()
      if (!titleRaw) return null
      const nummer = String(entry?.Geschaeftnummer || '').trim()
      const typ = String(entry?.Geschaeftsart || classifyMunicipalEntry(titleRaw)).trim() || 'Parlamentsgeschäft'
      const statusRaw = String(entry?.Status || '').trim()
      const sourceLink = `https://stadtrat.bern.ch/de/geschaefte/detail.php?gid=${guid}`
      const start = String(entry?.Beginn?.Start || '').trim()
      const parsedStart = start ? new Date(start) : null
      const publishedAt = (parsedStart && !Number.isNaN(parsedStart.getTime())) ? parsedStart.toISOString() : fetchedAt
      const rawSigners = entry?.Beteiligungen?.Beteiligung
      const signerList = Array.isArray(rawSigners) ? rawSigners : (rawSigners ? [rawSigners] : [])
      const signerNames = signerList
        .map((s) => String(s?.VornameName || '').replace(/\s+/g, ' ').trim())
        .filter(Boolean)
      const signerPreview = signerNames.slice(0, 6).join(', ')

      return {
        sourceId,
        sourceUrl: apiEndpoint,
        externalId: `municipal-bern-api-${guid}`,
        title: `${municipalityName} · ${typ}: ${titleRaw}`.slice(0, 260),
        summary: `Gemeinde ${municipalityName} (${parliament}) · ${nummer || typ}${statusRaw ? ` · ${statusRaw}` : ''}`.slice(0, 300),
        body: `Titel: ${titleRaw}\nGeschäftsnummer: ${nummer || 'n/a'}\nTyp: ${typ}\nStand: ${statusRaw || 'n/a'}\nEingereicht von: ${signerPreview || 'n/a'}\nQuelle: ${sourceLink}`,
        publishedAt,
        fetchedAt,
        language,
        score: 0.64,
        matchedKeywords: ['gemeinde', municipalityName.toLowerCase(), String(typ || '').toLowerCase(), ...signerNames.map((n) => n.toLowerCase())].filter(Boolean),
        status: 'new',
        reviewReason: 'municipal-api-candidate',
        meta: {
          level: 'Gemeinde',
          municipality: municipalityName,
          canton,
          parliament,
          sourceLink,
          rawType: typ,
          rawStatus: statusRaw || null,
          businessNumber: nummer || null,
          adapterHint: 'municipalParliament',
        },
      }
    })
    .filter(Boolean)
}

export function createMunicipalParliamentAdapter() {
  return {
    async fetch(source) {
      const fetchedAt = new Date().toISOString()
      const selectedCities = new Set(parseList(source.options?.cities))
      const maxItemsPerCity = Number(source.options?.maxItemsPerCity || 18)
      const municipalities = loadMunicipalSources()
        .filter((entry) => !selectedCities.size || selectedCities.has(String(entry?.cityId || '').toLowerCase()))

      const rows = []

      for (const municipality of municipalities) {
        const cityId = String(municipality.cityId || '').toLowerCase()
        const municipalityName = String(municipality.municipality || cityId || 'Unbekannte Gemeinde')
        const canton = String(municipality.canton || '').toUpperCase() || null
        const parliament = String(municipality.parliament || municipalityName)
        const language = ['de', 'fr', 'it', 'en'].includes(String(municipality.language || '').toLowerCase())
          ? String(municipality.language || 'de').toLowerCase()
          : 'de'

        const urls = [
          municipality.url,
          ...(Array.isArray(municipality.altUrls) ? municipality.altUrls : []),
          ...(Array.isArray(municipality.seedUrls) ? municipality.seedUrls : []),
        ]
          .map((x) => String(x || '').trim())
          .filter(Boolean)

        let resolved = false

        if (municipality.apiEndpoint) {
          try {
            const apiRows = await fetchBernApiRows({
              municipalityName,
              canton,
              parliament,
              language,
              sourceId: source.id,
              apiEndpoint: String(municipality.apiEndpoint),
              maxItemsPerCity,
              fetchedAt,
            })
            if (apiRows.length) {
              rows.push(...apiRows)
              resolved = true
            }
          } catch {
            // fallback to HTML scraping URLs below
          }
        }

        if (resolved) continue

        for (const baseUrl of urls) {
          try {
            const response = await fetch(baseUrl, {
              headers: { 'user-agent': 'tierpolitik-crawler/municipal-adapter' },
              redirect: 'follow',
              signal: AbortSignal.timeout(15000),
            })
            if (!response.ok) continue

            const html = await response.text()
            const parsedLinks = parseLinks(html, response.url)
            const links = (await expandOverviewLinks(parsedLinks)).slice(0, maxItemsPerCity)

            if (!links.length) continue

            for (const [index, link] of links.entries()) {
              const rawTitle = link.text || `${parliament} Geschäft ${index + 1}`
              const inferredTitle = await enrichMunicipalTitle(link.href, rawTitle)
              if (!inferredTitle || inferredTitle.toLowerCase() === 'parlamentsgeschäft' || isOverviewTitle(inferredTitle)) continue

              const externalId = `municipal-${cityId}-${hashId(link.href)}`
              const entryType = classifyMunicipalEntry(inferredTitle)

              rows.push({
                sourceId: source.id,
                sourceUrl: response.url,
                externalId,
                title: `${municipalityName} · ${entryType}: ${inferredTitle}`.slice(0, 260),
                summary: `Gemeinde ${municipalityName} (${parliament}) · ${entryType} · ${inferredTitle}`.slice(0, 300),
                body: `Titel: ${inferredTitle}\nTyp: ${entryType}\nQuelle: ${link.href}\nScreening-Hinweis: potenzieller Tierschutz-Vorstoss auf Gemeindeebene.`,
                publishedAt: fetchedAt,
                fetchedAt,
                language,
                score: Math.min(0.22 + link.score * 0.08, 0.9),
                matchedKeywords: ['gemeinde', municipalityName.toLowerCase(), ...(link.typeHint ? [link.typeHint.toLowerCase()] : [])],
                status: 'new',
                reviewReason: 'municipal-source-candidate',
                meta: {
                  level: 'Gemeinde',
                  municipality: municipalityName,
                  canton,
                  parliament,
                  sourceLink: link.href,
                  rawType: link.typeHint,
                  rawStatus: link.statusHint,
                  adapterHint: 'municipalParliament',
                },
              })
            }

            resolved = true
            break
          } catch {
            // try next url
          }
        }

        if (!resolved) {
          rows.push({
            sourceId: source.id,
            sourceUrl: source.url,
            externalId: `municipal-scaffold-${cityId}`,
            title: `${parliament}: Quelle vorbereitet`,
            summary: `Scaffold für ${municipalityName} (${canton || 'n/a'}) – Parser benötigt manuelle Nachführung.`,
            body: `Kommunale Quelle konnte aktuell nicht automatisiert gelesen werden. URL(s): ${urls.join(', ')}`,
            publishedAt: fetchedAt,
            fetchedAt,
            language,
            score: 0,
            matchedKeywords: ['gemeinde', municipalityName.toLowerCase(), 'scaffold'],
            status: 'new',
            reviewReason: 'municipal-scaffold',
            meta: {
              level: 'Gemeinde',
              municipality: municipalityName,
              canton,
              parliament,
              scaffold: true,
              adapterHint: 'municipalParliament',
            },
          })
        }
      }

      return rows
    },
  }
}
