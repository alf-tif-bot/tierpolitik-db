import fs from 'node:fs'

const dbPath = new URL('../data/crawler-db.json', import.meta.url)
const outPath = new URL('../public/review.html', import.meta.url)
const outPathIndex = new URL('../public/review/index.html', import.meta.url)
const reviewDataPath = new URL('../data/review-items.json', import.meta.url)
const reviewCandidatesPath = new URL('../data/review-candidates.json', import.meta.url)
const decisionsPath = new URL('../data/review-decisions.json', import.meta.url)
const fastlaneTagsPath = new URL('../data/review-fastlane-tags.json', import.meta.url)
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'))
const localDecisions = fs.existsSync(decisionsPath)
  ? JSON.parse(fs.readFileSync(decisionsPath, 'utf8'))
  : {}
const fastlaneTags = fs.existsSync(fastlaneTagsPath)
  ? JSON.parse(fs.readFileSync(fastlaneTagsPath, 'utf8'))
  : {}

const sourcesConfigPath = new URL('../crawler/config.sources.json', import.meta.url)
const configuredSources = fs.existsSync(sourcesConfigPath)
  ? JSON.parse(fs.readFileSync(sourcesConfigPath, 'utf8'))
  : []

const enabledSourceIds = new Set(((configuredSources.length ? configuredSources : (db.sources || [])) || [])
  .filter((s) => s.enabled !== false)
  .map((s) => s.id))

const DEFAULT_TARGET_SINCE_YEAR = 2016
const TARGET_SINCE_YEAR = Math.max(2000, Number(process.env.REVIEW_TARGET_SINCE_YEAR || DEFAULT_TARGET_SINCE_YEAR))
const REVIEW_INCLUDE_DECIDED = String(process.env.REVIEW_INCLUDE_DECIDED || '').trim() === '1'
const targetSinceTs = Date.UTC(TARGET_SINCE_YEAR, 0, 1, 0, 0, 0)
const isInTargetHorizon = (item) => {
  const iso = item?.publishedAt || item?.fetchedAt
  if (!iso) return false
  const ts = Date.parse(String(iso))
  if (Number.isNaN(ts)) return false
  return ts >= targetSinceTs
}

const isLikelyDeadPlaceholderUrl = (value = '') => {
  try {
    const u = new URL(String(value || '').trim())
    const host = u.hostname.toLowerCase()
    if (!(u.protocol === 'http:' || u.protocol === 'https:')) return true
    if (['example.org', 'example.com', 'example.net', 'localhost', '127.0.0.1'].includes(host)) return true
    return false
  } catch {
    return true
  }
}

const isMunicipalOverviewNoise = (item) => {
  const sid = String(item?.sourceId || '')
  if (!sid.startsWith('ch-municipal-')) return false
  const t = String(item?.title || '').toLowerCase()
  const url = String(item?.meta?.sourceLink || item?.sourceUrl || '').toLowerCase()
  return t.includes('Ã¼bersichtsseite')
    || t.includes('vorstÃ¶sse und grsr-revisionen')
    || t.includes('antworten auf kleine anfragen')
    || t.includes('erste beratung von jugendvorst')
    || /^parlamentsgesch(Ã¤|a)ft\s+municipal-/.test(t)
    || url.includes('vorstoesse-und-grsr-revisionen')
    || url.includes('antworten-auf-kleine-anfragen')
    || url.includes('suche-curia-vista/geschaeft?affairid=municipal')
}

const MUNICIPAL_THEME_STRONG_KEYWORDS = [
  'tier', 'tierschutz', 'tierwohl', 'tierpark', 'tierversuch', 'wildtier', 'haustier',
  'zoo', 'vogel', 'hund', 'katze', 'fisch', 'jagd',
]

const MUNICIPAL_THEME_CONTEXT_KEYWORDS = [
  'biodivers', 'wald', 'siedlungsgebiet', 'landwirtschaftsgebiet', 'feuerwerk', 'lÃ¤rm', 'laerm',
]

const CANTONAL_THEME_STRONG_KEYWORDS = [
  'tier', 'tierschutz', 'tierwohl', 'tierhalteverbot', 'nutztier', 'masthuhn', 'geflÃ¼gel', 'schlacht',
  'tierversuch', '3r', 'wildtier', 'jagd', 'zoo', 'tierpark', 'biodivers', 'artenschutz', 'wolf', 'fuchs',
]

const isCantonalReadableRelevant = (item) => {
  const sid = String(item?.sourceId || '')
  if (!sid.startsWith('ch-cantonal-')) return true
  const title = String(item?.title || '').trim()
  const summary = String(item?.summary || '').trim().toLowerCase()
  const text = `${title}\n${summary}\n${String(item?.body || '')}`.toLowerCase()

  const looksUnreadable =
    /^parlamentsgesch(Ã¤|a)ft\s+/i.test(title)
    || title.toLowerCase().includes('quell-adapter vorbereitet')
    || summary.includes('0 relevante linkziele erkannt')
    || summary.includes('verifying your browser')

  if (looksUnreadable) return false

  // Drop synthetic canton summary rows like "SZ Â· Kantonsrat Schwyz: Jagd und Wildtiere"
  // until we have a concrete parliamentary business attached.
  const looksSyntheticCantonalHeadline = /^[A-Z]{2}(?:\s+|\s*[^\p{L}\p{N}]\s*)Kantonsrat\b.+:\s+.+/iu.test(title)
  const isCantonalSummaryId = /^cantonal-portal-[a-z]{2}$/i.test(String(item?.externalId || ''))
  const sourceLink = String(item?.meta?.sourceLink || '').trim()
  const hasConcreteBusinessRef = Boolean(
    item?.meta?.businessNumber
    || /geschaeftid=|objektid=|affairid=|detail\.php\?gid=/i.test(sourceLink)
  )

  // Keep cantonal summary rows visible during source-fix phase so they can be reviewed and corrected.
  if (looksSyntheticCantonalHeadline && !hasConcreteBusinessRef) return true

  return CANTONAL_THEME_STRONG_KEYWORDS.some((kw) => text.includes(kw))
}

const isMunicipalTopicRelevant = (item) => {
  const sid = String(item?.sourceId || '')
  if (!sid.startsWith('ch-municipal-')) return true
  const decisionKey = `${item?.sourceId || ''}:${item?.externalId || ''}`
  const decisionStatus = String(localDecisions?.[decisionKey]?.status || '').toLowerCase()
  const feedbackQueued = String(item?.reviewReason || '').toLowerCase().includes('user-feedback=irrelevant')
  if (feedbackQueued || decisionStatus === 'queued' || decisionStatus === 'new' || decisionStatus === 'rejected') return true
  const text = `${item?.title || ''}\n${item?.summary || ''}\n${item?.body || ''}`.toLowerCase()
  const strongHits = MUNICIPAL_THEME_STRONG_KEYWORDS.filter((kw) => text.includes(kw)).length
  const contextHits = MUNICIPAL_THEME_CONTEXT_KEYWORDS.filter((kw) => text.includes(kw)).length
  return strongHits > 0 || contextHits >= 2
}

