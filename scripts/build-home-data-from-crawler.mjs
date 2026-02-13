import fs from 'node:fs'

const crawlerDbPath = new URL('../data/crawler-db.json', import.meta.url)
const initiativeLinksPath = new URL('../data/initiative-links.json', import.meta.url)
const outPath = new URL('../data/vorstoesse.json', import.meta.url)

const db = JSON.parse(fs.readFileSync(crawlerDbPath, 'utf8'))
const initiativeLinkMap = fs.existsSync(initiativeLinksPath)
  ? JSON.parse(fs.readFileSync(initiativeLinksPath, 'utf8'))
  : {}

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

const extractStance = (reason = '') => {
  const m = String(reason).match(/stance=([^·]+)/)
  return (m?.[1] || 'neutral/unklar').trim()
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

const clean = (text = '') => String(text)
  .replace(/\s+/g, ' ')
  .replace(/^\s+|\s+$/g, '')

const firstSentence = (text = '') => {
  const c = clean(text)
  if (!c) return ''
  const m = c.match(/(.{40,220}?[.!?])\s/)
  if (m) return m[1]
  return c.slice(0, 220)
}

const summarizeVorstoss = ({ title = '', summary = '', body = '', status = '' }) => {
  const t = clean(title)
  const s = firstSentence(summary)
  const b = firstSentence(body)
  const low = `${t} ${summary} ${body}`.toLowerCase()
  const statusLabel = status === 'approved' ? 'in Beratung' : status === 'published' ? 'abgeschlossen' : 'eingereicht'

  const sentences = []

  if (low.includes('stopfleber') || low.includes('foie gras')) {
    sentences.push('Dieser Vorstoss betrifft die Stopfleber-Thematik (Foie gras) und die politische Umsetzung eines Importverbots bzw. eines indirekten Gegenentwurfs.')
    sentences.push('Im Zentrum steht, wie streng der Schutz von Tieren in der Produktions- und Importkette rechtlich ausgestaltet werden soll.')
  } else if (low.includes('tierversuch') || low.includes('3r') || low.includes('expérimentation animale')) {
    sentences.push('Dieser Vorstoss behandelt Alternativen zu Tierversuchen (3R) und die Frage, wie Forschung gezielt in tierfreie bzw. tierärmere Methoden gelenkt werden kann.')
    sentences.push('Diskutiert werden typischerweise Ressourcen, Anreize und konkrete Umsetzungsmechanismen im Forschungsbereich.')
  } else if (low.includes('wolf') || low.includes('wildtier') || low.includes('jagd') || low.includes('chasse')) {
    sentences.push('Dieser Vorstoss betrifft die Wildtierpolitik, insbesondere das Spannungsfeld zwischen Schutz, Regulierung und Jagd.')
    sentences.push('Für die Einordnung ist zentral, ob die vorgeschlagenen Massnahmen den Schutzstatus stärken oder Eingriffe ausweiten.')
  }

  if (s) sentences.push(s)
  if (b && b !== s) sentences.push(b)

  sentences.push(`Aktueller Stand: ${statusLabel}.`)

  return sentences
    .filter(Boolean)
    .slice(0, 4)
    .join(' ')
}

const items = (db.items || [])
  .filter((item) => String(item.sourceId || '').startsWith('ch-parliament-'))
  .filter((item) => ['approved', 'published'].includes(item.status))
  .slice(0, 1200)

const buildInitiativeLinks = ({ typ, title, externalId, status }) => {
  if (typ !== 'Volksinitiative') return undefined

  const affairId = String(externalId || '').split('-')[0]
  const mapped = initiativeLinkMap[affairId] || {}
  const campaignUrl = mapped.campaignUrl
    || `https://duckduckgo.com/?q=${encodeURIComponent(`${title} Volksinitiative Kampagne`)}`

  const isPast = ['Angenommen', 'Abgelehnt', 'Abgeschrieben'].includes(status)
  const resultUrl = mapped.resultUrl
    || (isPast
      ? `https://www.admin.ch/gov/de/start/suche.html?query=${encodeURIComponent(`${title} Volksinitiative Abstimmungsresultat`)}`
      : undefined)

  return { campaignUrl, resultUrl }
}

const vorstoesse = items.map((item, index) => {
  const sprache = langFromSource(item.sourceId)
  const eingereicht = toIsoDate(item.publishedAt || item.fetchedAt)
  const updated = toIsoDate(item.fetchedAt || item.publishedAt)
  const status = mapStatus(item.status)
  const typ = inferType(item.title, item.sourceId)
  const stance = extractStance(item.reviewReason)
  const initiativeLinks = buildInitiativeLinks({
    typ,
    title: item.title,
    externalId: item.externalId,
    status,
  })
  const idSafe = String(item.externalId || `${Date.now()}-${index}`).replace(/[^a-zA-Z0-9-]/g, '-')
  const link = item.sourceUrl && item.sourceUrl.startsWith('http')
    ? item.sourceUrl
    : `https://www.parlament.ch/de/ratsbetrieb/suche-curia-vista/geschaeft?AffairId=${String(item.externalId || '').split('-')[0]}`

  return {
    id: `vp-${idSafe.toLowerCase()}`,
    titel: item.title || `Vorstoss ${index + 1}`,
    typ,
    kurzbeschreibung: summarizeVorstoss({
      title: item.title,
      summary: item.summary,
      body: item.body,
      status: item.status,
    }),
    geschaeftsnummer: String(item.externalId || `AUTO-${index + 1}`),
    ebene: levelFromSource(item.sourceId),
    kanton: null,
    regionGemeinde: regionFromSource(item.sourceId),
    status,
    datumEingereicht: eingereicht,
    datumAktualisiert: updated,
    themen: [
      ...(item.matchedKeywords?.length ? item.matchedKeywords : ['Tierschutz']),
      stance === 'pro-tierschutz' ? 'Pro Tierschutz' : stance === 'tierschutzkritisch' ? 'Tierschutzkritisch' : 'Neutral/Unklar',
    ].slice(0, 6),
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
      haltung: stance,
      initiativeLinks,
      zuletztGeprueftVon: 'Crawler/DB Sync',
    },
  }
})

fs.writeFileSync(outPath, JSON.stringify(vorstoesse, null, 2))
console.log(`Home-Daten aus Crawler/DB gebaut: ${outPath.pathname} (${vorstoesse.length} Einträge)`)
