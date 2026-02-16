import fs from 'node:fs'

const crawlerDbPath = new URL('../data/crawler-db.json', import.meta.url)
const initiativeLinksPath = new URL('../data/initiative-links.json', import.meta.url)
const decisionsPath = new URL('../data/review-decisions.json', import.meta.url)
const outPath = new URL('../data/vorstoesse.json', import.meta.url)

const db = JSON.parse(fs.readFileSync(crawlerDbPath, 'utf8'))
const initiativeLinkMap = fs.existsSync(initiativeLinksPath)
  ? JSON.parse(fs.readFileSync(initiativeLinksPath, 'utf8'))
  : {}
const reviewDecisions = fs.existsSync(decisionsPath)
  ? JSON.parse(fs.readFileSync(decisionsPath, 'utf8'))
  : {}

const toIsoDate = (v, fallbackYear) => {
  const d = v ? new Date(v) : null
  const base = d && !Number.isNaN(d.getTime()) ? d : null

  if (base) {
    let year = base.getUTCFullYear()
    if (fallbackYear && Number.isFinite(fallbackYear) && Math.abs(year - fallbackYear) >= 2) {
      year = fallbackYear
    }
    const month = String(base.getUTCMonth() + 1).padStart(2, '0')
    const day = String(base.getUTCDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  if (fallbackYear && Number.isFinite(fallbackYear)) return `${fallbackYear}-01-01`
  return new Date().toISOString().slice(0, 10)
}

const inferType = (title = '', sourceId = '', businessTypeName = '', rawType = '') => {
  const text = `${title} ${sourceId} ${businessTypeName} ${rawType}`.toLowerCase()
  if (text.includes('petition') || text.includes('pétition') || text.includes('petizione')) return 'Petition'
  if (text.includes('dringliche motion') || text.includes('motion') || text.includes('mozione')) return 'Motion'
  if (text.includes('dringliches postulat') || text.includes('postulat') || text.includes('postulato')) return 'Postulat'
  if (text.includes('fragestunde') || text.includes('question time') || text.includes('heure des questions') || text.includes('ora delle domande')) return 'Anfrage'
  if (text.includes('interpellation') || text.includes('interpellanza')) return 'Interpellation'
  if (text.includes('schriftliche anfrage') || text.includes('kleine anfrage') || text.includes('anfrage') || text.includes('frage') || text.includes('question') || text.includes('interrogazione')) return 'Anfrage'
  if (text.includes('parlamentarische initiative') || text.includes('initiative parlementaire') || text.includes('iniziativa parlamentare')) return 'Parlamentarische Initiative'
  if (text.includes('volksinitiative') || text.includes('initiative populaire') || text.includes('iniziativa popolare')) return 'Volksinitiative'
  if (text.includes('initiative') || text.includes('iniziativa')) return 'Volksinitiative'
  return 'Interpellation'
}

const typeLabels = {
  Volksinitiative: { de: 'Volksinitiative', fr: 'Initiative populaire', it: 'Iniziativa popolare', en: 'Popular initiative' },
  'Parlamentarische Initiative': { de: 'Parlamentarische Initiative', fr: 'Initiative parlementaire', it: 'Iniziativa parlamentare', en: 'Parliamentary initiative' },
  Interpellation: { de: 'Interpellation', fr: 'Interpellation', it: 'Interpellanza', en: 'Interpellation' },
  Motion: { de: 'Motion', fr: 'Motion', it: 'Mozione', en: 'Motion' },
  Postulat: { de: 'Postulat', fr: 'Postulat', it: 'Postulato', en: 'Postulate' },
  Anfrage: { de: 'Anfrage', fr: 'Question', it: 'Interrogazione', en: 'Question' },
  Petition: { de: 'Petition', fr: 'Pétition', it: 'Petizione', en: 'Petition' },
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

const parseStructuredThemes = (text = '') => {
  const raw = String(text || '')
  if (!raw.includes('|')) return []

  return raw
    .split('|')
    .map((x) => String(x || '').trim())
    .filter(Boolean)
    .filter((x) => x.length <= 50)
    .filter((x) => !/[.!?\n]/.test(x))
    .filter((x) => !/^\d{2}\.\d{3,4}\b/.test(x))
}

const extractStance = (reason = '', title = '', summary = '', body = '') => {
  const text = `${title} ${summary} ${body}`.toLowerCase()
  if (text.includes('stopfleber') || text.includes('foie gras')) return 'pro-tierschutz'
  const m = String(reason).match(/stance=([^·]+)/)
  return (m?.[1] || 'neutral/unklar').trim()
}

const mapStatus = (status = '', rawStatus = '', summary = '', body = '') => {
  const sourceStatus = String(rawStatus || '').toLowerCase()
  if (sourceStatus.includes('hängig') || sourceStatus.includes('haengig') || sourceStatus.includes('in bearbeitung') || sourceStatus.includes('überwiesen') || sourceStatus.includes('ueberwiesen')) return 'In Beratung'
  if (sourceStatus.includes('angenommen') || sourceStatus.includes('erheblich erklärt') || sourceStatus.includes('erheblich erklaert')) return 'Angenommen'
  if (sourceStatus.includes('abgelehnt') || sourceStatus.includes('nicht überwiesen') || sourceStatus.includes('nicht ueberwiesen')) return 'Abgelehnt'
  if (sourceStatus.includes('abgeschrieben')) return 'Abgeschrieben'
  if (sourceStatus.includes('zurückgezogen') || sourceStatus.includes('zurueckgezogen')) return 'Zurückgezogen'
  if (sourceStatus.includes('erledigt')) return 'Erledigt'
  if (sourceStatus.includes('eingereicht')) return 'In Beratung'

  const textStatus = `${summary} ${body}`.toLowerCase()
  if (textStatus.includes('abgeschrieben')) return 'Abgeschrieben'
  if (textStatus.includes('zurückgezogen') || textStatus.includes('zurueckgezogen')) return 'Zurückgezogen'
  if (textStatus.includes('abgelehnt')) return 'Abgelehnt'
  if (textStatus.includes('angenommen')) return 'Angenommen'
  if (textStatus.includes('erledigt')) return 'Erledigt'

  const s = String(status).toLowerCase()
  if (s === 'published') return 'Angenommen'
  if (s === 'approved') return 'In Beratung'
  if (s === 'rejected') return 'Abgelehnt'
  if (s === 'queued' || s === 'new') return 'In Beratung'
  return 'In Beratung'
}

const levelFromItem = (item) => {
  const sourceId = String(item?.sourceId || '').toLowerCase()
  const metaLevel = String(item?.meta?.level || '').toLowerCase()
  if (metaLevel === 'gemeinde' || sourceId.includes('municipal')) return 'Gemeinde'
  if (sourceId.includes('cantonal') || sourceId.includes('kanton')) return 'Kanton'
  return 'Bund'
}

const cantonFromItem = (item) => {
  const sourceId = String(item?.sourceId || '').toLowerCase()
  const metaCanton = String(item?.meta?.canton || '').toUpperCase()
  if (/^[A-Z]{2}$/.test(metaCanton)) return metaCanton
  if (sourceId.includes('bern')) return 'BE'
  if (sourceId.includes('zuerich') || sourceId.includes('zurich')) return 'ZH'
  return null
}

const regionFromItem = (item) => {
  const sourceId = String(item?.sourceId || '').toLowerCase()
  if (item?.meta?.municipality) return String(item.meta.municipality)
  if (sourceId.endsWith('-fr')) return 'Romandie'
  if (sourceId.endsWith('-it')) return 'Südschweiz'
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

const inferYearFromBusiness = (title = '', externalId = '') => {
  const titleMatch = String(title || '').match(/^\s*(\d{2})\.(\d{2,4})\b/)
  if (titleMatch?.[1]) {
    const yy = Number(titleMatch[1])
    return yy >= 70 ? 1900 + yy : 2000 + yy
  }

  const num = String(externalId || '').split('-')[0]
  const exMatch = num.match(/^(\d{4})\d{2,4}$/)
  if (exMatch?.[1]) return Number(exMatch[1])
  return undefined
}

const formatBusinessNumber = (title = '', externalId = '', summary = '', body = '', meta = null) => {
  const metaNo = String(meta?.businessNumber || '').trim()
  if (metaNo) return metaNo
  const bodyMatch = String(body || '').match(/Geschäftsnummer:\s*([A-Za-z0-9.\-]+)/i)
  if (bodyMatch?.[1]) return bodyMatch[1]
  const summaryMatch = String(summary || '').match(/·\s*([0-9]{4}\.[A-Z]{2}\.[0-9]{4}|\d{2}\.\d{3,4})\s*·/)
  if (summaryMatch?.[1]) return summaryMatch[1]
  const titleMatch = String(title || '').match(/\b(\d{2}\.\d{3,4})\b/)
  if (titleMatch?.[1]) return titleMatch[1]
  const num = String(externalId || '').split('-')[0]
  const m = num.match(/^(\d{4})(\d{4})$/)
  if (m) {
    const yy = String(Number(m[1]) % 100).padStart(2, '0')
    return `${yy}.${m[2]}`
  }
  return String(externalId || '')
}

const fallbackPeopleByLang = {
  de: { name: 'Gemäss Curia Vista', rolle: '', partei: '' },
  fr: { name: 'Selon Curia Vista', rolle: '', partei: '' },
  it: { name: 'Secondo Curia Vista', rolle: '', partei: '' },
}

const SUBMITTER_OVERRIDES = {
  '21.044': { name: 'Bundesrat', rolle: 'Regierung', partei: 'Bundesrat' },
  '23.7115': { name: 'Egger Mike', rolle: 'Nationalrat', partei: 'SVP' },
  '25.4010': { name: 'David Roth', rolle: 'Nationalrat', partei: 'SP' },
  '25.4380': { name: 'Mathilde Crevoisier Crelier', rolle: 'Ständerat', partei: 'SP' },
  '24.3277': { name: 'Lorenz Hess', rolle: 'Nationalrat', partei: 'Die Mitte' },
  '20.3849': { name: 'Haab Martin', rolle: 'Nationalrat', partei: 'SVP' },
  '25.404': { name: 'Kommission für Wissenschaft, Bildung und Kultur Nationalrat', rolle: 'Kommission', partei: '' },
  '20.4731': { name: 'Schneider Meret', rolle: 'Nationalrat', partei: 'Grüne Partei der Schweiz' },
  '20.3648': { name: 'Schneider Meret', rolle: 'Nationalrat', partei: 'Grüne Partei der Schweiz' },
  '21.3002': { name: 'Kommission für Umwelt, Raumplanung und Energie Ständerat', rolle: 'Kommission', partei: '' },
  '22.3299': { name: 'Schneider Meret', rolle: 'Nationalrat', partei: 'Grüne Partei der Schweiz' },
  '22.3808': { name: 'Schneider Meret', rolle: 'Nationalrätin', partei: 'Grüne Partei der Schweiz' },
  '23.3411': { name: 'Schneider Meret', rolle: 'Nationalrat', partei: 'Grüne Partei der Schweiz' },
  '23.7580': { name: 'Rüegger Monika', rolle: 'Nationalrat', partei: 'SVP' },
  '22.7004': { name: 'Egger Mike', rolle: 'Nationalrat', partei: 'SVP' },
  '21.8161': { name: 'de Courten Thomas', rolle: 'Nationalrat', partei: 'SVP' },
  '21.8162': { name: 'de Courten Thomas', rolle: 'Nationalrat', partei: 'SVP' },
  '21.8163': { name: 'de Courten Thomas', rolle: 'Nationalrat', partei: 'SVP' },
  '21.4435': { name: 'Grüter Franz', rolle: 'Nationalrat', partei: 'Schweizerische Volkspartei' },
  '25.2027': { name: 'Écologie et Altruisme', rolle: 'Petitionskomitee', partei: '' },
  '23.2009': { name: 'Fondation SOS Chats Noiraigue', rolle: 'Petitionskomitee', partei: '' },
  '25.4071': { name: 'Dittli Josef', rolle: 'Ständerat', partei: 'FDP.Die Liberalen' },
  '25.4144': { name: 'Graf Maya', rolle: 'Ständerätin', partei: 'GRÜNE Schweiz' },
  '21.3703': { name: 'Badertscher Christine', rolle: 'Nationalrätin', partei: 'Grüne Fraktion' },
  '20.4002': { name: 'Badertscher Christine', rolle: 'Nationalrätin', partei: 'Grüne Fraktion' },
  '23.7858': { name: 'Clivaz Christophe', rolle: 'Nationalrat', partei: 'GRÜNE Schweiz' },
  '24.4695': { name: 'Schneider Meret', rolle: 'Nationalrätin', partei: 'GRÜNE Schweiz' },
  '25.4812': { name: 'Schneider Meret', rolle: 'Nationalrat', partei: 'GRÜNE Schweiz' },
  '24.3296': { name: 'Munz Martina', rolle: 'Nationalrätin', partei: 'SP' },
  '22.3187': { name: 'Munz Martina', rolle: 'Nationalrätin', partei: 'Sozialdemokratische Fraktion' },
  '21.3363': { name: 'Munz Martina', rolle: 'Nationalrätin', partei: 'Sozialdemokratische Partei der Schweiz' },
  '21.3835': { name: 'Schneider Meret', rolle: 'Nationalrat', partei: 'Grüne Partei der Schweiz' },
  '22.7807': { name: 'Friedli Esther', rolle: 'Nationalrätin', partei: 'Schweizerische Volkspartei' },
  '20.2018': { name: 'Tier im Fokus', rolle: 'Petitionskomitee', partei: '' },
  '22.3952': { name: 'Giacometti Anna', rolle: 'Nationalrätin', partei: 'FDP.Die Liberalen' },
  '22.3633': { name: 'Stark Jakob', rolle: 'Ständerat', partei: 'Schweizerische Volkspartei' },
}

const TYPE_OVERRIDES = {
  '25.404': 'Parlamentarische Initiative',
  '23.7115': 'Anfrage',
  '23.3411': 'Postulat',
  '23.7580': 'Anfrage',
  '22.7004': 'Anfrage',
  '21.8161': 'Anfrage',
  '21.8162': 'Anfrage',
  '21.8163': 'Anfrage',
  '23.7858': 'Anfrage',
  '22.7807': 'Anfrage',
  '25.2027': 'Petition',
  '23.2009': 'Petition',
  '20.2018': 'Petition',
  '20.4002': 'Motion',
  '22.3952': 'Motion',
  '22.3633': 'Motion',
}

const THEME_OVERRIDES = {
  '21.044': ['Landwirtschaft', 'Umwelt'],
  '23.7115': ['Energie', 'Landwirtschaft', 'Umwelt'],
  '20.4731': ['Nutztiere', 'Landwirtschaft', 'Umwelt'],
  '21.3002': ['Umwelt', 'Landwirtschaft'],
  '23.7580': ['Landwirtschaft', 'Umwelt'],
  '22.7004': ['Landwirtschaft', 'Umwelt'],
  '20.3849': ['Nutztiere', 'Landwirtschaft', 'Umwelt'],
  '25.4010': ['Landwirtschaft', 'Konsumentenschutz', 'Wirtschaft'],
  '25.4144': ['Landwirtschaft', 'Nutztiere', 'Biodiversität'],
  '21.8163': ['Landwirtschaft', 'Staatspolitik', 'Umwelt', 'Beschäftigung und Arbeit'],
  '22.3299': ['Schweinezucht', 'Tierarzneimittel', 'Tierschutz'],
  '22.3808': ['Staatspolitik', 'Medien und Kommunikation', 'Wissenschaft und Forschung', 'Umwelt'],
  '23.3411': ['Landwirtschaft', 'Umwelt', 'Wirtschaft'],
  '21.8161': ['Landwirtschaft', 'Umwelt'],
  '21.8162': ['Landwirtschaft', 'Umwelt'],
  '21.4435': ['Gesundheit', 'Landwirtschaft', 'Umwelt', 'Wirtschaft'],
  '23.7858': ['Landwirtschaft', 'Umwelt'],
  '22.7807': ['Finanzwesen', 'Landwirtschaft', 'Umwelt'],
  '25.4812': ['Landwirtschaft', 'Staatspolitik', 'Umwelt'],
  '21.3363': ['Umwelt', 'Wissenschaft und Forschung'],
  '22.3187': ['Landwirtschaft', 'Umwelt', 'Nutztiere'],
  '20.2018': ['Tierschutz', 'Tierrechte', 'Nutztiere'],
  '20.4002': ['Tierschutz', 'Nutztiere', 'Verkehr'],
  '22.3952': ['Tierschutz', 'Nutztiere'],
  '22.3633': ['Landwirtschaft', 'Gesundheit', 'Umwelt', 'Nutztiere'],
}

const STATUS_OVERRIDES = {
  '21.044': 'Erledigt',
  '23.7115': 'Erledigt',
  '22.7807': 'Erledigt',
  '23.3411': 'Erledigt',
  '25.4144': 'Erledigt',
  '22.3187': 'Erledigt',
  '20.2018': 'Eingereicht',
  '20.4002': 'Abgeschrieben',
  '22.3952': 'Erledigt',
}

const SUBMISSION_DATE_OVERRIDES = {
  '23.7115': '2023-03-01',
  '23.3411': '2023-03-17',
  '25.4144': '2025-09-25',
  '22.3187': '2022-03-16',
  '20.2018': '2020-08-28',
  '20.4002': '2020-09-16',
  '22.3952': '2022-09-21',
}

const TITLE_OVERRIDES = {
  '23.7115': '23.7115 - Bedeutung von Netto-Null für schweizerische Nutztiere',
  '22.7807': '22.7807 - Wer bezahlt die Schäden von Nutztieren, wenn die Gänsegeier vor der Wildhut den Kadaver zerfressen?',
  '23.3411': '23.3411 - Eine langfristige Lösung für den Schweinemarkt',
  '25.4144': '25.4144 - Ist die Erhaltung seltener Nutztierrassen durch die geplante Totalrevision der Tierzuchtverordnung (TZV) gefährdet?',
  '22.3187': '22.3187 - Hochgezüchtete Eier- und Geflügelfleischproduktion in Richtung Tierwohl weiterentwickeln',
  '20.2018': '20.2018 - Grundrechte für Schweine',
  '20.4002': '20.4002 - Zulassung von Fahrzeugen für Nutztiertransporte gemäss Tierschutzgesetzgebung',
  '22.3952': '22.3952 - Den Besonderheiten von Eseln, Maultieren und Mauleseln in der Tierschutzverordnung Rechnung tragen',
  '22.3633': '22.3633 - Afrikanische Schweinepest. Schlachtbetriebe und die Versorgungssicherheit gefährden?',
}

const SUMMARY_OVERRIDES = {
  '23.7115': 'Die Fragestunde-Frage thematisiert den Zusammenhang von Netto-Null-Zielen, landwirtschaftlichen Treibhausgasen und Nutztierhaltung. Der Bundesrat wird gefragt, ob Tierbestände reguliert werden sollen, welche Nutztiere zur Fleischproduktion kein CO2 verursachen und wie er entsprechende Forderungen von Umweltverbänden einordnet.',
  '21.3002': 'Die Motion verlangt, den Handlungsspielraum im Jagdgesetz per Verordnung auszuschöpfen, um die Koexistenz zwischen Menschen, Grossraubtieren und Nutztieren zu regeln (u. a. Regulierung und Herdenschutz).',
  '25.4809': 'Der Vorstoss verlangt konkrete Massnahmen gegen Tierqual bei der Geflügelschlachtung und eine konsequent tierschutzkonforme Praxis.',
  '20.3849': 'Die Interpellation thematisiert neue EU-Tiergesundheitsvorschriften, die den Export bestimmter Nutztiere aus der Schweiz erschweren. Der Bundesrat wird zu Kenntnisstand, Unterstützung betroffener Betriebe und möglichen Verhandlungsspielräumen mit der EU befragt.',
  '20.3648': 'Die Motion verlangt eine Änderung der Tierschutzverordnung, damit für alle Schweinekategorien stets eingestreute Liegebereiche vorgeschrieben sind.',
  '23.7580': 'Die Fragestunde-Frage verlangt vom Bundesrat die Priorisierung des Schutzes von Menschen und Nutztieren vor Wolfsangriffen, inklusive möglicher Verteidigungsabschüsse bei direkten Angriffen.',
  '22.7004': 'Die Fragestunde-Frage kritisiert eine aus Sicht des Einreichers realitätsferne Auslegung der Tierschutzverordnung für Hofhunde und verlangt eine Klärung durch den Bundesrat.',
  '21.8161': 'Die Fragestunde-Frage thematisiert mögliche Waldsperrungen bei einem Ausbruch der Afrikanischen Schweinepest und fragt nach Kriterien für Ausnahmen bei unerlässlichen Forstarbeiten (inkl. Aufforstung und Schutzwaldpflege).',
  '21.8162': 'Die Fragestunde-Frage thematisiert mögliche Waldsperrungen bei einem Ausbruch der Afrikanischen Schweinepest und fragt, wie die Schweizer Holznachfrage bei grossflächigen und länger dauernden Sperrungen gedeckt werden soll.',
  '21.8163': 'Die Fragestunde-Frage thematisiert mögliche Waldsperrungen bei einem Ausbruch der Afrikanischen Schweinepest und deren Folgen für Forstbetriebe, Personal und Lernende; zudem werden Kompensationsmassnahmen des Bundes nachgefragt.',
  '21.4435': 'Die Motion verlangt, Wildtierpassagen an Nationalstrassen präventiv so auszurüsten, dass Wildschweine sie nicht passieren können, um die Ausbreitung der Afrikanischen Schweinepest einzudämmen.',
  '25.4010': 'Die Motion verlangt ein gesetzlich verankertes Importverbot für chemisch (insbesondere mit Chlor) behandeltes Geflügelfleisch und begründet dies mit Konsumentenschutz, Lebensmittelstandards und handelspolitischer Verlässlichkeit.',
  '22.3299': 'Die Motion verlangt ein Verbot PMSG-haltiger Tierarzneimittel in der Schweizer Schweinezucht und will verhindern, dass diese durch synthetische PMSG-Produkte ersetzt werden.',
  '22.3808': 'Die Interpellation verlangt einen transparenteren Zugang zur Tierversuchsstatistik und fragt unter anderem nach einer besseren Verknüpfung der Datenquellen auf tv-statistik.ch sowie nach zusätzlichen Publikationen.',
  '23.3411': 'Das Postulat beauftragt den Bundesrat zu prüfen, wie gemeinsam mit der Branche eine langfristige Lösung für die Krise auf dem Schweinemarkt gefunden werden kann, inklusive Unterstützung für Betriebe bei Umstellung oder Bestandsreduktion.',
  '25.2027': 'Die Petition verlangt ein Beschwerderecht für Tierschutzverbände bei Fällen von Tiermisshandlung, damit Missstände rechtlich wirksamer verfolgt werden können.',
  '25.4071': 'Die Interpellation fragt, weshalb Equiden in der Schweiz als Heim- oder Nutztiere deklariert werden, und thematisiert die Folgen für Kreislaufwirtschaft und Food Waste bei der Verwertung verstorbener Tiere.',
  '25.4144': 'Die Interpellation fragt den Bundesrat, ob die geplante Totalrevision der Tierzuchtverordnung die Erhaltung seltener Nutztierrassen gefährdet und wie der gesetzliche Auftrag zur Sicherung tiergenetischer Ressourcen konkret umgesetzt wird.',
  '21.3703': 'Die Interpellation verlangt Auskunft, wie die Schweiz im Indonesien-Abkommen den Tierschutz bei tierischen Produkten stärken und den Import von Qualprodukten begrenzen will.',
  '23.7858': 'Die Fragestunde-Frage verlangt vom Bundesrat Angaben zur Entwicklung von Wolfsbestand und Nutztier-Schäden 2022–2023 sowie eine Begründung für den Abschuss ganzer Wolfsrudel trotz sinkender Schäden.',
  '22.7807': 'Die Fragestunde-Frage verlangt eine Klärung, wie gerissene Nutztiere entschädigt werden, wenn Gänsegeier Kadaver vor der Begutachtung durch die Wildhut stark beschädigen.',
  '24.4695': 'Das Postulat beauftragt den Bundesrat zu prüfen und Bericht zu erstatten, welche im Ausland eingesetzten Ansätze zur Förderung tierversuchsfreier Forschungsmethoden sich für die Schweiz eignen.',
  '25.4812': 'Das Postulat beauftragt den Bundesrat zu prüfen, wie der Vollzug des Tierschutzgesetzes in den Kantonen verbessert werden kann, um Fälle wie in Ramiswil zu verhindern. Genannt werden insbesondere eine bessere Zusammenarbeit der Veterinärämter mit Tierschutzorganisationen, der Ausbau von Meldestellen und ausreichende kantonale Ressourcen.',
  '24.3296': 'Das Postulat beauftragt den Bundesrat zu prüfen, welche gesetzlichen Anpassungen für eine unabhängige Tieranwaltschaft und minimale subjektive Rechte für höher entwickelte Tiere erforderlich wären.',
  '22.3187': 'Die Interpellation fragt den Bundesrat, wie züchterische und regulatorische Massnahmen die Tierwohlprobleme bei hochgezüchteten Legehennen und Mastpoulets reduzieren können.',
  '21.3363': 'Die Motion beauftragt den Bundesrat, die gesetzlichen Grundlagen so anzupassen, dass Tierversuche mit Schweregrad 3 schweizweit durch die gleiche Tierversuchskommission beurteilt werden.',
  '21.3835': 'Die Motion verlangt stichprobenhafte Kontrollen von Tierkadavern in der Fleischkontrolle und in Sammelstellen, um Tierschutzverstösse besser zu erkennen und den Ursprung zurückzuverfolgen.',
  '20.2018': 'Die Petition fordert Grundrechte für Schweine und bringt damit die rechtliche Stellung von Nutztieren im schweizerischen Recht auf die politische Agenda.',
  '20.4002': 'Die Motion verlangt, dass Transportfahrzeuge für Nutztiere bereits bei Zulassung und periodischen Kontrollen systematisch auf die Vorgaben der Tierschutzgesetzgebung geprüft werden.',
  '22.3952': 'Die Motion verlangt, die Tierschutzverordnung so anzupassen, dass den artspezifischen Bedürfnissen von Eseln, Maultieren und Mauleseln besser Rechnung getragen wird, insbesondere beim Sozialkontakt und bei der Haltung.',
  '22.3633': 'Die Motion verlangt eine Entschädigungslösung für behördlich angeordnete Betriebsschliessungen und Notschlachtungen im Zusammenhang mit der Afrikanischen Schweinepest, insbesondere für Schlacht-, Zerlege-, Verarbeitungs- und Entsorgungsbetriebe.',
}

const parseMunicipalSubmitters = (body = '') => {
  const m = String(body || '').match(/eingereicht von:\s*([^\n]+)/i)
  if (!m?.[1]) return []
  return m[1]
    .split(',')
    .map((x) => String(x || '').replace(/\s+/g, ' ').trim())
    .filter((x) => x.length >= 3)
    .slice(0, 6)
    .map((entry) => {
      const withParty = entry.match(/^(.+?)\s*\(([^)]+)\)$/)
      if (withParty) {
        return { name: withParty[1].trim(), rolle: 'Gemeinderat', partei: withParty[2].trim() }
      }
      return { name: entry, rolle: 'Gemeinderat', partei: '' }
    })
}

const inferSubmitter = (lang, title = '', summary = '', body = '', item = null) => {
  const text = `${title} ${summary} ${body}`.toLowerCase()
  const sourceId = String(item?.sourceId || '').toLowerCase()
  if (sourceId.includes('municipal')) {
    return { name: String(item?.meta?.parliament || item?.meta?.municipality || 'Stadtparlament'), rolle: 'Gemeinderat', partei: 'Überparteilich' }
  }
  const submitterFromMeta = clean(item?.meta?.submittedBy || item?.meta?.submitter || '')
  if (sourceId.startsWith('ch-parliament-') && submitterFromMeta) {
    return { name: submitterFromMeta, rolle: 'Parlament', partei: '' }
  }
  if (text.includes('blv') || text.includes('lebensmittelsicherheit') || text.includes('veterinärwesen')) {
    return { name: 'BLV', rolle: 'Regierung', partei: 'Bundesverwaltung' }
  }
  if (
    text.includes('eingereicht von bundesrat')
    || text.includes('message du conseil fédéral')
    || text.includes('messaggio del consiglio federale')
    || text.includes('geschäft des bundesrates')
    || text.includes('geschaeft des bundesrates')
    || (text.includes('botschaft') && text.includes('volksinitiative'))
  ) {
    return { name: 'Bundesrat', rolle: 'Regierung', partei: 'Bundesrat' }
  }
  if (text.includes('kommission') && text.includes('curia vista')) {
    return fallbackPeopleByLang[lang] || fallbackPeopleByLang.de
  }
  return fallbackPeopleByLang[lang] || fallbackPeopleByLang.de
}

const repairEncodingArtifacts = (text = '') => String(text)
  .replace(/Parlamentsgesch(?:�|Ã¤)ft/gi, 'Parlamentsgeschäft')
  .replace(/Gesch(?:�|Ã¤)ftsnummer/gi, 'Geschäftsnummer')
  .replace(/Kurz(?:�|Ã¼)berblick/gi, 'Kurzüberblick')
  .replace(/KurzA(?:�|Ã¼)berblick/gi, 'Kurzüberblick')
  .replace(/gem(?:�|Ã¤)ss/gi, 'gemäss')
  .replace(/gemass/gi, 'gemäss')
  .replace(/Gem(?:�|Ã¤)ss/g, 'Gemäss')
  .replace(/GemAss/g, 'Gemäss')
  .replace(/\s�\s/g, ' - ')

const clean = (text = '') => repairEncodingArtifacts(String(text))
  .replace(/\s+/g, ' ')
  .replace(/^\s+|\s+$/g, '')

const normalizeDisplayTitle = (item, title = '') => {
  let t = clean(title)
  if (!t) return t
  t = t.replace(/^(\d{2}\.\d{3,4})\s*[·•]\s*/u, '$1 - ')

  const placeholderMatch = t.match(/^Parlamentsgeschäft\s+(\d{8})$/i)
  if (placeholderMatch && String(item?.externalId || '').startsWith(placeholderMatch[1])) {
    const normalizedBusinessNo = formatBusinessNumber('', String(item?.externalId || ''), '', '', item?.meta)
    if (/^\d{2}\.\d{3,4}$/.test(normalizedBusinessNo)) {
      t = `Parlamentsgeschäft ${normalizedBusinessNo}`
    }
  }

  if (String(item?.meta?.municipality || '').toLowerCase() === 'bern') {
    t = t.replace(/^Bern\s*[·:-]\s*/i, '')
  }
  return t
}

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

const THEME_EXCLUDE = new Set(['botschaft', 'initiative', 'motion', 'postulat', 'interpellation', 'anfrage', 'gesetz'])

const sanitizeThemes = (arr = []) => arr
  .map((x) => String(x || '').trim())
  .filter((x) => x && !THEME_EXCLUDE.has(x.toLowerCase()))
  .filter((x) => !['tiere', 'animals', 'animali'].includes(String(x || '').toLowerCase()))

const formatThemeLabel = (value = '') => {
  const s = String(value || '').trim()
  if (!s) return s
  if (/^tierversuch(e)?$/i.test(s)) return 'Tierversuche'
  if (/^geflügel$/i.test(s) || /^gefluegel$/i.test(s)) return 'Masthühner'
  return s.charAt(0).toUpperCase() + s.slice(1)
}

const municipalThemesFromTitle = (title = '') => {
  const t = String(title || '').toLowerCase()
  const out = []
  if (t.includes('feuerwerk') || t.includes('lärm') || t.includes('laerm')) out.push('Feuerwerk')
  if (t.includes('tierpark')) out.push('Zoo')
  if (t.includes('biodivers')) out.push('Biodiversität')
  if (t.includes('wald')) out.push('Wald')
  if (t.includes('siedlungsgebiet')) out.push('Siedlungsgebiet')
  if (t.includes('landwirtschaftsgebiet')) out.push('Landwirtschaft')
  if (!out.length && t.includes('tier')) out.push('Tierschutz')
  if (!out.length) out.push('Tierschutz')
  return [...new Set(out)].slice(0, 4)
}

const isWeakSummarySentence = (text = '') => {
  const s = String(text || '').toLowerCase().trim()
  if (!s) return true
  return s === 'eingereicht'
    || s.includes('stellungnahme zum vorstoss liegt vor')
    || s.includes('stellungnahme liegt vor')
    || s.includes('antwort liegt vor')
    || s.includes('zugewiesen an die behandelnde kommission')
    || s.includes('überwiesen an den bundesrat')
    || s.includes('ueberwiesen an den bundesrat')
    || s.includes('|')
    || /^parlamentsgesch(ä|a)ft\s+/i.test(s)
}

const summarizeVorstoss = ({ title = '', summary = '', body = '', status = '', sourceId = '' }) => {
  const t = clean(title)
  if (String(sourceId || '').startsWith('ch-municipal-')) {
    const state = status === 'published' ? 'abgeschlossen' : 'in Beratung'
    return `${t} (Gemeinde, ${state}).`
  }
  const summaryClean = clean(summary).replace(/eingereicht von:[^\n]*/ig, '').trim()
  const bodyClean = clean(body).replace(/eingereicht von:[^\n]*/ig, '').trim()
  const s = firstSentence(summaryClean)
  const b = firstSentence(bodyClean)
  const low = `${t} ${summary} ${body}`.toLowerCase()
  const statusLabel = status === 'published' ? 'abgeschlossen' : 'in Beratung'

  const sentences = []

  if (low.includes('chlorhühner') || low.includes('chlorhuehner') || (low.includes('geflügel') && low.includes('importverbot'))) {
    sentences.push('Der Vorstoss verlangt ein klares Importverbot für chemisch behandeltes Geflügelfleisch ("Chlorhühner") und die Verankerung im Gesetz.')
    sentences.push('Im Fokus steht, ob Tierschutz- und Konsumentenschutzstandards im Import konsequent abgesichert werden.')
  } else if (low.includes('stopfleber') || low.includes('foie gras')) {
    sentences.push('Dieser Vorstoss betrifft die Stopfleber-Thematik (Foie gras) und die politische Umsetzung eines indirekten Gegenentwurfs mit stufenweisen Importbeschränkungen.')
    sentences.push('Im Zentrum steht, wie streng der Schutz von Tieren in der Produktions- und Importkette rechtlich ausgestaltet werden soll.')
  } else if (low.includes('3r') || low.includes('tierfreie') || low.includes('tierärmere') || low.includes('expérimentation animale')) {
    sentences.push('Dieser Vorstoss behandelt Alternativen zu Tierversuchen (3R) und die Frage, wie Forschung gezielt in tierfreie bzw. tierärmere Methoden gelenkt werden kann.')
    sentences.push('Diskutiert werden typischerweise Ressourcen, Anreize und konkrete Umsetzungsmechanismen im Forschungsbereich.')
  } else if (low.includes('wolf') || low.includes('wildtier') || low.includes('jagd') || low.includes('chasse')) {
    sentences.push('Dieser Vorstoss betrifft die Wildtierpolitik, insbesondere das Spannungsfeld zwischen Schutz, Regulierung und Jagd.')
    sentences.push('Für die Einordnung ist zentral, ob die vorgeschlagenen Massnahmen den Schutzstatus stärken oder Eingriffe ausweiten.')
  }

  if (s && !isWeakSummarySentence(s)) sentences.push(s)
  if (b && b !== s && !isWeakSummarySentence(b)) sentences.push(b)

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

const isParliamentSourceId = (sourceId = '') => String(sourceId || '').startsWith('ch-parliament-')
const isPublicSourceId = (sourceId = '') => {
  const sid = String(sourceId || '')
  return sid.startsWith('ch-parliament-') || sid.startsWith('ch-municipal-') || sid.startsWith('ch-cantonal-')
}

const effectiveStatusFor = (item) => {
  const key = `${item?.sourceId || ''}:${item?.externalId || ''}`
  const decisionStatus = String(reviewDecisions?.[key]?.status || '').toLowerCase()
  if (decisionStatus) return decisionStatus
  return String(item?.status || '').toLowerCase()
}

const baseItems = (db.items || [])
  .filter((item) => !item?.meta?.scaffold)
  .filter((item) => isPublicSourceId(item?.sourceId))
  .filter((item) => ['approved', 'published'].includes(effectiveStatusFor(item)))

const groupedByAffair = new Map()
for (const item of baseItems) {
  const isParliament = isParliamentSourceId(item.sourceId)
  const affairKey = isParliament
    ? String(item.externalId || '').split('-')[0]
    : `${item.sourceId}:${item.externalId}`
  const lang = langFromSource(item.sourceId)
  const prev = groupedByAffair.get(affairKey)
  if (!prev) {
    groupedByAffair.set(affairKey, item)
    continue
  }
  const prevLang = langFromSource(prev.sourceId)
  const betterLang = langRank(lang) < langRank(prevLang)
  const newer = new Date(item.fetchedAt || item.publishedAt || 0).getTime() > new Date(prev.fetchedAt || prev.publishedAt || 0).getTime()
  if (betterLang || (!betterLang && newer)) groupedByAffair.set(affairKey, item)
}

const items = [...groupedByAffair.values()].slice(0, 1200)

const deByAffair = new Map(
  (db.items || [])
    .filter((x) => String(x.sourceId || '').startsWith('ch-parliament-') && String(x.sourceId || '').endsWith('-de'))
    .map((x) => [String(x.externalId || '').split('-')[0], x]),
)

const variantsByAffair = new Map()
for (const row of (db.items || [])) {
  const sid = String(row.sourceId || '')
  if (!sid.startsWith('ch-parliament-')) continue
  const affairId = String(row.externalId || '').split('-')[0]
  if (!affairId) continue
  const lang = langFromSource(sid)
  const prevAffair = variantsByAffair.get(affairId) || {}
  const prev = prevAffair[lang]
  const prevTs = new Date(prev?.fetchedAt || prev?.publishedAt || 0).getTime()
  const curTs = new Date(row.fetchedAt || row.publishedAt || 0).getTime()
  if (!prev || curTs >= prevTs) {
    prevAffair[lang] = row
    variantsByAffair.set(affairId, prevAffair)
  }
}

const buildInitiativeLinks = ({ typ, externalId }) => {
  if (typ !== 'Volksinitiative') return undefined

  const affairId = String(externalId || '').split('-')[0]
  const mapped = initiativeLinkMap[affairId] || {}
  const campaignUrl = String(mapped.campaignUrl || '').trim()
  const resultUrl = String(mapped.resultUrl || '').trim()

  if (!campaignUrl && !resultUrl) return undefined
  return {
    ...(campaignUrl ? { campaignUrl } : {}),
    ...(resultUrl ? { resultUrl } : {}),
  }
}

const buildI18nFromItem = (variants, item, fallbackTitle, fallbackSummary, fallbackType, fallbackThemes, businessNumber = '') => {
  const out = {
    title: { de: fallbackTitle },
    summary: { de: fallbackSummary },
    type: { de: typeLabels[fallbackType]?.de || fallbackType },
    themes: { de: fallbackThemes },
  }

  for (const [lang, variant] of Object.entries(variants || {})) {
    const l = ['de', 'fr', 'it', 'en'].includes(lang) ? lang : 'de'
    const title = clean(variant?.title || fallbackTitle)
    const weakTitle = !title || /^parlamentsgeschäft\s+\d+$/i.test(title)
    const summary = clean(variant?.summary || variant?.body || fallbackSummary)
    const summaryLow = summary.toLowerCase()
    const weakSummary = !summary
      || summary.length < 24
      || summaryLow === 'erledigt'
      || /^parlamentsgeschäft\s+\d+$/i.test(summary)
    const typeDe = TYPE_OVERRIDES[businessNumber] || inferType(title, item.sourceId, variant?.businessTypeName || '', item?.meta?.rawType || '')
    const matched = mapThemesFromKeywords(item.matchedKeywords || fallbackThemes || []).slice(0, 6)
    out.title[l] = weakTitle ? fallbackTitle : title
    out.summary[l] = weakSummary ? fallbackSummary : summary
    out.type[l] = typeLabels[typeDe]?.[l] || typeLabels[fallbackType]?.[l] || fallbackType
    out.themes[l] = l === 'de'
      ? fallbackThemes
      : matched.map((kw) => localizeTheme(kw, l))
  }

  return out
}

const vorstoesse = items.map((item, index) => {
  const sprache = langFromSource(item.sourceId)
  const isParliament = isParliamentSourceId(item.sourceId)
  const affairId = String(item.externalId || '').split('-')[0]
  const deVariant = isParliament ? deByAffair.get(affairId) : null
  const displayTitleRaw = deVariant?.title || item.title
  const displayTitle = normalizeDisplayTitle(item, displayTitleRaw)
  const displaySummary = deVariant?.summary || item.summary
  const displayBody = deVariant?.body || item.body
  const inferredYear = inferYearFromBusiness(displayTitle, item.externalId)
  const computedEingereicht = toIsoDate(item.publishedAt || item.fetchedAt, inferredYear)
  const updated = toIsoDate(item.fetchedAt || item.publishedAt)
  const inferredStatus = mapStatus(item.status, item?.meta?.rawStatus || '', displaySummary, displayBody)
  const businessNumber = formatBusinessNumber(
    displayTitle,
    item.externalId || `AUTO-${index + 1}`,
    displaySummary,
    displayBody,
    item?.meta,
  )
  const eingereicht = SUBMISSION_DATE_OVERRIDES[businessNumber] || computedEingereicht
  const status = STATUS_OVERRIDES[businessNumber] || inferredStatus
  const titleOverride = TITLE_OVERRIDES[businessNumber]
  const finalTitle = titleOverride || displayTitle
  const inferredType = inferType(finalTitle, item.sourceId, item?.languageVariants?.de?.businessTypeName || '', item?.meta?.rawType || '')
  const typ = TYPE_OVERRIDES[businessNumber] || inferredType
  const stance = extractStance(item.reviewReason, finalTitle, displaySummary, displayBody)
  const initiativeLinks = buildInitiativeLinks({
    typ,
    title: displayTitle,
    externalId: item.externalId,
    status,
  })
  const idSafe = String(item.externalId || `${Date.now()}-${index}`).replace(/[^a-zA-Z0-9-]/g, '-')
  const municipalSourceLink = String(item?.meta?.sourceLink || '').trim()
  const link = municipalSourceLink.startsWith('http')
    ? municipalSourceLink
    : (item.sourceUrl && item.sourceUrl.startsWith('http')
      ? item.sourceUrl
      : `https://www.parlament.ch/de/ratsbetrieb/suche-curia-vista/geschaeft?AffairId=${String(item.externalId || '').split('-')[0]}`)
  const rawSummaryText = SUMMARY_OVERRIDES[businessNumber] || summarizeVorstoss({
    title: finalTitle,
    summary: displaySummary,
    body: displayBody,
    status: item.status,
    sourceId: item.sourceId,
  })
  const normalizedSummary = clean(rawSummaryText)
  const summaryText = normalizedSummary.length >= 10
    ? normalizedSummary
    : `${finalTitle || `Vorstoss ${index + 1}`} (${status}).`
  const inlineThemes = [
    ...parseStructuredThemes(displaySummary),
    ...parseStructuredThemes(displayBody),
  ]
  const themeKeywords = item.matchedKeywords?.length
    ? [...item.matchedKeywords, ...inlineThemes]
    : (inlineThemes.length ? inlineThemes : ['Tierschutz'])
  const normalizedThemes = sanitizeThemes(mapThemesFromKeywords(themeKeywords))
  const isMunicipal = String(item?.sourceId || '').startsWith('ch-municipal-')
  const themeOverride = THEME_OVERRIDES[businessNumber]
  const baseThemes = Array.isArray(themeOverride) && themeOverride.length
    ? themeOverride
    : (isMunicipal
      ? municipalThemesFromTitle(finalTitle)
      : (normalizedThemes.length ? normalizedThemes : ['Tierschutz']).slice(0, 6))
  const i18nVariants = isParliament ? (variantsByAffair.get(affairId) || {}) : {}
  const i18nMeta = buildI18nFromItem(i18nVariants, item, finalTitle || `Vorstoss ${index + 1}`, summaryText, typ, baseThemes, businessNumber)

  const municipalSubmitters = String(item?.sourceId || '').startsWith('ch-municipal-')
    ? parseMunicipalSubmitters(displayBody)
    : []
  const submitterOverride = SUBMITTER_OVERRIDES[businessNumber]

  return {
    id: `vp-${idSafe.toLowerCase()}`,
    titel: finalTitle || `Vorstoss ${index + 1}`,
    typ,
    kurzbeschreibung: summaryText,
    geschaeftsnummer: businessNumber,
    ebene: levelFromItem(item),
    kanton: cantonFromItem(item),
    regionGemeinde: regionFromItem(item),
    status,
    datumEingereicht: eingereicht,
    datumAktualisiert: updated,
    themen: [...new Set(baseThemes.map((x) => formatThemeLabel(x)))],
    schlagwoerter: (item.matchedKeywords?.length ? item.matchedKeywords : ['Tierpolitik']).slice(0, 8),
    einreichende: submitterOverride
      ? [submitterOverride]
      : (municipalSubmitters.length ? municipalSubmitters : [inferSubmitter(sprache, finalTitle, displaySummary, displayBody, item)]),
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
