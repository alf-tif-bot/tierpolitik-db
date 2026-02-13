import { loadDb, saveDb } from './db.mjs'

export const DEFAULT_KEYWORDS = [
  'tier',
  'tierschutz',
  'nutztiere',
  'tierhaltung',
  'schlachthof',
  'tiertransport',
  'jagd',
  'fischerei',
  'versuchstiere',
  'tiere',
  'animal',
  'animaux',
  'protection animale',
  'wohl der tiere',
  'hund',
  'katze',
]
export function scoreText(text, keywords = DEFAULT_KEYWORDS) {
  const lower = text.toLowerCase()
  const matched = keywords.filter((kw) => lower.includes(kw))
  const score = Math.min(1, matched.length / 4)
  return { score, matched }
}

export function runRelevanceFilter({ minScore = 0.25, keywords = DEFAULT_KEYWORDS } = {}) {
  const db = loadDb()
  let touched = 0

  for (const item of db.items) {
    const text = `${item.title}\n${item.summary}\n${item.body}`
    const { score, matched } = scoreText(text, keywords)
    item.score = score
    item.matchedKeywords = matched
    item.status = score >= minScore ? 'queued' : 'rejected'
    item.reviewReason = score >= minScore ? `Automatisch relevant (>= ${minScore})` : `Automatisch ausgeschlossen (< ${minScore})`
    touched += 1
  }

  saveDb(db)
  return { touched, minScore }
}
