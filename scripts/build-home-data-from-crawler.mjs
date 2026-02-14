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

const inferType = (title = '', sourceId = '', businessTypeName = '') => {
  const text = `${title} ${sourceId} ${businessTypeName}`.toLowerCase()
  if (text.includes('postulat') || text.includes('postulato') || text.includes('postulat')) return 'Postulat'
  if (text.includes('motion') || text.includes('mozione')) return 'Motion'
  if (text.includes('interpellation') || text.includes('interpellanza')) return 'Interpellation'
  if (text.includes('anfrage') || text.includes('frage') || text.includes('question') || text.includes('interrogazione')) return 'Anfrage'
  if (text.includes('initiative') || text.includes('iniziativa')) return 'Volksinitiative'
  return 'Interpellation'
}

const typeLabels = {
  Volksinitiative: { de: 'Volksinitiative', fr: 'Initiative populaire', it: 'Iniziativa popolare', en: 'Popular initiative' },
  Interpellation: { de: 'Interpellation', fr: 'Interpellation', it: 'Interpellanza', en: 'Interpellation' },
  Motion: { de: 'Motion', fr: 'Motion', it: 'Mozione', en: 'Motion' },
  Postulat: { de: 'Postulat', fr: 'Postulat', it: 'Postulato', en: 'Postulate' },
  Anfrage: { de: 'Anfrage', fr: 'Question', it: 'Interrogazione', en: 'Question' },
}

const themeLabels = {
  tier: { de: 'Tier', fr: 'Animal', it: 'Animale', en: 'Animal' },
  tierschutz: { de: 'Tierschutz', fr: 'Protection animale', it: 'Protezione animale', en: 'Animal protection' },
  tierwohl: { de: 'Tierwohl', fr: 'Bien-être animal', it: 'Benessere animale', en: 'Animal welfare' },
  nutztiere: { de: 'Nutztiere', fr: 'Animaux d\'élevage', it: 'Animali da reddito', en: 'Farm animals' },
  landwirtschaft: { de: 'Landwirtschaft', fr: 'Agriculture', it: 'Agricoltura', en: 'Agriculture' },
  tierversuch: { de: 'Tierversuche', fr: 'Expérimentation animale', it: 'Sperimentazione animale', en: 'Animal testing' },
  tierversuche: { de: 'Tierversuche', fr: 'Expérimentation animale', it: 'Sperimentazione animale', en: 'Animal testing' },
  jagd: { de: 'Jagd', fr: 'Chasse', it: 'Caccia', en: 'Hunting' },
  wolf: { de: 'Wolf', fr: 'Loup', it: 'Lupo', en: 'Wolf' },
  pelz: { de: 'Pelz', fr: 'Fourrure', it: 'Pelliccia', en: 'Fur' },
  stopfleber: { de: 'Stopfleber', fr: 'Foie gras', it: 'Foie gras', en: 'Foie gras' },
  kontrollwesen: { de: 'Kontrollwesen', fr: 'Contrôles et application', it: 'Controlli e applicazione', en: 'Controls & enforcement' },
  subventionen: { de: 'Subventionen', fr: 'Subventions', it: 'Sussidi', en: 'Subsidies' },
}

const CONTROL_KEYWORDS = new Set([
  'kontrolle', 'kontrollen', 'vollzug', 'aufsicht', 'monitoring', 'sanktion', 'sanktionen',
  'durchsetzung', 'inspektion', 'inspektionen', 'audit', 'audits',
])

const SUBSIDY_KEYWORDS = new Set([
  'subvention', 'subventionen', 'subventionierung', 'foerderung', 'förderung', 'direktzahlung', 'direktzahlungen',
  'beitrag', 'beitraege', 'beiträge', 'finanzhilfe', 'sussidi', 'sussidio', 'subventions',
])

const mapThemesFromKeywords = (keywords = []) => {
  const raw = (keywords || []).map((x) => String(x || '').trim()).filter(Boolean)
  const out = []
  const seen = new Set()

  const push = (theme) => {
    const t = String(theme || '').trim()
    if (!t) return
    const key = t.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    out.push(t)
  }

  for (const kw of raw) push(kw)

  const hasControl = raw.some((kw) => CONTROL_KEYWORDS.has(kw.toLowerCase()))
  if (hasControl) push('Kontrollwesen')

  const hasSubsidy = raw.some((kw) => SUBSIDY_KEYWORDS.has(kw.toLowerCase()))
  if (hasSubsidy) push('Subventionen')

  return out
}

