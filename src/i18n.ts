export type Language = 'de' | 'fr' | 'it' | 'en'

export const languageNames: Record<Language, string> = {
  de: 'DE',
  fr: 'FR',
  it: 'IT',
  en: 'ENG',
}

export const statusLabels: Record<string, Record<Language, string>> = {
  Eingereicht: { de: 'Beratung', fr: 'En délibération', it: 'In discussione', en: 'In review' },
  'In Beratung': { de: 'Beratung', fr: 'En délibération', it: 'In discussione', en: 'In review' },
  Angenommen: { de: 'Angenommen', fr: 'Accepté', it: 'Accolto', en: 'Accepted' },
  Abgelehnt: { de: 'Abgelehnt', fr: 'Rejeté', it: 'Respinto', en: 'Rejected' },
  Abgeschrieben: { de: 'Erledigt', fr: 'Clôturé', it: 'Chiuso', en: 'Closed' },
  Zurueckgezogen: { de: 'Zurückgezogen', fr: 'Retiré', it: 'Ritirato', en: 'Withdrawn' },
  Zurückgezogen: { de: 'Zurückgezogen', fr: 'Retiré', it: 'Ritirato', en: 'Withdrawn' },
}

export const typeLabels: Record<string, Record<Language, string>> = {
  Volksinitiative: { de: 'Volksinitiative', fr: 'Initiative populaire', it: 'Iniziativa popolare', en: 'Popular initiative' },
  'Parlamentarische Initiative': { de: 'Parlamentarische Initiative', fr: 'Initiative parlementaire', it: 'Iniziativa parlamentare', en: 'Parliamentary initiative' },
  Interpellation: { de: 'Interpellation', fr: 'Interpellation', it: 'Interpellanza', en: 'Interpellation' },
  Motion: { de: 'Motion', fr: 'Motion', it: 'Mozione', en: 'Motion' },
  Postulat: { de: 'Postulat', fr: 'Postulat', it: 'Postulato', en: 'Postulate' },
  Anfrage: { de: 'Anfrage', fr: 'Question', it: 'Interrogazione', en: 'Question' },
  'Fragestunde. Frage': { de: 'Fragestunde', fr: 'Heure des questions', it: 'Ora delle domande', en: 'Question Time' },
  'Fragestunde (Frage)': { de: 'Fragestunde', fr: 'Heure des questions', it: 'Ora delle domande', en: 'Question Time' },
  Petition: { de: 'Petition', fr: 'Pétition', it: 'Petizione', en: 'Petition' },
}

export type I18nText = {
  title: string
  subtitle: string
  language: string
  results: string
  dbIntroTitle: string
  dbIntroSubtitle: string
  projectBy: string
  search: string
  searchPlaceholder: string
  level: string
  status: string
  canton: string
  themes: string
  type: string
  keywords: string
  detailsSearchShow: string
  detailsSearchHide: string
  detailsActive: string
  activeFilters: string
  resetFilters: string
  from: string
  to: string
  export: string
  csvVisible: string
  csvAll: string
  jsonFiltered: string
  columnsToggle: string
  pageSize: string
  open: string
  back: string
  next: string
  page: string
  close: string
  businessNo: string
  region: string
  dateSubmitted: string
  submitters: string
  copyLink: string
  openBusiness: string
  timeline: string
  titleCol: string
  shortDescription: string
  media: string
  result: string
  section: {
    federal: string
    cantonal: string
    municipal: string
  }
}

