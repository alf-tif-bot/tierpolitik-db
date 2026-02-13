import { loadDb, saveDb } from './db.mjs'

export const ANCHOR_KEYWORDS = [
  'tier',
  'tiere',
  'tierschutz',
  'nutztiere',
  'tierhaltung',
  'tiertransport',
  'schlachthof',
  'versuchstiere',
  'animal',
  'animaux',
  'protection animale',
  'jagd',
  'fischerei',
]

export const DEFAULT_KEYWORDS = [
  ...ANCHOR_KEYWORDS,
  'wohl der tiere',
  'haustier',
  'hunde',
  'katze',
  'katzen',
]

const normalize = (value = '') => String(value)
  .toLowerCase()
  .replace(/[^\p{L}\p{N}]+/gu, ' ')
  .trim()

const hasKeyword = (normalizedText, keyword) => {
  const kw = normalize(keyword)
  if (!kw) return false
  if (kw.includes(' ')) return normalizedText.includes(kw)
  return normalizedText.split(' ').includes(kw)
}

export function scoreText(text, keywords = DEFAULT_KEYWORDS) {
  const normalizedText = normalize(text)
  const matched = keywords.filter((kw) => hasKeyword(normalizedText, kw))
  const score = Math.min(1, matched.length / 4)
  return { score, matched, normalizedText }
}

export function runRelevanceFilter({ minScore = 0.25, keywords = DEFAULT_KEYWORDS } = {}) {
  const db = loadDb()
  let touched = 0

  for (const item of db.items) {
    const text = `${item.title}\n${item.summary}\n${item.body}`
    const { score, matched, normalizedText } = scoreText(text, keywords)
    const hasAnchor = ANCHOR_KEYWORDS.some((kw) => hasKeyword(normalizedText, kw))
    const isRelevant = hasAnchor && score >= minScore

    item.score = score
    item.matchedKeywords = matched
    item.status = isRelevant ? 'queued' : 'rejected'
    item.reviewReason = isRelevant
      ? `Automatisch relevant (>= ${minScore}, mit Tierschutz-Anker)`
      : `Automatisch ausgeschlossen (kein Tierschutz-Anker oder < ${minScore})`
    touched += 1
  }

  saveDb(db)
  return { touched, minScore }
}
