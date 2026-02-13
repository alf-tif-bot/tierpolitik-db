import fs from 'node:fs'

const crawlerDbPath = new URL('../data/crawler-db.json', import.meta.url)
const outPath = new URL('../data/vorstoesse.json', import.meta.url)

const db = JSON.parse(fs.readFileSync(crawlerDbPath, 'utf8'))

const toIsoDate = (v) => {
  if (!v) return new Date().toISOString().slice(0, 10)
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 10)
  return d.toISOString().slice(0, 10)
}

const inferType = (title = '', sourceId = '') => {
  const text = `${title} ${sourceId}`.toLowerCase()
  if (text.includes('postulat')) return 'Postulat'
  if (text.includes('motion')) return 'Motion'
  if (text.includes('interpellation')) return 'Interpellation'
  if (text.includes('anfrage') || text.includes('frage')) return 'Anfrage'
  if (text.includes('initiative')) return 'Volksinitiative'
  return 'Interpellation'
}

const mapStatus = (status = '') => {
  const s = String(status).toLowerCase()
  if (s === 'published') return 'Angenommen'
  if (s === 'approved') return 'In Beratung'
  if (s === 'rejected') return 'Abgelehnt'
  if (s === 'queued' || s === 'new') return 'Eingereicht'
  return 'Eingereicht'
}

const levelFromSource = (sourceId = '') => {
  if (sourceId.includes('parliament') || sourceId.includes('parlament')) return 'Bund'
  return 'Bund'
}

const regionFromSource = (sourceId = '') => {
  const low = sourceId.toLowerCase()
  if (low.endsWith('-fr')) return 'Romandie'
  if (low.endsWith('-it')) return 'Südschweiz'
  return null
}

const langFromSource = (sourceId = '') => {
  const low = sourceId.toLowerCase()
  if (low.endsWith('-fr')) return 'fr'
  if (low.endsWith('-it')) return 'it'
  return 'de'
}

const peopleByLang = {
  de: { name: 'Parlamentsdienst', rolle: 'Nationalrat', partei: 'Überparteilich' },
  fr: { name: 'Service parlementaire', rolle: 'Nationalrat', partei: 'Überparteilich' },
  it: { name: 'Servizio parlamentare', rolle: 'Nationalrat', partei: 'Überparteilich' },
}

const items = (db.items || [])
  .filter((item) => ['queued', 'approved', 'published'].includes(item.status))
  .slice(0, 1200)

const vorstoesse = items.map((item, index) => {
  const sprache = langFromSource(item.sourceId)
  const eingereicht = toIsoDate(item.publishedAt || item.fetchedAt)
  const updated = toIsoDate(item.fetchedAt || item.publishedAt)
  const status = mapStatus(item.status)
  const typ = inferType(item.title, item.sourceId)
  const idSafe = String(item.externalId || `${Date.now()}-${index}`).replace(/[^a-zA-Z0-9-]/g, '-')
  const link = item.sourceUrl && item.sourceUrl.startsWith('http')
    ? item.sourceUrl
    : `https://www.parlament.ch/de/ratsbetrieb/suche-curia-vista/geschaeft?AffairId=${String(item.externalId || '').split('-')[0]}`

  return {
    id: `vp-${idSafe.toLowerCase()}`,
    titel: item.title || `Vorstoss ${index + 1}`,
    typ,
    kurzbeschreibung: item.summary || item.reviewReason || 'Automatisch aus Crawler/DB übernommen.',
    geschaeftsnummer: String(item.externalId || `AUTO-${index + 1}`),
    ebene: levelFromSource(item.sourceId),
    kanton: null,
    regionGemeinde: regionFromSource(item.sourceId),
    status,
    datumEingereicht: eingereicht,
    datumAktualisiert: updated,
    themen: (item.matchedKeywords?.length ? item.matchedKeywords : ['Tierschutz']).slice(0, 5),
    schlagwoerter: (item.matchedKeywords?.length ? item.matchedKeywords : ['Tierpolitik']).slice(0, 8),
    einreichende: [peopleByLang[sprache]],
    linkGeschaeft: link,
    resultate: [
      {
        datum: eingereicht,
        status,
        bemerkung: `Status aus Crawler: ${item.status}`,
      },
    ],
    medien: [],
    metadaten: {
      sprache,
      zuletztGeprueftVon: 'Crawler/DB Sync',
    },
  }
})

fs.writeFileSync(outPath, JSON.stringify(vorstoesse, null, 2))
console.log(`Home-Daten aus Crawler/DB gebaut: ${outPath.pathname} (${vorstoesse.length} Einträge)`)