export const i18n: Record<Language, I18nText> = {
  de: {
    title: 'Tierpolitik-Monitor Schweiz',
    subtitle: 'Die wichtigsten parlamentarischen Vorstösse rund um Tierschutz und Tierrechte.',
    language: 'Sprache',
    results: 'Fälle',
    dbIntroTitle: 'Politische Vorstösse im Überblick',
    dbIntroSubtitle: 'Hier siehst du die wichtigsten Geschäfte auf einen Blick und kannst direkt in die Details eintauchen.',
    projectBy: 'Ein Projekt von',
    search: 'Suche',
    searchPlaceholder: 'Suchen ...',
    level: 'Ebene',
    status: 'Status',
    canton: 'Kanton',
    themes: 'Themen',
    type: 'Typ',
    keywords: 'Schlagwörter',
    detailsSearchShow: 'Detailsuche anzeigen',
    detailsSearchHide: 'Detailsuche ausblenden',
    detailsActive: 'Detailsuche aktiv',
    activeFilters: 'Aktive Filter',
    resetFilters: 'Filter zurücksetzen',
    from: 'Von',
    to: 'Bis',
    export: 'Export',
    csvVisible: 'CSV (sichtbare Spalten)',
    csvAll: 'CSV (alle Spalten)',
    jsonFiltered: 'JSON (gefiltert)',
    columnsToggle: 'Spalten ein-/ausblenden',
    pageSize: 'Seitenlänge',
    open: 'Öffnen',
    back: 'Zurück',
    next: 'Weiter',
    page: 'Seite',
    close: 'Schliessen',
    businessNo: 'Geschäftsnummer',
    region: 'Region/Gemeinde',
    dateSubmitted: 'Datum',
    submitters: 'Einreichende',
    copyLink: 'Link kopieren',
    openBusiness: 'Geschäft öffnen',
    timeline: 'Timeline',
    titleCol: 'Titel',
    shortDescription: 'Kurzbeschreibung',
    media: 'Medien',
    result: 'Resultat',
    section: { federal: 'Bund', cantonal: 'Kanton', municipal: 'Gemeinde' },
  },
  fr: {
    title: 'Moniteur suisse de politique animale',
    subtitle: 'Les principales interventions parlementaires sur la protection et les droits des animaux.',
    language: 'Langue',
    results: 'Résultats',
    dbIntroTitle: 'Vue d’ensemble des interventions politiques',
    dbIntroSubtitle: 'Retrouvez ici les objets principaux et accédez directement aux détails.',
    projectBy: 'Un projet de',
    search: 'Recherche',
    searchPlaceholder: 'Titre, description, numéro d’objet ...',
    level: 'Niveau',
    status: 'Statut',
    canton: 'Canton',
    themes: 'Thèmes',
    type: 'Type',
    keywords: 'Mots-clés',
    detailsSearchShow: 'Afficher la recherche avancée',
    detailsSearchHide: 'Masquer la recherche avancée',
    detailsActive: 'Recherche avancée active',
    activeFilters: 'Filtres actifs',
    resetFilters: 'Réinitialiser les filtres',
    from: 'Du',
    to: 'Au',
    export: 'Export',
    csvVisible: 'CSV (colonnes visibles)',
    csvAll: 'CSV (toutes les colonnes)',
    jsonFiltered: 'JSON (filtré)',
    columnsToggle: 'Afficher/masquer les colonnes',
    pageSize: 'Taille de page',
    open: 'Ouvrir',
    back: 'Précédent',
    next: 'Suivant',
    page: 'Page',
    close: 'Fermer',
    businessNo: 'Numéro d’objet',
    region: 'Région/Commune',
    dateSubmitted: 'Date de dépôt',
    submitters: 'Déposants',
    copyLink: 'Copier le lien',
    openBusiness: 'Ouvrir l’objet',
    timeline: 'Chronologie',
    titleCol: 'Titre',
    shortDescription: 'Description courte',
    media: 'Médias',
    result: 'Résultat',
    section: { federal: 'Fédéral', cantonal: 'Cantonal', municipal: 'Communal' },
  },
  it: {
    title: 'Monitor svizzero di politica animale',
    subtitle: 'Le principali iniziative parlamentari su protezione e diritti degli animali.',
    language: 'Lingua',
    results: 'Risultati',
    dbIntroTitle: 'Panoramica delle iniziative politiche',
    dbIntroSubtitle: 'Qui trovi gli atti principali e puoi aprire subito i dettagli.',
    projectBy: 'Un progetto di',
    search: 'Ricerca',
    searchPlaceholder: 'Titolo, descrizione, numero dell’atto ...',
    level: 'Livello',
    status: 'Stato',
    canton: 'Cantone',
    themes: 'Temi',
    type: 'Tipo',
    keywords: 'Parole chiave',
    detailsSearchShow: 'Mostra ricerca avanzata',
    detailsSearchHide: 'Nascondi ricerca avanzata',
    detailsActive: 'Ricerca avanzata attiva',
    activeFilters: 'Filtri attivi',
    resetFilters: 'Reimposta filtri',
    from: 'Dal',
    to: 'Al',
    export: 'Esporta',
    csvVisible: 'CSV (colonne visibili)',
    csvAll: 'CSV (tutte le colonne)',
    jsonFiltered: 'JSON (filtrato)',
    columnsToggle: 'Mostra/nascondi colonne',
    pageSize: 'Elementi per pagina',
    open: 'Apri',
    back: 'Indietro',
    next: 'Avanti',
    page: 'Pagina',
    close: 'Chiudi',
    businessNo: 'Numero atto',
    region: 'Regione/Comune',
    dateSubmitted: 'Data di deposito',
    submitters: 'Proponenti',
    copyLink: 'Copia link',
    openBusiness: 'Apri atto',
    timeline: 'Cronologia',
    titleCol: 'Titolo',
    shortDescription: 'Descrizione breve',
    media: 'Media',
    result: 'Esito',
    section: { federal: 'Federale', cantonal: 'Cantonale', municipal: 'Comunale' },
  },
  en: {
    title: 'Swiss Animal Policy Monitor',
    subtitle: 'Key parliamentary initiatives on animal protection and animal rights.',
    language: 'Language',
    results: 'Results',
    dbIntroTitle: 'Political initiatives at a glance',
    dbIntroSubtitle: 'See the key motions here and jump directly into the details.',
    projectBy: 'A project by',
    search: 'Search',
    searchPlaceholder: 'Title, summary, reference number ...',
    level: 'Level',
    status: 'Status',
    canton: 'Canton',
    themes: 'Themes',
    type: 'Type',
    keywords: 'Keywords',
    detailsSearchShow: 'Show advanced search',
    detailsSearchHide: 'Hide advanced search',
    detailsActive: 'Advanced filters active',
    activeFilters: 'Active filters',
    resetFilters: 'Reset filters',
    from: 'From',
    to: 'To',
    export: 'Export',
    csvVisible: 'CSV (visible columns)',
    csvAll: 'CSV (all columns)',
    jsonFiltered: 'JSON (filtered)',
    columnsToggle: 'Show/hide columns',
    pageSize: 'Page size',
    open: 'Open',
    back: 'Back',
    next: 'Next',
    page: 'Page',
    close: 'Close',
    businessNo: 'Reference number',
    region: 'Region/Municipality',
    dateSubmitted: 'Submission date',
    submitters: 'Submitters',
    copyLink: 'Copy link',
    openBusiness: 'Open dossier',
    timeline: 'Timeline',
    titleCol: 'Title',
    shortDescription: 'Short description',
    media: 'Media',
    result: 'Outcome',
    section: { federal: 'Federal', cantonal: 'Cantonal', municipal: 'Municipal' },
  },
}

