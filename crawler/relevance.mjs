import { loadDb, saveDb } from './db.mjs'

export const ANCHOR_KEYWORDS = [
  'tier', 'tiere', 'tierschutz', 'tierwohl', 'nutztiere', 'tierhaltung', 'tiertransport',
  'schlachthof', 'versuchstiere', 'haustier', 'hunde', 'katze', 'katzen',
  'animal', 'animaux', 'protection animale', 'bien-être animal',
  'jagd', 'fischerei', 'wildtiere',
  'stopfleber', 'foie gras', 'pelz', '3r', 'experiment',
]

const SUPPORT_KEYWORDS = [
  'stall', 'haltung', 'transport', 'kontrolle', 'veterinär', 'veterinaer', 'verordnung',
  'gesetz', 'initiative', 'motion', 'postulat', 'botschaft', 'sanktion', 'zucht',
  'schlacht', 'mast', 'pelz', 'fisch', 'jagd', 'wildtier',
]

const NOISE_KEYWORDS = [
  'energie', 'elektrizität', 'elektrizitaet', 'steuern', 'finanz', 'ahv', 'armee',
  'rhone', 'gotthard', 'tunnel', 'digitalisierung',
]

export const DEFAULT_KEYWORDS = [...new Set([...ANCHOR_KEYWORDS, ...SUPPORT_KEYWORDS])]

const normalize = (value = '') => String(value)
  .toLowerCase()
  .replace(/[^\p{L}\p{N}]+/gu, ' ')
  .trim()

const hasKeyword = (normalizedText, keyword) => {
  const kw = normalize(keyword)
  if (!kw) return false
  if (kw.includes(' ')) return normalizedText.includes(kw)
  const tokens = normalizedText.split(' ')
  return tokens.some((token) => token === kw || token.startsWith(kw))
}

export function scoreText(text, keywords = DEFAULT_KEYWORDS) {
  const normalizedText = normalize(text)
  const anchorMatches = ANCHOR_KEYWORDS.filter((kw) => hasKeyword(normalizedText, kw))
  const supportMatches = SUPPORT_KEYWORDS.filter((kw) => hasKeyword(normalizedText, kw))
  const noiseMatches = NOISE_KEYWORDS.filter((kw) => hasKeyword(normalizedText, kw))
  const matched = keywords.filter((kw) => hasKeyword(normalizedText, kw))

  const anchorScore = Math.min(0.7, anchorMatches.length * 0.28)
  const supportScore = Math.min(0.45, supportMatches.length * 0.14)
  const noisePenalty = Math.min(0.3, noiseMatches.length * 0.1)
  const score = Math.max(0, Math.min(1, anchorScore + supportScore - noisePenalty))

  return { score, matched, normalizedText, anchorMatches, supportMatches, noiseMatches }
}

export function runRelevanceFilter({ minScore = 0.34, fallbackMin = 3, keywords = DEFAULT_KEYWORDS } = {}) {
  const db = loadDb()
  const enabledSourceIds = new Set((db.sources || []).filter((s) => s.enabled !== false).map((s) => s.id))
  let touched = 0
  let relevantCount = 0

  for (const item of db.items) {
    if (!enabledSourceIds.has(item.sourceId)) continue
    const text = `${item.title}\n${item.summary}\n${item.body}`
    const { score, matched, anchorMatches, supportMatches, noiseMatches } = scoreText(text, keywords)

    const hasAnchor = anchorMatches.length > 0
    const hasSupport = supportMatches.length > 0
    const isRelevant = hasAnchor && (score >= minScore || (anchorMatches.length >= 2 && hasSupport))

    item.score = score
    item.matchedKeywords = matched
    item.status = isRelevant ? 'queued' : 'rejected'

    const rule = isRelevant
      ? (score >= minScore ? 'anchor+score' : 'anchor2+support')
      : (!hasAnchor ? 'missing-anchor' : 'below-threshold')

    item.reviewReason = `${isRelevant ? 'Relevant' : 'Ausgeschlossen'} [${rule}] · anchor=${anchorMatches.slice(0, 3).join('|') || '-'} · support=${supportMatches.slice(0, 3).join('|') || '-'} · noise=${noiseMatches.slice(0, 2).join('|') || '-'} · score=${score.toFixed(2)}`

    if (isRelevant) relevantCount += 1
    touched += 1
  }

  const enabledItems = db.items.filter((item) => enabledSourceIds.has(item.sourceId))

  if (relevantCount === 0 && enabledItems.length > 0) {
    const fallback = [...enabledItems]
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, fallbackMin)

    for (const item of fallback) {
      item.status = 'queued'
      item.reviewReason = `${item.reviewReason} · fallback=on`
    }
    relevantCount = fallback.length
  }

  saveDb(db)
  return { touched, minScore, relevantCount }
}