const isReadableReviewText = (item) => {
  const title = String(item?.title || '').trim()
  const summary = String(item?.summary || '').trim()
  if (!title || title.length < 8) return false

  const junkPatterns = [
    /\bparlamentsgesch(Ã¤|a)ft\s+municipal-/i,
    /\bno\s+items\s+found\b/i,
    /\bsource\s+candidate\b/i,
    /\bquell-adapter\b/i,
  ]

  const combined = `${title}\n${summary}`
  if (junkPatterns.some((rx) => rx.test(combined))) return false

  const replacementCount = (combined.match(/ï¿½/g) || []).length
  if (replacementCount >= 3) return false

  return true
}

const normalizeReviewStatus = (item) => String(item?.status || '')

const ANIMAL_HINT_KEYWORDS = Array.from(new Set([
  ...CANTONAL_THEME_STRONG_KEYWORDS,
  ...MUNICIPAL_THEME_STRONG_KEYWORDS,
  'schwein', 'rind', 'kalb', 'huhn', 'pferd', 'pelz', 'stopfleber',
  'biodiversität', 'biodiversite', 'biodiversita',
]))

const normalizeMatchText = (value = '') => String(value || '')
  .replaceAll('A�', 'ü')
  .replaceAll('Ã¼', 'ü')
  .replaceAll('Ã¶', 'ö')
  .replaceAll('Ã¤', 'ä')
  .replaceAll('Ãœ', 'Ü')
  .replaceAll('Ã–', 'Ö')
  .replaceAll('Ã„', 'Ä')
  .replaceAll('â€¦', '…')
  .toLowerCase()

const containsAnimalHint = (value = '') => {
  const low = normalizeMatchText(value)
  return ANIMAL_HINT_KEYWORDS.some((kw) => low.includes(normalizeMatchText(kw)))
}

const hasMeaningfulAnimalRelevance = (item) => {
  const score = Number(item?.score || 0)
  const keywords = Array.isArray(item?.matchedKeywords) ? item.matchedKeywords.filter(Boolean) : []
  const reason = String(item?.reviewReason || '').toLowerCase()
  const text = `${item?.title || ''}\n${item?.summary || ''}\n${item?.body || ''}`.toLowerCase()

  const animalKeywordMatches = keywords.filter((kw) => containsAnimalHint(kw))
  const strongTextHit = containsAnimalHint(text)

  // Primary: explicit animal-like keywords from scorer.
  if (animalKeywordMatches.length > 0) return true

  // Secondary: score-based inclusion unless it is explicitly flagged as unclear/indirect.
  if (score >= 0.18 && !reason.includes('unklaren tierbezug') && !reason.includes('indirekten tierbezug')) return true

  // Fallback: textual hit in title/summary/body.
  if (strongTextHit) return true

  return false
}

const baseReviewItems = [...db.items]
  .filter((item) => enabledSourceIds.has(item.sourceId) || String(item.sourceId || '') === 'user-input')
  .filter((item) => {
    const sid = String(item.sourceId || '')
    return sid.startsWith('ch-parliament-') || sid.startsWith('ch-municipal-') || sid.startsWith('ch-cantonal-') || sid === 'user-input' || sid === 'bundesrat-news'
  })
  .filter((item) => {
    const sid = String(item.sourceId || '')
    if (sid !== 'user-input' && sid !== 'user-feedback') return true
    return !isLikelyDeadPlaceholderUrl(item?.sourceUrl)
  })
  .filter((item) => {
    const s = normalizeReviewStatus(item)
    if (REVIEW_INCLUDE_DECIDED) return ['new', 'queued', 'approved', 'published', 'rejected'].includes(s)
    return s === 'new' || s === 'queued'
  })
  .filter((item) => !isMunicipalOverviewNoise(item))
  .filter((item) => isMunicipalTopicRelevant(item))
  .filter((item) => isCantonalReadableRelevant(item))
  .filter((item) => isReadableReviewText(item))
  .filter((item) => hasMeaningfulAnimalRelevance(item))
  .filter((item) => isInTargetHorizon(item))

const affairKey = (item) => {
  const sid = String(item.sourceId || '')
  const external = String(item.externalId || '')
  if (sid.startsWith('ch-parliament-')) return external.split('-')[0] || `${sid}:${external}`
  return `${sid}:${external}`
}

const isGenericParliamentTitle = (value = '') => {
  const t = clean(value)
  return /^parlamentsgesch(Ã¤|a)ft\s+\d{6,}$/i.test(t)
    || /^affaire\s+parlementaire\s+\d{6,}$/i.test(t)
    || /^affare\s+parlamentare\s+\d{6,}$/i.test(t)
}

const relatedParliamentItems = new Map()
for (const item of (db.items || [])) {
  const sid = String(item?.sourceId || '')
  if (!sid.startsWith('ch-parliament-')) continue
  const key = String(item?.externalId || '').split('-')[0]
  if (!key) continue
  const list = relatedParliamentItems.get(key) || []
  list.push(item)
  relatedParliamentItems.set(key, list)
}

const findReadableParliamentTitle = (item) => {
  const sid = String(item?.sourceId || '')
  if (!sid.startsWith('ch-parliament-')) return ''
  const key = String(item?.externalId || '').split('-')[0]
  const related = relatedParliamentItems.get(key) || []

  const candidate = related
    .filter((x) => !isGenericParliamentTitle(x?.title || ''))
    .sort((a, b) => {
      const aLang = langRank(a)
      const bLang = langRank(b)
      if (aLang !== bLang) return aLang - bLang
      return Number(b?.score || 0) - Number(a?.score || 0)
    })[0]

  return candidate ? clean(candidate.title) : ''
}

const displayTitle = (item) => {
  const current = clean(item?.title || '')
  const sid = String(item?.sourceId || '')

  // For parliament entries, always prefer the best available DE title of the same affair.
  if (sid.startsWith('ch-parliament-')) {
    const dePreferred = findReadableParliamentTitle(item)
    if (dePreferred) return germanizeText(dePreferred)
  }

  const base = !isGenericParliamentTitle(current)
    ? germanizeText(current)
    : germanizeText(findReadableParliamentTitle(item) || current)

  // Municipal Bern entries often include a redundant city prefix in title.
  if (sid === 'ch-municipal-parliament-bern-zurich') {
    return base.replace(/^Bern\s*[·\-–:]\s*/i, '')
  }

  return base
}
const entryKey = (item) => `${item.sourceId}:${item.externalId}`
const decidedEntryKeys = new Set(Object.keys(localDecisions || {}))

const langRank = (item) => {
  const src = String(item.sourceId || '').toLowerCase()
  if (src.endsWith('-de')) return 0
  if (src.endsWith('-fr')) return 1
  if (src.endsWith('-it')) return 2
  return 3
}

const statusRank = (item) => {
  const s = String(normalizeReviewStatus(item) || '')
  if (s === 'published') return 3
  if (s === 'approved') return 2
  if (s === 'queued' || s === 'new') return 1
  return 0
}

const pickPreferredItem = (next, current) => {
  const betterStatus = statusRank(next) > statusRank(current)
  const betterLang = langRank(next) < langRank(current)
  const betterScore = (next.score ?? 0) > (current.score ?? 0)

  if (betterStatus || (!betterStatus && (betterLang || (!betterLang && betterScore)))) {
    return next
  }
  return current
}

const grouped = new Map()
for (const item of baseReviewItems) {
  const key = affairKey(item)
  const prev = grouped.get(key)
  if (!prev) {
    grouped.set(key, item)
    continue
  }
  grouped.set(key, pickPreferredItem(item, prev))
}