const contentDictionary: Record<Language, Array<[RegExp, string]>> = {
  de: [
    [/staerkerem/gi, 'stärkerem'],
    [/nutztierhaltung/gi, 'Nutztierhaltung'],
    [/geschaeft/gi, 'Geschäft'],
  ],
  fr: [
    [/Volksinitiative/gi, 'Initiative populaire'],
    [/Interpellation/gi, 'Interpellation'],
    [/Motion/gi, 'Motion'],
    [/Postulat/gi, 'Postulat'],
    [/Anfrage/gi, 'Question'],
    [/Themen/gi, 'Thèmes'],
    [/Vorstoss/gi, 'Intervention'],
    [/Frei erfundener Vorstoss zur Verbesserung von/gi, 'Intervention fictive visant à améliorer'],
    [/mit messbaren Kriterien und staerkerem Vollzug\./gi, 'avec des critères mesurables et une mise en œuvre renforcée.'],
    [/verbessern/gi, 'améliorer'],
    [/Nutztierhaltung/gi, 'élevage'],
    [/Versuche/gi, 'expérimentation animale'],
    [/Import/gi, 'importations'],
    [/Kennzeichnung/gi, 'étiquetage'],
    [/Subventionen/gi, 'subventions'],
    [/Transport/gi, 'transport'],
    [/Heimtiere?/gi, 'animaux de compagnie'],
    [/Wildtiere/gi, 'animaux sauvages'],
    [/Jagd/gi, 'chasse'],
    [/Tierwohl/gi, 'bien-être animal'],
    [/Tierschutz/gi, 'protection animale'],
    [/Tierrechte/gi, 'droits des animaux'],
    [/Transparenz/gi, 'transparence'],
    [/Ernährung|Ernaehrung/gi, 'alimentation'],
    [/Biodiversität|Biodiversitaet|biodiversita/gi, 'biodiversité'],
    [/Landwirtschaft|agriculture/gi, 'agriculture'],
    [/Nutztiere/gi, 'animaux d’élevage'],
    [/Massentierhaltung/gi, 'élevage intensif'],
    [/Geflügel/gi, 'volaille'],
    [/Hunde?/gi, 'chiens'],
    [/Schweinezucht/gi, 'élevage porcin'],
    [/Schweine?|Schwein/gi, 'porcs'],
    [/Schlacht/gi, 'abattage'],
    [/Stopfleber|foie gras/gi, 'foie gras'],
    [/Wolf/gi, 'loup'],
    [/Gesetz/gi, 'loi'],
    [/Bodenrecht/gi, 'droit foncier'],
    [/Gegenentwurf/gi, 'contre-projet'],
    [/Bund/gi, 'Confédération'],
    [/Kanton/gi, 'canton'],
    [/Gemeinde/gi, 'commune'],
    [/Haltung/gi, 'détention'],
    [/Vollzug/gi, 'application'],
    [/Förderung|Foerderung/gi, 'promotion'],
    [/Kontrolle/gi, 'contrôle'],
    [/Label/gi, 'label'],
    [/Verbot/gi, 'interdiction'],
    [/Strafe/gi, 'sanction'],
  ],
  it: [
    [/Volksinitiative/gi, 'Iniziativa popolare'],
    [/Interpellation/gi, 'Interpellanza'],
    [/Motion/gi, 'Mozione'],
    [/Postulat/gi, 'Postulato'],
    [/Anfrage/gi, 'Interrogazione'],
    [/Themen/gi, 'Temi'],
    [/Vorstoss/gi, 'Iniziativa'],
    [/Frei erfundener Vorstoss zur Verbesserung von/gi, 'Iniziativa fittizia per migliorare'],
    [/mit messbaren Kriterien und staerkerem Vollzug\./gi, 'con criteri misurabili e un’applicazione più rigorosa.'],
    [/verbessern/gi, 'migliorare'],
    [/Nutztierhaltung/gi, 'allevamento'],
    [/Versuche/gi, 'sperimentazione animale'],
    [/Import/gi, 'importazioni'],
    [/Kennzeichnung/gi, 'etichettatura'],
    [/Subventionen/gi, 'sussidi'],
    [/Transport/gi, 'trasporto'],
    [/Heimtiere?/gi, 'animali da compagnia'],
    [/Wildtiere/gi, 'animali selvatici'],
    [/Jagd/gi, 'caccia'],
    [/Tierwohl/gi, 'benessere animale'],
    [/Tierschutz/gi, 'protezione degli animali'],
    [/Tierrechte/gi, 'diritti degli animali'],
    [/Transparenz/gi, 'trasparenza'],
    [/Ernährung|Ernaehrung|nutrition/gi, 'alimentazione'],
    [/Biodiversität|Biodiversitaet|biodiversita/gi, 'biodiversità'],
    [/Landwirtschaft|agriculture/gi, 'agricoltura'],
    [/Nutztiere/gi, 'animali da reddito'],
    [/Massentierhaltung/gi, 'allevamento intensivo'],
    [/Geflügel/gi, 'pollame'],
    [/Hunde?/gi, 'cani'],
    [/Schweinezucht/gi, 'allevamento suino'],
    [/Schweine?|Schwein/gi, 'suini'],
    [/Schlacht/gi, 'macellazione'],
    [/Stopfleber|foie gras/gi, 'foie gras'],
    [/Wolf/gi, 'lupo'],
    [/Gesetz/gi, 'legge'],
    [/Bodenrecht/gi, 'diritto fondiario'],
    [/Gegenentwurf/gi, 'controprogetto'],
    [/Bund/gi, 'Confederazione'],
    [/Kanton/gi, 'cantone'],
    [/Gemeinde/gi, 'comune'],
    [/Haltung/gi, 'detenzione'],
    [/Vollzug/gi, 'applicazione'],
    [/Förderung|Foerderung/gi, 'promozione'],
    [/Kontrolle/gi, 'controllo'],
    [/Label/gi, 'etichetta'],
    [/Verbot/gi, 'divieto'],
    [/Strafe/gi, 'sanzione'],
  ],
  en: [
    [/Volksinitiative/gi, 'Popular initiative'],
    [/Interpellation/gi, 'Interpellation'],
    [/Motion/gi, 'Motion'],
    [/Postulat/gi, 'Postulate'],
    [/Anfrage/gi, 'Question'],
    [/Themen/gi, 'Themes'],
    [/Vorstoss/gi, 'Initiative'],
    [/Frei erfundener Vorstoss zur Verbesserung von/gi, 'Sample initiative to improve'],
    [/mit messbaren Kriterien und staerkerem Vollzug\./gi, 'with measurable criteria and stronger enforcement.'],
    [/verbessern/gi, 'improve'],
    [/Nutztierhaltung/gi, 'livestock farming'],
    [/Versuche/gi, 'animal testing'],
    [/Import/gi, 'imports'],
    [/Kennzeichnung/gi, 'labelling'],
    [/Subventionen/gi, 'subsidies'],
    [/Transport/gi, 'transport'],
    [/Heimtiere?/gi, 'companion animals'],
    [/Wildtiere/gi, 'wild animals'],
    [/Jagd/gi, 'hunting'],
    [/Tierwohl/gi, 'animal welfare'],
    [/Tierschutz/gi, 'animal protection'],
    [/Tierrechte/gi, 'animal rights'],
    [/Transparenz/gi, 'transparency'],
    [/Ernährung|Ernaehrung|nutrition/gi, 'nutrition'],
    [/Biodiversität|Biodiversitaet|biodiversita/gi, 'biodiversity'],
    [/Landwirtschaft|agriculture/gi, 'agriculture'],
    [/Nutztiere/gi, 'farm animals'],
    [/Massentierhaltung/gi, 'intensive livestock farming'],
    [/Geflügel/gi, 'poultry'],
    [/Hunde?/gi, 'dogs'],
    [/Schweinezucht/gi, 'pig breeding'],
    [/Schweine?|Schwein/gi, 'pigs'],
    [/Schlacht/gi, 'slaughter'],
    [/Stopfleber|foie gras/gi, 'foie gras'],
    [/Wolf/gi, 'wolf'],
    [/Gesetz/gi, 'law'],
    [/Bodenrecht/gi, 'land law'],
    [/Gegenentwurf/gi, 'counterproposal'],
    [/Bund/gi, 'federal'],
    [/Kanton/gi, 'canton'],
    [/Gemeinde/gi, 'municipality'],
    [/Haltung/gi, 'keeping'],
    [/Vollzug/gi, 'enforcement'],
    [/Förderung|Foerderung/gi, 'promotion'],
    [/Kontrolle/gi, 'control'],
    [/Label/gi, 'label'],
    [/Verbot/gi, 'ban'],
    [/Strafe/gi, 'penalty'],
  ],
}

