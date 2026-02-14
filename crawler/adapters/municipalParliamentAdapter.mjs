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

const parseLinks = (html = '', baseUrl = '') => {
  const links = []
  const re = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  let m
  while ((m = re.exec(html))) {
    const href = normalizeUrl(m[1], baseUrl)
    if (!href || !href.startsWith('http')) continue
    const text = normalizeText(m[2]).slice(0, 220)
    const score = scoreLink(href, text)
    if (score <= 0) continue
    links.push({ href, text, score, typeHint: detectTypeHint(text), statusHint: detectStatusHint(text) })
  }

  return [...new Map(
    links
      .sort((a, b) => b.score - a.score)
      .map((link) => [link.href, link]),
  ).values()]
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

        const urls = [municipality.url, ...(Array.isArray(municipality.altUrls) ? municipality.altUrls : [])]
          .map((x) => String(x || '').trim())
          .filter(Boolean)

        let resolved = false

        for (const baseUrl of urls) {
          try {
            const response = await fetch(baseUrl, {
              headers: { 'user-agent': 'tierpolitik-crawler/municipal-adapter' },
              redirect: 'follow',
              signal: AbortSignal.timeout(15000),
            })
            if (!response.ok) continue

            const html = await response.text()
            const links = parseLinks(html, response.url).slice(0, maxItemsPerCity)

            if (!links.length) continue

            for (const [index, link] of links.entries()) {
              const inferredTitle = link.text || `${parliament} Geschäft ${index + 1}`
              const externalId = `municipal-${cityId}-${hashId(link.href)}`
              const entryType = classifyMunicipalEntry(inferredTitle)

              rows.push({
                sourceId: source.id,
                sourceUrl: response.url,
                externalId,
                title: `${municipalityName} · ${entryType}: ${inferredTitle}`.slice(0, 260),
                summary: `Gemeinde ${municipalityName} (${parliament}) · ${entryType} · potenziell tierschutzrelevant`.slice(0, 300),
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