const localizeTheme = (keyword = '', lang = 'de') => {
  const k = String(keyword || '').toLowerCase().trim()
  return themeLabels[k]?.[lang] || keyword
}

const extractStance = (reason = '', title = '', summary = '', body = '') => {
  const text = `${title} ${summary} ${body}`.toLowerCase()
  if (text.includes('stopfleber') || text.includes('foie gras')) return 'pro-tierschutz'
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

const langRank = (lang = 'de') => {
  if (lang === 'de') return 0
  if (lang === 'fr') return 1
  if (lang === 'it') return 2
  return 3
}

const fallbackPeopleByLang = {
  de: { name: 'Parlamentsgeschäft (Bund)', rolle: 'Nationalrat', partei: 'Überparteilich' },
  fr: { name: 'Objet parlementaire (Confédération)', rolle: 'Nationalrat', partei: 'Überparteilich' },
  it: { name: 'Atto parlamentare (Confederazione)', rolle: 'Nationalrat', partei: 'Überparteilich' },
}

const inferSubmitter = (lang, title = '', summary = '', body = '') => {
  const text = `${title} ${summary} ${body}`.toLowerCase()
  if (text.includes('blv') || text.includes('lebensmittelsicherheit') || text.includes('veterinärwesen')) {
    return { name: 'BLV', rolle: 'Regierung', partei: 'Bundesverwaltung' }
  }
  if (text.includes('bundesrat') || text.includes('message du conseil fédéral') || text.includes('messaggio del consiglio federale')) {
    return { name: 'Bundesrat', rolle: 'Regierung', partei: 'Bundesrat' }
  }
  if (text.includes('kommission')) {
    return { name: 'Parlamentarische Kommission', rolle: 'Nationalrat', partei: 'Überparteilich' }
  }
  return fallbackPeopleByLang[lang] || fallbackPeopleByLang.de
}

const clean = (text = '') => String(text)
  .replace(/\s+/g, ' ')
  .replace(/^\s+|\s+$/g, '')

const firstSentence = (text = '') => {
  const c = clean(text)
  if (!c) return ''
  const low = c.toLowerCase()
  if (
    low.includes('stellungnahme zum vorstoss liegt vor')
    || low.includes('beratung in kommission')
    || low.includes('erledigt')
  ) return ''
  const m = c.match(/(.{40,220}?[.!?])\s/)
  if (m) return m[1]
  return c.slice(0, 220)
}

const THEME_EXCLUDE = new Set(['botschaft'])

const sanitizeThemes = (arr = []) => arr
  .map((x) => String(x || '').trim())
  .filter((x) => x && !THEME_EXCLUDE.has(x.toLowerCase()))

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

  const unique = []
  const seen = new Set()
  for (const line of sentences) {
    const key = clean(line).toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    unique.push(line)
  }

  return unique
    .slice(0, 3)
    .join(' ')
}

const baseItems = (db.items || [])
  .filter((item) => String(item.sourceId || '').startsWith('ch-parliament-'))
  .filter((item) => ['queued', 'approved', 'published'].includes(item.status))

const groupedByAffair = new Map()
for (const item of baseItems) {
  const affairId = String(item.externalId || '').split('-')[0]
  const lang = langFromSource(item.sourceId)
  const prev = groupedByAffair.get(affairId)
  if (!prev) {
    groupedByAffair.set(affairId, item)
    continue
  }
  const prevLang = langFromSource(prev.sourceId)
  const betterLang = langRank(lang) < langRank(prevLang)
  const newer = new Date(item.fetchedAt || item.publishedAt || 0).getTime() > new Date(prev.fetchedAt || prev.publishedAt || 0).getTime()
  if (betterLang || (!betterLang && newer)) groupedByAffair.set(affairId, item)
}

const items = [...groupedByAffair.values()].slice(0, 1200)

const deByAffair = new Map(
  (db.items || [])
    .filter((x) => String(x.sourceId || '').endsWith('-de'))
    .map((x) => [String(x.externalId || '').split('-')[0], x]),
)

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