function normalizeStatusInput(status: string): string {
  return String(status || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .trim()
}

export function canonicalStatus(status: string): keyof typeof statusLabels {
  const s = normalizeStatusInput(status)

  if (!s) return 'In Beratung'
  if (s.includes('zuruckgezogen') || s.includes('zurueckgezogen')) return 'Zurueckgezogen'
  if (s.includes('abgelehnt') || s.includes('rejet')) return 'Abgelehnt'
  if (s.includes('angenommen') || s.includes('accept')) return 'Angenommen'
  if (s.includes('uberwiesen an den bundesrat') || s.includes('ueberwiesen an den bundesrat')) return 'Angenommen'
  if (s.includes('eingereicht') || s.includes('depose') || s.includes('presentato') || s.includes('submitted')) return 'In Beratung'
  if (
    s.includes('in beratung') ||
    s.includes('beratung') ||
    s.includes('stellungnahme zum vorstoss liegt vor') ||
    s.includes('zugewiesen an die behandelnde kommission') ||
    s.includes('in kommission') ||
    s.includes('en deliberation') ||
    s.includes('in discussione') ||
    s.includes('in review')
  ) return 'In Beratung'

  if (s.includes('abgeschrieben') || s.includes('erledigt') || s.includes('classe') || s.includes('archiviato') || s.includes('closed')) return 'Abgeschrieben'

  return 'In Beratung'
}

export function statusClassSlug(status: string): string {
  const c = canonicalStatus(status)
  return c.toLowerCase().replace(/\s+/g, '-').replace('zurückgezogen', 'zurueckgezogen')
}

export function translateStatus(status: string, lang: Language): string {
  const canonical = canonicalStatus(status)
  return statusLabels[canonical]?.[lang] ?? status
}

export function statusIcon(status: string): string {
  const canonical = canonicalStatus(status)
  if (canonical === 'In Beratung') return '⏳'
  if (canonical === 'Angenommen') return '✔'
  if (canonical === 'Abgelehnt') return '✖'
  if (canonical === 'Abgeschrieben') return '✓'
  if (canonical === 'Zurueckgezogen' || canonical === 'Zurückgezogen') return '↩'
  if (canonical === 'Eingereicht') return '📝'
  return '•'
}

export function translateType(type: string, lang: Language): string {
  return typeLabels[type]?.[lang] ?? type
}

export function translateContent(text: string, lang: Language): string {
  const rules = contentDictionary[lang]
  return rules.reduce((acc, [rx, replacement]) => acc.replace(rx, replacement), text)
}

function translateEnBestEffort(text: string): string {
  const phraseRules: Array<[RegExp, string]> = [
    [/Konsequenzen aus dem Tierschutzfall/gi, 'Consequences of the animal welfare case'],
    [/Einseitige vegetarische Rezeptempfehlungen des BLV für Kinder/gi, 'One-sided vegetarian recipe recommendations by FSVO for children'],
    [/Importverbot für chemisch behandeltes Geflügelfleisch/gi, 'Import ban on chemically treated poultry meat'],
    [/gesetzlich verankern/gi, 'to be enshrined in law'],
    [/Ist die Erhaltung seltener Nutztierrassen durch die geplante Totalrevision der Tierzuchtverordnung \(TZV\) gefährdet\?/gi, 'Is the conservation of rare farm animal breeds endangered by the planned full revision of the Animal Breeding Ordinance (TZV)?'],
    [/Heim- versus Nutztier bei Equiden\. Wieso diese Sonderregelung und wieso so viel Food Waste\?/gi, 'Companion vs. farm animal status for equines. Why this special rule and why so much food waste?'],
    [/Sucht der Bund nach einer Strategie zur Einschränkung der Tierversuche\?/gi, 'Is the federal government pursuing a strategy to reduce animal testing?'],
    [/Alternativen zu Tierversuchen\. Forschungsstandort Schweiz stärken!/gi, 'Alternatives to animal testing. Strengthen Switzerland as a research location!'],
    [/Tierschutz und neue Schweiz-EU-Abkommen\. Steht das Verbot ritueller Schlachtungen in der Schweiz vor dem Aus\?/gi, 'Animal welfare and new Switzerland–EU agreements. Is Switzerland’s ban on ritual slaughter at risk?'],
    [/«Ja zur tierversuchsfreien Zukunft»/gi, '"Yes to an animal-testing-free future"'],
    [/«Ja zum Importverbot für Stopfleber \(Stopfleber-Initiative\)»/gi, '"Yes to a foie gras import ban (Foie Gras Initiative)"'],
    [/«Ja zum Importverbot für tierquälerisch erzeugte Pelzprodukte \(Pelzinitiative\)»/gi, '"Yes to an import ban on fur products produced with animal cruelty (Fur Initiative)"'],
  ]

  let out = text
  for (const [rx, replacement] of phraseRules) out = out.replace(rx, replacement)

  out = translateContent(out, 'en')
  out = out
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.;!?])/g, '$1')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .trim()

  return out
}

export function localizedMetaText(item: { metadaten?: any }, field: 'title' | 'summary', lang: Language, fallback: string): string {
  const fromMeta = item?.metadaten?.i18n?.[field]?.[lang]
  if (typeof fromMeta === 'string' && fromMeta.trim()) return fromMeta.trim()

  if (lang === 'en') return translateEnBestEffort(fallback)

  return translateContent(fallback, lang)
}

export function localizedMetaType(item: { metadaten?: any; typ: string }, lang: Language): string {
  const fromMeta = item?.metadaten?.i18n?.type?.[lang]
  if (typeof fromMeta === 'string' && fromMeta.trim()) return fromMeta.trim()
  return translateType(item.typ, lang)
}

export function localizedMetaThemes(item: { metadaten?: any; themen: string[] }, lang: Language): string[] {
  const fromMeta = item?.metadaten?.i18n?.themes?.[lang]
  if (Array.isArray(fromMeta) && fromMeta.length) {
    return fromMeta.map((x) => String(x || '').trim()).filter(Boolean)
  }
  return item.themen.map((theme) => translateContent(theme, lang))
}