const normalizeForKey = (value = '') => String(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()

const extractBusinessNo = (item) => {
  const title = String(item?.title || '').replace(/\s+/g, ' ').trim()
  const fromTitle = title.match(/\b(\d{2}\.\d{2,4})\b/)
  if (fromTitle?.[1]) return fromTitle[1]

  const rawExternal = String(item?.externalId || '').split('-')[0]
  const numericExternal = rawExternal.match(/^(\d{4})(\d{2,4})$/)
  if (numericExternal) {
    const yy = numericExternal[1].slice(2)
    const suffix = String(Number(numericExternal[2]))
    if (suffix && suffix !== 'NaN') return `${yy}.${suffix}`
  }

  return ''
}

const hardDuplicateKey = (item) => {
  const sid = String(item?.sourceId || '')
  if (!sid.startsWith('ch-parliament-')) return `id:${sid}:${item?.externalId || ''}`

  const businessNo = extractBusinessNo(item)
  const normalizedTitle = normalizeForKey(String(item?.title || '').replace(/\b\d{2}\.\d{2,4}\b/g, ''))

  if (businessNo && normalizedTitle) return `hard:${businessNo}|${normalizedTitle}`
  if (businessNo) return `hard:${businessNo}`
  return `id:${sid}:${item?.externalId || ''}`
}

const hardGrouped = new Map()
for (const item of grouped.values()) {
  const key = hardDuplicateKey(item)
  const prev = hardGrouped.get(key)
  if (!prev) {
    hardGrouped.set(key, item)
    continue
  }
  hardGrouped.set(key, pickPreferredItem(item, prev))
}

const isHighConfidenceReview = (item) => {
  const reason = String(item.reviewReason || '').toLowerCase()
  const score = Number(item.score || 0)
  const queued = item.status === 'queued' || item.status === 'new'
  if (!queued) return false
  if (reason.includes('feedback-negative-only') || reason.includes('noise-without-anchor')) return false

  const hasStrongRule = reason.includes('[anchor+score]') || reason.includes('[anchor2+support]') || reason.includes('[feedback-recall]')
  const hasAnchorSignal = /anchor=(?!-)/.test(reason)
  return hasStrongRule && hasAnchorSignal && score >= 0.78
}

const MIN_REVIEW_ITEMS = Math.max(20, Number(process.env.REVIEW_MIN_ITEMS || 20))

const sortReviewItems = (arr) => [...arr].sort((a, b) => {
  const aPending = (a.status === 'queued' || a.status === 'new') ? 1 : 0
  const bPending = (b.status === 'queued' || b.status === 'new') ? 1 : 0
  if (bPending !== aPending) return bPending - aPending

  const aFast = isHighConfidenceReview(a) ? 1 : 0
  const bFast = isHighConfidenceReview(b) ? 1 : 0
  if (bFast !== aFast) return bFast - aFast

  const scoreDelta = Number(b.score || 0) - Number(a.score || 0)
  if (Math.abs(scoreDelta) > 0.0001) return scoreDelta

  const aTs = Date.parse(String(a.publishedAt || a.fetchedAt || '')) || 0
  const bTs = Date.parse(String(b.publishedAt || b.fetchedAt || '')) || 0
  return bTs - aTs
})

let reviewItems = sortReviewItems([...hardGrouped.values()])

if (reviewItems.length < MIN_REVIEW_ITEMS) {
  const existingKeys = new Set(reviewItems.map((item) => affairKey(item)))
  const fallbackPool = db.items
    .filter((item) => enabledSourceIds.has(item.sourceId) || String(item.sourceId || '') === 'user-input' || String(item.sourceId || '') === 'bundesrat-news')
    .filter((item) => {
      const sid = String(item.sourceId || '')
      return sid.startsWith('ch-parliament-') || sid.startsWith('ch-municipal-') || sid.startsWith('ch-cantonal-') || sid === 'user-input' || sid === 'bundesrat-news'
    })
    .filter((item) => {
      const s = normalizeReviewStatus(item)
      return s === 'new' || s === 'queued'
    })
    .filter((item) => isInTargetHorizon(item))
    .filter((item) => isReadableReviewText(item))
    .filter((item) => {
      const score = Number(item?.score || 0)
      const reason = String(item?.reviewReason || '').toLowerCase()
      if (score >= 0.12) return true
      if (reason.includes('anchor+score') || reason.includes('anchor2+support') || reason.includes('whitelist+theme')) return true
      if (containsAnimalHint(`${item?.title || ''} ${item?.summary || ''} ${(item?.matchedKeywords || []).join(' ')}`)) return true
      return false
    })
  const fillers = []
  for (const item of sortReviewItems(fallbackPool)) {
    const key = affairKey(item)
    if (existingKeys.has(key)) continue
    existingKeys.add(key)
    fillers.push(item)
    if (reviewItems.length + fillers.length >= MIN_REVIEW_ITEMS) break
  }

  reviewItems = sortReviewItems([...reviewItems, ...fillers])
}

const sourceMap = new Map((db.sources || []).map((s) => [s.id, s.label]))

const esc = (v = '') => String(v).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
// Status-Summen werden clientseitig aus den aktuell sichtbaren Zeilen berechnet.

const isValidHttpUrl = (value = '') => {
  try {
    const u = new URL(value)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

const isLikelyOverviewUrl = (value = '') => {
  const low = String(value || '').toLowerCase()
  return /\/($|index\.|start|home|news|aktuelles|geschaefte$|objets$|seances$)/i.test(low)
    || low.includes('vorstoesse-und-grsr-revisionen')
    || low.includes('antworten-auf-kleine-anfragen')
}

const scoreOriginalUrl = (value = '', sourceId = '') => {
  const low = String(value || '').toLowerCase()
  let score = 0

  if (/affairid=\d+/.test(low)) score += 8
  if (/detail\.php\?gid=[a-f0-9]+/i.test(low)) score += 8
  if (/\/gast\/geschaefte\/\d+/.test(low)) score += 10
  if (/dettaglio\?[^\s]*attid%5d=\d+/.test(low)) score += 10
  if (/\b(geschaefte|geschaeft|objets?|traktanden|vorstoesse|ratsbetrieb|deliberation)\b/.test(low)) score += 4
  if (/\b(id|nummer|nr|objektid|geschaeftid|affairid)=/.test(low)) score += 3
  if (isLikelyOverviewUrl(low)) score -= 6

  if (/kantonsrat\/(geschaefte|traktanden)/.test(low)) score += 5
  if (/landrat\/geschaefte/.test(low)) score += 6
  if (/\/landratmain\b/.test(low)) score += 4
  if (/\/landrat\b/.test(low) && !/\/landratmain\b/.test(low)) score -= 6

  // Uri currently serves Landrat content via /sitzung; /landrat/geschaefte is invalid.
  if (/ur\.ch\/landrat\/geschaefte/.test(low)) score -= 12
  if (/ur\.ch\/sitzung/.test(low)) score += 8
  if (/gemeinderat|stadtrat/.test(low) && /geschaefte|detail|objets?\//.test(low)) score += 3

  // Penalize topical department pages that are not parliamentary business detail pages
  if (/amt-fuer|verwaltung\//.test(low) && !/kantonsrat|parlament|gemeinderat|stadtrat|landrat/.test(low)) score -= 5

  if (String(sourceId || '').startsWith('ch-municipal-') && /detail|objets?\//.test(low)) score += 2
  if (String(sourceId || '').startsWith('ch-cantonal-') && /geschaefte|objets?|traktanden/.test(low)) score += 2

  return score
}

const pickMetaExtractedUrl = (item) => {
  const links = Array.isArray(item?.meta?.extractedLinks) ? item.meta.extractedLinks : []
  const candidates = links
    .map((l) => String(l?.href || '').trim())
    .filter((u) => isValidHttpUrl(u) && !isLikelyDeadPlaceholderUrl(u))
  if (!candidates.length) return ''

  return [...candidates]
    .sort((a, b) => scoreOriginalUrl(b, item?.sourceId) - scoreOriginalUrl(a, item?.sourceId))[0] || ''
}

const extractBodyUrlCandidates = (item) => {
  const body = String(item?.body || '')
  if (!body) return []

  const out = []
  for (const line of body.split(/\r?\n/)) {
    const m = line.match(/^(?:\d+\.\s*)?(.*?)\s+[–-]\s+(https?:\/\/\S+)$/u)
    if (!m) continue
    const label = clean(m[1] || '').toLowerCase()
    const url = String(m[2] || '').trim().replace(/[),.;]+$/, '')
    if (!isValidHttpUrl(url) || isLikelyDeadPlaceholderUrl(url)) continue

    let bonus = 0
    if (/geschaeft|geschäfte|objets?|traktanden|landrat.*geschaeft|ricerca.*atti|ratsbetrieb|parlament/i.test(label)) bonus += 5
    if (/motion|postulat|interpellation/i.test(label)) bonus += 4
    if (/jagd|chasse|wildtier|faune|animaux de compagnie|peche/i.test(label)) bonus -= 4

    out.push({ url, bonus })
  }
  return out
}

const resolveOriginalUrl = (item) => {
  const sid = String(item?.sourceId || '')
  const externalId = String(item?.externalId || '')

  if (sid === 'ch-municipal-parliament-bern-zurich' && externalId.startsWith('municipal-bern-api-')) {
    const gid = externalId.replace('municipal-bern-api-', '').trim()
    if (/^[a-f0-9]{24,}$/i.test(gid)) {
      return `https://stadtrat.bern.ch/de/geschaefte/detail.php?gid=${gid}`
    }
  }

  const direct = String(item?.sourceUrl || '')
  const metaLink = String(item?.meta?.sourceLink || item?.meta?.url || '')
  const metaExtracted = pickMetaExtractedUrl(item)
  const bodyUrls = extractBodyUrlCandidates(item)

  const candidates = [
    { url: direct, bonus: 0 },
    { url: metaLink, bonus: 0 },
    { url: metaExtracted, bonus: 0 },
    ...bodyUrls,
  ].filter((c) => isValidHttpUrl(c.url) && !isLikelyDeadPlaceholderUrl(c.url))

  if (candidates.length) {
    const best = [...new Map(candidates.map((c) => [c.url, c])).values()]
      .sort((a, b) => (scoreOriginalUrl(b.url, item?.sourceId) + b.bonus) - (scoreOriginalUrl(a.url, item?.sourceId) + a.bonus))[0]
    if (best?.url) return best.url
  }

  if (item.sourceId?.startsWith('ch-parliament-business-')) {
    const affairId = String(item.externalId || '').split('-')[0]
    if (/^\d+$/.test(affairId)) {
      return `https://www.parlament.ch/de/ratsbetrieb/suche-curia-vista/geschaeft?AffairId=${affairId}`
    }
  }

  return ''
}

const isConcreteCantonalDetailUrl = (url = '') => {
  const low = String(url || '').toLowerCase()
  return /[?&](affairid|geschaeftid|objektid|objectid|id)=\d+/.test(low)
    || /detail\.php\?gid=[a-f0-9]+/.test(low)
    || /\/gast\/geschaefte\/\d+/.test(low)
    || /dettaglio\?[^\s]*attid%5d=\d+/.test(low)
}

const needsCantonalSourceFix = (item) => {
  const sid = String(item?.sourceId || '')
  if (!sid.startsWith('ch-cantonal-')) return false
  if (item?.meta?.needsSourceFix === true) return true
  const resolved = resolveOriginalUrl(item)
  return !isConcreteCantonalDetailUrl(resolved)
}

const normalizeBrokenGerman = (text = '') => String(text || '')
  .replaceAll('Aï¿½', ' · ')
  .replaceAll('Â·', '·')
  .replaceAll('ÃƒÂ¼', 'ü')
  .replaceAll('ÃƒÂ¶', 'ö')
  .replaceAll('ÃƒÂ¤', 'ä')
  .replaceAll('ÃƒÅ“', 'Ü')
  .replaceAll('Ãƒâ€“', 'Ö')
  .replaceAll('Ãƒâ€ž', 'Ä')
  .replaceAll('Ã¢â‚¬Â¦', '…')
  .replaceAll('Ã¢Ëœâ€ ', '☆')
  .replaceAll('Ã¢Ëœâ€¦', '⭐')
  .replaceAll('Ã¢Å¡Â¡', '⚡')
  .replaceAll('Ã¼', 'ü')
  .replaceAll('Ã¶', 'ö')
  .replaceAll('Ã¤', 'ä')
  .replaceAll('Ãœ', 'Ü')
  .replaceAll('Ã–', 'Ö')
  .replaceAll('Ã„', 'Ä')
  .replace(/\bParlamentsgeschAft\b/g, 'Parlamentsgeschäft')
  .replace(/\bGeschAfte\b/g, 'Geschäfte')
  .replace(/\bGeschAft\b/g, 'Geschäft')
  .replace(/\bEintrAge\b/g, 'Einträge')
  .replace(/\bkAnnen\b/g, 'können')
  .replace(/\bstandardmAssig\b/g, 'standardmässig')
  .replace(/\bAffnen\b/g, 'Öffnen')
  .replace(/\bPrioritAt\b/g, 'Priorität')
  .replace(/\bfAï¿½r\b/g, 'für')
  .replace(/\bBiodiversitAt\b/g, 'Biodiversität')
  .replace(/\bLebensrAume\b/g, 'Lebensräume')
  .replace(/\bLebensraumfArderung\b/g, 'Lebensraumförderung')
  .replace(/\bErnAhrung\b/g, 'Ernährung')

const decodeMojibakeRaw = (value = '') => {
  let out = String(value || '')
  if (/[ÃƒÃ‚Ã¢]/.test(out)) {
    try {
      const decoded = Buffer.from(out, 'latin1').toString('utf8')
      if (decoded && /[Ã¤Ã¶Ã¼Ã„Ã–ÃœÃ©Ã¨Ã Ã§â€¦â€“â€”]/.test(decoded)) out = decoded
    } catch {
      // keep original
    }
  }
  return normalizeBrokenGerman(out)
}

const repairMojibake = (value = '') => decodeMojibakeRaw(value)
  .replaceAll('ï¿½', '')
  .replace(/\s+/g, ' ')
  .trim()

const clean = (v = '') => repairMojibake(v)

const germanizeText = (v = '') => {
  const out = clean(v)
  return out
    .replace(/\bGran Consiglio\b/gi, 'Grosser Rat')
    .replace(/\bRicerca messaggi e atti\b/gi, 'Suche Mitteilungen und Akten')
    .replace(/\bRisultati\b/gi, 'Ergebnisse')
    .replace(/\bInterpellanza\b/gi, 'Interpellation')
    .replace(/\bInterrogazione\b/gi, 'Anfrage')
    .replace(/\bcaccia\b/gi, 'Jagd')
    .replace(/\bagricoltura\b/gi, 'Landwirtschaft')
}

const isGenericStatusSummary = (text = '') => {
  const low = clean(text).toLowerCase()
  return (
    low.includes('stellungnahme zum vorstoss liegt vor')
    || low.includes('beratung in kommission')
    || low.includes('erledigt')
    || low.includes('fin des discussions en commission')
    || /^parlamentsgesch(Ã¤|a)ft\s+\d{6,}$/i.test(low)
    || /^affaire\s+parlementaire\s+\d{6,}$/i.test(low)
    || /^affare\s+parlamentare\s+\d{6,}$/i.test(low)
  )
}

const summarizeForReview = (item) => {
  const title = displayTitle(item)
  const summary = clean(item.summary)
  const reason = String(item.reviewReason || '')

  const stance = (reason.match(/stance=([^Â·]+)/)?.[1] || 'neutral/unklar').trim()
  const anchor = (reason.match(/anchor=([^Â·]+)/)?.[1] || '').trim().replaceAll('|', ', ')
  const support = (reason.match(/support=([^Â·]+)/)?.[1] || '').trim().replaceAll('|', ', ')

  if (summary && !isGenericStatusSummary(summary)) return summary

  const topicHint = anchor && anchor !== '-' ? anchor : support && support !== '-' ? support : 'allgemeine Tierpolitik'
  const stanceLabel = stance === 'pro-tierschutz'
    ? 'stellt eher einen positiven Bezug zum Tierschutz her'
    : stance === 'tierschutzkritisch'
      ? 'kann aus Tierschutzsicht kritisch sein'
      : 'hat einen indirekten bzw. unklaren Tierbezug'

  return `Kurzfassung: Das GeschÃ¤ft behandelt ${topicHint}. Einordnung: Es ${stanceLabel}.`
}

const humanizeReason = (reason = '') => {
  if (!reason) return '-'
  const text = clean(reason)

  if (/review-entscheid\s*\(approved\)/i.test(text)) return '<div><strong>Review-Entscheid:</strong> gutgeheissen</div>'
  if (/review-entscheid\s*\(rejected\)/i.test(text)) return '<div><strong>Review-Entscheid:</strong> abgelehnt</div>'

  const rule = (text.match(/\[(.*?)\]/)?.[1] || '').trim()
  const score = (text.match(/score=([0-9.]+)/)?.[1] || '').trim()
  const stance = (text.match(/stance=([^Â·]+)/)?.[1] || '').trim()
  const anchor = (text.match(/anchor=([^Â·]+)/)?.[1] || '').trim()
  const support = (text.match(/support=([^Â·]+)/)?.[1] || '').trim()
  const people = (text.match(/people=([^Â·]+)/)?.[1] || '').trim()
  const noise = (text.match(/noise=([^Â·]+)/)?.[1] || '').trim()

  const ruleMap = {
    'anchor+score': 'Klare Tier-Relevanz (SchlÃ¼sselbegriffe + Score erfÃ¼llt)',
    'anchor2+support': 'Mehrere starke Tier-Begriffe mit zusÃ¤tzlichem Kontext',
    'whitelist+theme': 'Thematisch relevant und von priorisiertem Parlamentsprofil',
    'missing-anchor': 'Keine klaren Tier-SchlÃ¼sselbegriffe gefunden',
    'below-threshold': 'Tierbezug vorhanden, aber Relevanz aktuell zu schwach',
  }

  const toList = (v) => v && v !== '-' ? v.split('|').map((x) => clean(x)).filter(Boolean) : []
  const anchorList = toList(anchor)
  const supportList = toList(support).filter((x) => !anchorList.includes(x))
  const peopleList = toList(people)

  const stanceMap = {
    'pro-tierschutz': 'pro Tierschutz',
    'tierschutzkritisch': 'tierschutzkritisch',
    'neutral/unklar': 'neutral / unklar',
  }

  const parts = []
  if (stance) parts.push(`<div><strong>Einordnung:</strong> ${esc(stanceMap[stance] || stance)}</div>`)
  if (rule) parts.push(`<div><strong>Bewertung:</strong> ${esc(ruleMap[rule] || rule)}</div>`)
  if (anchorList.length) parts.push(`<div><strong>Tier-Begriffe:</strong> ${esc(anchorList.join(', '))}</div>`)
  if (supportList.length) parts.push(`<div><strong>Kontext:</strong> ${esc(supportList.join(', '))}</div>`)
  if (peopleList.length) parts.push(`<div><strong>Priorisierte Profile:</strong> ${esc(peopleList.join(', '))}</div>`)
  if (noise && noise !== '-') parts.push(`<div><strong>StÃ¶rsignale:</strong> ${esc(noise.replaceAll('|', ', '))}</div>`)
  if (score) parts.push(`<div><strong>Score:</strong> ${esc(score)}</div>`)

  return parts.length ? parts.join('') : esc(text)
}

// Keep cantonal entries visible for active correction work; do not hard-hide them.
// We improve link resolution iteratively instead of shrinking the review surface.

const cantonalSourceFixItems = reviewItems.filter((item) => needsCantonalSourceFix(item))
reviewItems = reviewItems.filter((item) => !needsCantonalSourceFix(item))

const sourceFixByCanton = cantonalSourceFixItems.reduce((acc, item) => {
  const canton = String(item?.meta?.canton || '').toUpperCase() || '??'
  acc[canton] = (acc[canton] || 0) + 1
  return acc
}, {})

const fastLaneItems = reviewItems.filter((item) => {
  if (!isHighConfidenceReview(item)) return false
  if (decidedEntryKeys.has(entryKey(item))) return false
  return true
})

const fastLaneRows = fastLaneItems.map((item) => {
  const id = `${item.sourceId}:${item.externalId}`
  const scoreValue = Number(item.score || 0)
  const isTaggedFastlane = Boolean(fastlaneTags[id]?.fastlane)
  const title = displayTitle(item)
  return `<div class="fastlane-card" data-id="${esc(id)}" data-fastlane-tagged="${isTaggedFastlane ? '1' : '0'}">
    <div class="fastlane-head">
      <strong>${esc(title)}</strong>
      <span class="fastlane-score">${scoreValue.toFixed(2)}</span>
    </div>
    <div class="fastlane-actions">
      <button onclick="setDecision(this,'${esc(id)}','approved')">Gutheissen</button>
      <button onclick="setDecision(this,'${esc(id)}','rejected')">Ablehnen</button>
      <button class="tag-btn" data-tag-btn="${esc(id)}" onclick="toggleFastlaneTag(this,'${esc(id)}')">${isTaggedFastlane ? 'Fastlane: AN' : 'Fastlane: AUS'}</button>
      <a class="orig-link" href="${esc(resolveOriginalUrl(item) || '#')}" target="_blank" rel="noopener noreferrer">Original</a>
    </div>
  </div>`
}).join('')

const reviewStatusLabel = (status = '') => {
  const s = String(status || '').toLowerCase()
  if (s === 'queued' || s === 'new') return 'offen'
  if (s === 'approved') return 'gutgeheissen'
  if (s === 'published') return 'publiziert'
  if (s === 'rejected') return 'abgelehnt'
  return s || '-'
}

const fastLaneIdSet = new Set(fastLaneItems.map((item) => `${item.sourceId}:${item.externalId}`))

const rows = reviewItems
  .filter((item) => !fastLaneIdSet.has(`${item.sourceId}:${item.externalId}`))
  .map((item) => {
  const fastLane = isHighConfidenceReview(item)
  const id = `${item.sourceId}:${item.externalId}`
  const displayStatus = normalizeReviewStatus(item)
  const statusLabel = reviewStatusLabel(displayStatus)
  const isPending = displayStatus === 'queued' || displayStatus === 'new'
  const pendingBadge = isPending ? '<strong class="pending">offen</strong>' : '<span class="historic">historisch</span>'
  const sourceLabel = esc(clean(sourceMap.get(item.sourceId) || item.sourceId))
  const entryType = item.sourceId === 'user-input' || item.sourceId === 'user-feedback' ? 'User-Feedback' : 'Crawler'
  const scoreValue = Number(item.score || 0)
  const title = displayTitle(item)
  const summary = germanizeText(summarizeForReview(item))
  const keywords = (item.matchedKeywords || []).map((k) => germanizeText(k)).filter(Boolean)
  const priorityLabel = fastLane ? 'fast-lane' : (scoreValue >= 0.8 ? 'hoch' : scoreValue >= 0.55 ? 'mittel' : 'niedriger')
  const sourceUrl = resolveOriginalUrl(item)
  const isTaggedFastlane = Boolean(fastlaneTags[id]?.fastlane)
  const originalLink = sourceUrl
    ? `<a class="orig-link" href="${esc(sourceUrl)}" target="_blank" rel="noopener noreferrer">Original-Vorstoss Ã¶ffnen</a>`
    : '<span class="muted">kein gÃ¼ltiger Link</span>'

  return `
<tr data-id="${esc(id)}" data-status="${esc(displayStatus)}" data-fastlane-tagged="${isTaggedFastlane ? '1' : '0'}" class="${fastLane ? 'row-fastlane' : ''}">
<td>
  <strong>${esc(title)}</strong><br>
  <small>${esc(summary)}</small><br>
  ${originalLink}
</td>
<td>${entryType}</td>
<td>
  <div>${sourceLabel}</div>
  <small class="muted">${esc(item.sourceId)}</small>
</td>
<td>${scoreValue.toFixed(2)}<br><small class="muted">PrioritÃ¤t: ${priorityLabel}</small>${fastLane ? '<br><small class="fast-lane">âš¡ Sehr wahrscheinlich relevant</small>' : ''}${isTaggedFastlane ? '<br><small class="fast-lane">â­ von dir als Fastlane markiert</small>' : ''}</td>
<td>${esc(keywords.join(', '))}</td>
<td><span data-status-label>${esc(statusLabel)}</span> (<span data-status-badge>${pendingBadge}</span>)</td>
<td><small>${humanizeReason(item.reviewReason || '-')}</small></td>
<td>
<button onclick="setDecision(this,'${esc(id)}','approved')">Gutheissen</button>
<button onclick="setDecision(this,'${esc(id)}','rejected')">Ablehnen</button>
<button class="tag-btn" data-tag-btn="${esc(id)}" onclick="toggleFastlaneTag(this,'${esc(id)}')">${isTaggedFastlane ? 'Fastlane: AN' : 'Fastlane: AUS'}</button>
</td>
</tr>`
}).join('')

const html = `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Crawler Review</title>
<style>
  body{font-family:Inter,Arial,sans-serif;background:#0f172a;color:#e2e8f0;margin:0;padding:24px}
  .wrap{max-width:1280px;margin:0 auto}
  h1{margin:0 0 8px}
  p{color:#a9bfd8}
  code{background:#1f2937;border:1px solid #334155;color:#dbeafe;padding:1px 5px;border-radius:6px}
  .links{display:flex;gap:8px;flex-wrap:wrap;margin:14px 0}
  .links a{display:inline-block;border:1px solid rgba(255,255,255,.18);padding:6px 10px;border-radius:999px;text-decoration:none;color:#dbeafe}
  .status{margin:10px 0 14px;color:#bfdbfe}
  button{margin-right:6px;border:1px solid #4b5563;border-radius:8px;padding:5px 9px;background:#22364f;color:#e8effa;cursor:pointer}
  button:hover{background:#2b4565}
  .export{margin:10px 0 12px}
  .view-controls{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
  .view-label{font-size:12px;color:#94a3b8;font-weight:700;letter-spacing:.02em;text-transform:uppercase}
  .view-btn{opacity:.78}
  .view-btn.active{opacity:1;border-color:#93c5fd;background:#2b4565;box-shadow:0 0 0 1px rgba(147,197,253,.25) inset}
  table{width:100%;border-collapse:collapse;background:#111827;border:1px solid #334155;border-radius:12px;overflow:hidden}
  td,th{border-bottom:1px solid #1f2937;padding:10px;vertical-align:top;text-align:left}
  th{background:#1b2433;color:#dbeafe;font-weight:700;position:sticky;top:0}
  tr:hover td{background:#172133}
  .orig-link{display:inline-block;margin-top:6px;color:#93c5fd}
  .muted{color:#94a3b8}
  .pending{color:#f59e0b}
  .historic{color:#94a3b8}
  .fast-lane{color:#fbbf24;font-weight:700}
  .row-fastlane td{background:rgba(251,191,36,.08)}
  .fastlane-wrap{margin:12px 0 16px;padding:12px;border:1px solid #475569;border-radius:10px;background:#111827}
  .fastlane-wrap h2{font-size:16px;margin:0 0 10px;color:#fde68a}
  .fastlane-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:10px}
  .fastlane-card{border:1px solid #334155;border-radius:10px;padding:10px;background:#0b1220}
  .fastlane-head{display:flex;justify-content:space-between;gap:8px;align-items:flex-start}
  .fastlane-score{font-weight:700;color:#fde68a}
  .fastlane-actions{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:8px}
  @media (max-width: 760px){
    body{padding:12px}
    td,th{padding:8px;font-size:13px}
    .fastlane-wrap{position:sticky;top:0;z-index:5}
  }
</style>
</head>
<body>
  <main class="wrap">
    <h1>Review-Ansicht</h1>
    <p>Es werden standardmÃ¤ssig nur <strong>offene</strong> relevante EintrÃ¤ge gezeigt (queued/new). Bereits bearbeitete EintrÃ¤ge bleiben ausgeblendet und kÃ¶nnen bei Bedarf Ã¼ber den Button eingeblendet werden. Wenn ein Vorstoss in mehreren Sprachen vorliegt, wird bevorzugt die <strong>deutsche Version</strong> angezeigt. Approve/Reject blendet den Eintrag sofort aus; mit <strong>Entscheidungen exportieren</strong> + <code>npm run crawler:apply-review</code> wird es in JSON/DB Ã¼bernommen.</p>
    <p class="status" id="status-summary">Status-Summen (sichtbar): offen=0, gutgeheissen=0, publiziert=0</p>
    <nav class="links"><a href="/">Zur App</a><a href="/user-input.html">User-Input</a></nav>
    <p class="export view-controls"><span class="view-label">Ansicht</span><button class="view-btn" onclick="setViewMode('open')" id="view-open">Offen</button> <button class="view-btn" onclick="setViewMode('rejected')" id="view-rejected">Abgelehnt (neu → alt)</button> <button class="view-btn" onclick="clearLocalReviewState()" id="view-reset">Lokale Entscheide löschen</button></p>
    <p id="decision-status" class="muted" aria-live="polite"></p>
    ${fastLaneRows ? `<section class="fastlane-wrap">
      <h2>âš¡ Fast-Lane</h2>
      <div class="fastlane-grid">${fastLaneRows}</div>
    </section>` : ''}
    <table>
      <thead>
        <tr>
          <th>Titel</th>
          <th>Typ</th>
          <th>Quelle</th>
          <th>Score</th>
          <th>Treffer</th>
          <th>Status</th>
          <th>Warum relevant / nicht</th>
          <th>Aktion</th>
        </tr>
      </thead>
      <tbody>${rows || '<tr><td colspan="8">Keine EintrÃ¤ge.</td></tr>'}</tbody>
    </table>
  </main>
<script>
const key='tierpolitik.review';
const uiKey='tierpolitik.review.ui';
const fastlaneTagKey='tierpolitik.review.fastlaneTags';
const initialFastlaneTags=${JSON.stringify(fastlaneTags)};
const lsGet=(k)=>{ try { return localStorage.getItem(k); } catch { return null; } };
const lsSet=(k,v)=>{ try { localStorage.setItem(k,v); } catch {} };
const DEFAULT_API_BASE = (location.hostname === 'monitor.tierimfokus.ch')
  ? 'https://tierpolitik.netlify.app/.netlify/functions'
  : '';
const API_BASE=(lsGet('tierpolitik.apiBase')||DEFAULT_API_BASE).replace(/\\/$/,'');
const DEBUG_REVIEW = /(?:\?|&)debug=1(?:&|$)/.test(location.search);
const dbg = (...args) => { if (DEBUG_REVIEW) console.log('[review-debug]', ...args); };
window.__reviewDebug = {
  hostname: location.hostname,
  storedApiBase: lsGet('tierpolitik.apiBase'),
  defaultApiBase: DEFAULT_API_BASE,
  effectiveApiBase: API_BASE,
};
dbg('boot', window.__reviewDebug);
const safeJsonParse=(raw, fallback={})=>{
  try { return JSON.parse(raw || JSON.stringify(fallback)); }
  catch { return fallback; }
};
const read=()=>safeJsonParse(lsGet(key),{});
const write=(v)=>lsSet(key,JSON.stringify(v,null,2));
const readFastlaneTags=()=>{
  const local = safeJsonParse(lsGet(fastlaneTagKey),{});
  return { ...initialFastlaneTags, ...local };
};
const writeFastlaneTags=(v)=>lsSet(fastlaneTagKey,JSON.stringify(v));
const readUi=()=>safeJsonParse(lsGet(uiKey),{});
const writeUi=(v)=>lsSet(uiKey,JSON.stringify(v));

const statusLabelFor = (status = '') => {
  const s = String(status || '').toLowerCase()
  if (s === 'queued' || s === 'new') return 'offen'
  if (s === 'approved') return 'gutgeheissen'
  if (s === 'published') return 'publiziert'
  if (s === 'rejected') return 'abgelehnt'
  return s || '-'
}
// Backward-compat alias for older handlers that may still call this name.
const reviewStatusLabel = statusLabelFor

let viewMode = 'open';

document.querySelectorAll('tr[data-id]').forEach((row, idx) => {
  row.setAttribute('data-base-order', String(idx))
});

function updateStatusSummary(){
  const stats = { offen: 0, gutgeheissen: 0, publiziert: 0 }
  let visibleRows = 0
  document.querySelectorAll('tr[data-id]').forEach((row)=>{
    const hidden = row.style.display === 'none'
    if (hidden) return
    visibleRows += 1
    const status = String(row.getAttribute('data-status') || '').toLowerCase()
    if (status === 'queued' || status === 'new') stats.offen += 1
    else if (status === 'approved') stats.gutgeheissen += 1
    else if (status === 'published') stats.publiziert += 1
  })
  const el = document.getElementById('status-summary')
  if (el) {
    el.textContent = 'Status-Summen (sichtbar): offen=' + stats.offen + ', gutgeheissen=' + stats.gutgeheissen + ', publiziert=' + stats.publiziert
    if (visibleRows === 0) el.textContent += ' · keine offenen Einträge'
  }
}

function hideDecidedRows(){
  const decisions = read();
  const rows = [...document.querySelectorAll('tr[data-id]')]
  const decidedById = {}

  const localAffairDecided = new Set(Object.keys(decisions)
    .filter((id) => String(id).startsWith('ch-parliament-'))
    .map((id) => {
      const external = String(id).split(':')[1] || ''
      return String(external).split('-')[0]
    })
    .filter(Boolean))

  rows.forEach((row)=>{
    const id = row.getAttribute('data-id');
    if (!id) return
    const rowStatus = String(row.getAttribute('data-status') || '').toLowerCase()
    const localStatus = String(decisions[id]?.status || '').toLowerCase()
    const effectiveStatus = localStatus || rowStatus

    const serverDecided = rowStatus !== 'queued' && rowStatus !== 'new'
    const localDecided = Boolean(decisions[id])
    const isParliamentEntry = String(id).startsWith('ch-parliament-')
    const affairId = isParliamentEntry ? (String(id).split(':')[1] || '').split('-')[0] : ''
    const localAffairHit = Boolean(affairId) && localAffairDecided.has(affairId)
    const decided = serverDecided || localDecided || localAffairHit
    decidedById[id] = decided

    if (localStatus) {
      row.setAttribute('data-status', localStatus)
    }

    const statusLabelEl = row.querySelector('[data-status-label]')
    const statusBadgeEl = row.querySelector('[data-status-badge]')
    if (statusLabelEl) statusLabelEl.textContent = statusLabelFor(effectiveStatus)
    if (statusBadgeEl) {
      statusBadgeEl.innerHTML = (effectiveStatus === 'queued' || effectiveStatus === 'new')
        ? '<strong class="pending">offen</strong>'
        : '<span class="historic">historisch</span>'
    }

    if (viewMode === 'rejected') {
      const isRejected = effectiveStatus === 'rejected'
      row.style.display = isRejected ? '' : 'none'
    } else {
      const isOpen = effectiveStatus === 'queued' || effectiveStatus === 'new'
      row.style.display = isOpen ? '' : 'none'
    }
  });

  const tbody = rows[0]?.parentElement
  if (tbody) {
    if (viewMode === 'rejected') {
      rows
        .filter((row) => row.style.display !== 'none')
        .sort((a, b) => {
          const aId = a.getAttribute('data-id') || ''
          const bId = b.getAttribute('data-id') || ''
          const aTs = Date.parse(String(decisions[aId]?.decidedAt || '')) || 0
          const bTs = Date.parse(String(decisions[bId]?.decidedAt || '')) || 0
          if (bTs !== aTs) return bTs - aTs
          return Number(a.getAttribute('data-base-order') || 0) - Number(b.getAttribute('data-base-order') || 0)
        })
        .forEach((row) => tbody.appendChild(row))
    } else {
      rows
        .sort((a, b) => Number(a.getAttribute('data-base-order') || 0) - Number(b.getAttribute('data-base-order') || 0))
        .forEach((row) => tbody.appendChild(row))
    }
  }

  document.querySelectorAll('.fastlane-card[data-id]').forEach((card)=>{
    const id = card.getAttribute('data-id')
    if (!id) return
    const decided = Boolean(decidedById[id]) || Boolean(decisions[id])
    card.style.display = (viewMode === 'rejected' || decided) ? 'none' : ''
  })

  const openBtn = document.getElementById('view-open')
  const rejectedBtn = document.getElementById('view-rejected')
  if (openBtn) openBtn.classList.toggle('active', viewMode === 'open')
  if (rejectedBtn) rejectedBtn.classList.toggle('active', viewMode === 'rejected')

  updateStatusSummary();
}

window.setViewMode = function setViewMode(mode){
  viewMode = mode === 'rejected' ? 'rejected' : 'open'
  hideDecidedRows()
}

window.clearLocalReviewState = function clearLocalReviewState(){
  lsSet(key, JSON.stringify({}))
  viewMode = 'open'
  const statusEl = document.getElementById('decision-status')
  if (statusEl) statusEl.textContent = 'Lokale Entscheidungen gelöscht.'
  hideDecidedRows()
}

function renderFastlaneTagButton(id){
  const tags = readFastlaneTags();
  const isTagged = Boolean(tags[id]?.fastlane);
  document.querySelectorAll('[data-tag-btn="' + id + '"]').forEach((btn)=>{
    btn.textContent = isTagged ? 'Fastlane: AN' : 'Fastlane: AUS';
  });
}

window.toggleFastlaneTag = async function toggleFastlaneTag(btn,id){
  const tags = readFastlaneTags();
  const next = !Boolean(tags[id]?.fastlane);
  const taggedAt = new Date().toISOString();
  if (btn) btn.disabled = true;

  let serverOk = false;
  if (API_BASE) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const url = API_BASE + '/review-fastlane-tag';
      dbg('fastlane:request', { id, next, url });
      const res = await fetch(url, {
        method:'POST',
        headers:{'content-type':'application/json'},
        body: JSON.stringify({ id, fastlane: next, taggedAt }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      dbg('fastlane:response', { id, next, code: res.status, ok: res.ok });
      if (res.ok) serverOk = true;
    } catch (err) {
      dbg('fastlane:error', { id, next, message: String(err?.message || err) });
    }
  } else {
    dbg('fastlane:skip-no-api-base', { id, next });
  }

  tags[id] = { fastlane: next, taggedAt };
  writeFastlaneTags(tags);
  renderFastlaneTagButton(id);

  document.querySelectorAll('tr[data-id="' + id + '"]').forEach((row)=>{
    row.setAttribute('data-fastlane-tagged', next ? '1' : '0');
  })
  document.querySelectorAll('.fastlane-card[data-id="' + id + '"]').forEach((card)=>{
    card.setAttribute('data-fastlane-tagged', next ? '1' : '0');
  })

  const statusEl = document.getElementById('decision-status');
  if (statusEl) {
    statusEl.textContent = serverOk
      ? 'Fastlane-Markierung gespeichert.'
      : 'Fastlane lokal markiert (Server nicht erreichbar).';
  }

  if (btn) btn.disabled = false;
}

window.setDecision = async function setDecision(btn,id,status){
  const decidedAt = new Date().toISOString();
  const statusEl = document.getElementById('decision-status');
  if (statusEl) statusEl.textContent = 'Speichere Entscheidung…';

  if (btn) btn.disabled = true;

  // Optimistic UI: hide immediately, even if API is slow/unreachable.
  const clickedRow = btn ? btn.closest('tr[data-id]') : null;
  if (clickedRow) {
    clickedRow.setAttribute('data-status', status)
    clickedRow.style.opacity = '0.72'
    clickedRow.style.display='none'
  }

  document.querySelectorAll('tr[data-id="' + id + '"]').forEach((row)=>{
    row.setAttribute('data-status', status)
    row.style.opacity = '0.72'
    row.style.display='none'
  })

  let serverOk = false;
  if (API_BASE) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const url = API_BASE + '/review-decision';
      dbg('setDecision:request', { id, status, url });

      const res = await fetch(url, {
        method:'POST',
        headers:{'content-type':'application/json'},
        body: JSON.stringify({ id, status, decidedAt }),
        signal: controller.signal,
      });

      clearTimeout(timer);
      dbg('setDecision:response', { id, status, code: res.status, ok: res.ok });
      if (res.ok) serverOk = true;
    } catch (err) {
      dbg('setDecision:error', { id, status, message: String(err?.message || err) });
    }
  } else {
    dbg('setDecision:skip-no-api-base', { id, status });
  }

  try {
    const s=read();
    s[id]={status,decidedAt};
    write(s);
  } catch(err) {
    console.warn('Local decision persist failed', err)
  }

  document.querySelectorAll('.fastlane-card[data-id="' + id + '"]').forEach((card)=>{
    card.style.display = 'none'
  })
  updateStatusSummary();

  if (statusEl) {
    statusEl.textContent = serverOk
      ? 'Entscheidung gespeichert.'
      : 'Entscheidung lokal gespeichert (Server nicht erreichbar).';
  }
  if (btn) btn.disabled = false;
}
window.exportDecisions = function exportDecisions(){
  const blob=new Blob([JSON.stringify(read(),null,2)],{type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='review-decisions.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

for (const id of Object.keys(readFastlaneTags())) renderFastlaneTagButton(id)
hideDecidedRows();
</script>
</body>
</html>`

const renderedHtml = normalizeBrokenGerman(html)

fs.writeFileSync(outPath, renderedHtml)
fs.mkdirSync(new URL('../public/review/', import.meta.url), { recursive: true })
fs.writeFileSync(outPathIndex, renderedHtml)
const generatedAt = new Date().toISOString()

fs.writeFileSync(reviewDataPath, JSON.stringify({
  generatedAt,
  total: reviewItems.length,
  ids: reviewItems.map((item) => `${item.sourceId}:${item.externalId}`),
  sourceFix: {
    total: cantonalSourceFixItems.length,
    byCanton: sourceFixByCanton,
    ids: cantonalSourceFixItems.map((item) => `${item.sourceId}:${item.externalId}`),
  },
}, null, 2))

fs.writeFileSync(reviewCandidatesPath, JSON.stringify({
  generatedAt,
  total: reviewItems.length,
  sourceFix: {
    total: cantonalSourceFixItems.length,
    byCanton: sourceFixByCanton,
    items: cantonalSourceFixItems.map((item) => ({
      id: `${item.sourceId}:${item.externalId}`,
      sourceId: item.sourceId,
      externalId: item.externalId,
      canton: item?.meta?.canton || null,
      title: displayTitle(item),
      sourceUrl: resolveOriginalUrl(item),
      reviewReason: clean(item.reviewReason || ''),
    })),
  },
  items: reviewItems.map((item) => ({
    id: `${item.sourceId}:${item.externalId}`,
    sourceId: item.sourceId,
    externalId: item.externalId,
    title: displayTitle(item),
    summary: germanizeText(summarizeForReview(item)),
    score: Number(item.score || 0),
    status: normalizeReviewStatus(item),
    sourceUrl: resolveOriginalUrl(item),
    publishedAt: item.publishedAt || null,
    fetchedAt: item.fetchedAt || null,
    matchedKeywords: Array.isArray(item.matchedKeywords) ? item.matchedKeywords.map((k) => germanizeText(k)) : [],
    reviewReason: clean(item.reviewReason || ''),
  })),
}, null, 2))

console.log(`Review-Ansicht gebaut: ${outPath.pathname} + ${outPathIndex.pathname} (${reviewItems.length} Eintraege)`)