const buildI18nFromItem = (item, fallbackTitle, fallbackSummary, fallbackType, fallbackThemes) => {
  const variants = item?.languageVariants || {}
  const out = {
    title: { de: fallbackTitle },
    summary: { de: fallbackSummary },
    type: { de: typeLabels[fallbackType]?.de || fallbackType },
    themes: { de: fallbackThemes },
  }

  for (const [lang, variant] of Object.entries(variants)) {
    const l = ['de', 'fr', 'it', 'en'].includes(lang) ? lang : 'de'
    const title = clean(variant?.title || fallbackTitle)
    const summary = clean(variant?.summary || variant?.body || fallbackSummary)
    const typeDe = inferType(title, item.sourceId, variant?.businessTypeName || '')
    const matched = mapThemesFromKeywords(item.matchedKeywords || fallbackThemes || []).slice(0, 6)
    out.title[l] = title || fallbackTitle
    out.summary[l] = summary || fallbackSummary
    out.type[l] = typeLabels[typeDe]?.[l] || typeLabels[fallbackType]?.[l] || fallbackType
    out.themes[l] = matched.map((kw) => localizeTheme(kw, l))
  }

  return out
}

const vorstoesse = items.map((item, index) => {
  const sprache = langFromSource(item.sourceId)
  const affairId = String(item.externalId || '').split('-')[0]
  const deVariant = deByAffair.get(affairId)
  const displayTitle = deVariant?.title || item.title
  const displaySummary = deVariant?.summary || item.summary
  const displayBody = deVariant?.body || item.body
  const eingereicht = toIsoDate(item.publishedAt || item.fetchedAt)
  const updated = toIsoDate(item.fetchedAt || item.publishedAt)
  const status = mapStatus(item.status)
  const typ = inferType(displayTitle, item.sourceId, item?.languageVariants?.de?.businessTypeName || '')
  const stance = extractStance(item.reviewReason, displayTitle, displaySummary, displayBody)
  const initiativeLinks = buildInitiativeLinks({
    typ,
    title: displayTitle,
    externalId: item.externalId,
    status,
  })
  const idSafe = String(item.externalId || `${Date.now()}-${index}`).replace(/[^a-zA-Z0-9-]/g, '-')
  const link = item.sourceUrl && item.sourceUrl.startsWith('http')
    ? item.sourceUrl
    : `https://www.parlament.ch/de/ratsbetrieb/suche-curia-vista/geschaeft?AffairId=${String(item.externalId || '').split('-')[0]}`

  const rawSummaryText = summarizeVorstoss({
    title: displayTitle,
    summary: displaySummary,
    body: displayBody,
    status: item.status,
  })
  const summaryText = clean(rawSummaryText) || `Kurzüberblick: ${displayTitle || `Vorstoss ${index + 1}`} (${status}).`
  const baseThemes = sanitizeThemes(mapThemesFromKeywords(item.matchedKeywords?.length ? item.matchedKeywords : ['Tierschutz'])).slice(0, 6)
  const i18nMeta = buildI18nFromItem(item, displayTitle || `Vorstoss ${index + 1}`, summaryText, typ, baseThemes)

  return {
    id: `vp-${idSafe.toLowerCase()}`,
    titel: displayTitle || `Vorstoss ${index + 1}`,
    typ,
    kurzbeschreibung: summaryText,
    geschaeftsnummer: String(item.externalId || `AUTO-${index + 1}`),
    ebene: levelFromSource(item.sourceId),
    kanton: null,
    regionGemeinde: regionFromSource(item.sourceId),
    status,
    datumEingereicht: eingereicht,
    datumAktualisiert: updated,
    themen: baseThemes,
    schlagwoerter: (item.matchedKeywords?.length ? item.matchedKeywords : ['Tierpolitik']).slice(0, 8),
    einreichende: [inferSubmitter(sprache, displayTitle, displaySummary, displayBody)],
    linkGeschaeft: link,
    resultate: [
      {
        datum: eingereicht,
        status,
        bemerkung: 'Stand gemäss Parlamentsdaten',
      },
    ],
    medien: [],
    metadaten: {
      sprache,
      haltung: stance,
      initiativeLinks,
      i18n: i18nMeta,
      zuletztGeprueftVon: 'Crawler/DB Sync',
    },
  }
})

fs.writeFileSync(outPath, JSON.stringify(vorstoesse, null, 2))
console.log(`Home-Daten aus Crawler/DB gebaut: ${outPath.pathname} (${vorstoesse.length} Einträge)`)
