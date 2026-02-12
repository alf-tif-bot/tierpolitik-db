export type Language = 'de' | 'fr' | 'it'

export const languageNames: Record<Language, string> = {
  de: 'DE',
  fr: 'FR',
  it: 'IT',
}

export const statusLabels: Record<string, Record<Language, string>> = {
  Eingereicht: { de: 'Eingereicht', fr: 'Déposé', it: 'Presentato' },
  'In Beratung': { de: 'In Beratung', fr: 'En délibération', it: 'In discussione' },
  Angenommen: { de: 'Angenommen', fr: 'Accepté', it: 'Accolto' },
  Abgelehnt: { de: 'Abgelehnt', fr: 'Rejeté', it: 'Respinto' },
  Abgeschrieben: { de: 'Abgeschrieben', fr: 'Classé', it: 'Archiviato' },
  Zurueckgezogen: { de: 'Zurückgezogen', fr: 'Retiré', it: 'Ritirato' },
  Zurückgezogen: { de: 'Zurückgezogen', fr: 'Retiré', it: 'Ritirato' },
}

export type I18nText = {
  title: string
  subtitle: string
  language: string
  results: string
  projectBy: string
  search: string
  searchPlaceholder: string
  level: string
  status: string
  canton: string
  themes: string
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
    results: 'Treffer',
    projectBy: 'Ein Projekt von',
    search: 'Suche',
    searchPlaceholder: 'Titel, Kurzbeschreibung, Geschäftsnummer ...',
    level: 'Ebene',
    status: 'Status',
    canton: 'Kanton',
    themes: 'Themen',
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
    dateSubmitted: 'Datum eingereicht',
    submitters: 'Einreichende',
    copyLink: 'Link kopieren',
    openBusiness: 'Geschäft öffnen',
    timeline: 'Timeline',
    section: { federal: 'Bund', cantonal: 'Kanton', municipal: 'Gemeinde' },
  },
  fr: {
    title: 'Moniteur suisse de politique animale',
    subtitle: 'Les principales interventions parlementaires sur la protection et les droits des animaux.',
    language: 'Langue',
    results: 'Résultats',
    projectBy: 'Un projet de',
    search: 'Recherche',
    searchPlaceholder: 'Titre, description, numéro d’objet ...',
    level: 'Niveau',
    status: 'Statut',
    canton: 'Canton',
    themes: 'Thèmes',
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
    section: { federal: 'Fédéral', cantonal: 'Cantonal', municipal: 'Communal' },
  },
  it: {
    title: 'Monitor svizzero di politica animale',
    subtitle: 'Le principali iniziative parlamentari su protezione e diritti degli animali.',
    language: 'Lingua',
    results: 'Risultati',
    projectBy: 'Un progetto di',
    search: 'Ricerca',
    searchPlaceholder: 'Titolo, descrizione, numero dell’atto ...',
    level: 'Livello',
    status: 'Stato',
    canton: 'Cantone',
    themes: 'Temi',
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
    section: { federal: 'Federale', cantonal: 'Cantonale', municipal: 'Comunale' },
  },
}

export function translateStatus(status: string, lang: Language): string {
  return statusLabels[status]?.[lang] ?? status
}
