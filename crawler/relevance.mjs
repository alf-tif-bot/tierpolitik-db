import { loadDb, saveDb } from './db.mjs'

export const ANCHOR_KEYWORDS = [
  'tier', 'tiere', 'tierschutz', 'tierwohl', 'nutztiere', 'tierhaltung', 'tiertransport',
  'tierversuch', 'tierversuche', 'versuchstiere', 'schlachthof',
  'haustier', 'hunde', 'hund', 'katze', 'katzen', 'geflügel', 'gefluegel', 'schwein', 'rind',
  'wildtier', 'wildtiere', 'wolf', 'biber', 'fuchs',
  'biodiversität', 'biodiversitaet', 'biodiversite', 'biodiversita',
  'zoo', 'zoos', 'zirkus', 'wildpark',
  'landwirtschaft', 'agriculture', 'agricoltura',
  'ernährung', 'ernaehrung', 'nutrition', 'alimentazione',
  'veterinär', 'veterinaer', 'vétérinaire', 'veterinaire', 'veterinario',
  'animal', 'animaux', 'protection animale', 'bien-être animal', 'bien etre animal',
  'expérimentation animale', 'experiment animal', 'sperimentazione animale',
  'jagd', 'chasse', 'caccia', 'fischerei', 'pêche', 'peche', 'pesca',
  'stopfleber', 'foie gras', 'pelz', 'fourrure', '3r', 'apiculture', 'apiculteur',
]

const SUPPORT_KEYWORDS = [
  'stall', 'haltung', 'transport', 'kontrolle', 'veterinär', 'veterinaer', 'vétérinaire', 'veterinaire', 'verordnung',
  'gesetz', 'initiative', 'motion', 'postulat', 'botschaft', 'sanktion', 'zucht',
  'schlacht', 'mast', 'pelz', 'fisch', 'jagd', 'wildtier', 'bien-être', 'bien etre',
  'protection', 'animalier', 'animale', 'faune',
  'biodiversität', 'biodiversitaet', 'biodiversite',
  'landwirtschaft', 'agriculture', 'agricoltura',
  'ernährung', 'ernaehrung', 'nutrition', 'alimentazione',
  'zoo', 'zoos', 'veterinärmedizin', 'veterinaermedizin',
]

const NOISE_KEYWORDS = [
  'energie', 'elektrizität', 'elektrizitaet', 'steuern', 'finanz', 'ahv', 'armee',
  'rhone', 'gotthard', 'tunnel', 'digitalisierung',
]

const PRO_STANCE_KEYWORDS = [
  'tierschutz', 'tierwohl', 'schutz', 'verbot', 'alternativen zu tierversuchen', '3r',
  'protection animale', 'bien-être animal', 'sperimentazione animale',
]

const CRITICAL_STANCE_KEYWORDS = [
  'abschuss', 'regulierung', 'bestandskontrolle', 'jagd erleichtern', 'lockerung',
  'abschussbewilligung', 'dezimierung', 'bejagung', 'entnahme', 'schädlingsbekämpfung',
  'abattage', 'tir', 'abbattimento',
]

const PERSON_WHITELIST = [
  'meret schneider',
  'tobias sennhauser',
  'casimir von arx',
  'susanne clauss',
  'maya graf',
  'anna giacometti',
  'samira marti',
  'jon pult',
  'adèle thorens',
  'adele thorens',
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

const classifyStance = (normalizedText) => {
  const proHits = PRO_STANCE_KEYWORDS.filter((kw) => hasKeyword(normalizedText, kw)).length
  const criticalHits = CRITICAL_STANCE_KEYWORDS.filter((kw) => hasKeyword(normalizedText, kw)).length
  if (criticalHits > proHits && criticalHits > 0) return 'tierschutzkritisch'
  if (proHits > 0) return 'pro-tierschutz'
  return 'neutral/unklar'
}

export function scoreText(text, keywords = DEFAULT_KEYWORDS) {
  const normalizedText = normalize(text)
  const anchorMatches = ANCHOR_KEYWORDS.filter((kw) => hasKeyword(normalizedText, kw))
  const supportMatches = SUPPORT_KEYWORDS.filter((kw) => hasKeyword(normalizedText, kw))
  const noiseMatches = NOISE_KEYWORDS.filter((kw) => hasKeyword(normalizedText, kw))
  const whitelistedPeople = PERSON_WHITELIST.filter((name) => normalizedText.includes(name))
  const matched = keywords.filter((kw) => hasKeyword(normalizedText, kw))

  const anchorScore = Math.min(0.7, anchorMatches.length * 0.28)
  const supportScore = Math.min(0.45, supportMatches.length * 0.14)
  const whitelistBoost = whitelistedPeople.length > 0 ? 0.12 : 0
  const noisePenalty = Math.min(0.3, noiseMatches.length * 0.1)
  const score = Math.max(0, Math.min(1, anchorScore + supportScore + whitelistBoost - noisePenalty))

  return { score, matched, normalizedText, anchorMatches, supportMatches, noiseMatches, whitelistedPeople }
}

export function runRelevanceFilter({ minScore = 0.34, fallbackMin = 3, keywords = DEFAULT_KEYWORDS } = {}) {
  const db = loadDb()
  const enabledSourceIds = new Set((db.sources || []).filter((s) => s.enabled !== false).map((s) => s.id))
  let touched = 0
  let relevantCount = 0

  for (const item of db.items) {
    if (!enabledSourceIds.has(item.sourceId)) continue
    const text = `${item.title}\n${item.summary}\n${item.body}`
    const { score, matched, anchorMatches, supportMatches, noiseMatches, whitelistedPeople, normalizedText } = scoreText(text, keywords)

    const hasAnchor = anchorMatches.length > 0
    const hasSupport = supportMatches.length > 0
    const hasWhitelistedPerson = whitelistedPeople.length > 0
    const isRelevant =
      (hasAnchor && (score >= minScore || (anchorMatches.length >= 2 && hasSupport)))
      || (hasWhitelistedPerson && (hasAnchor || hasSupport) && score >= Math.max(0.14, minScore - 0.04))

    item.score = score
    item.matchedKeywords = matched

    const prevStatus = item.status
    const isManualLocked = ['approved', 'published', 'rejected'].includes(prevStatus)
    if (!isManualLocked) {
      item.status = isRelevant ? 'queued' : 'rejected'
    }

    const rule = isRelevant
      ? (hasWhitelistedPerson ? 'whitelist+theme' : (score >= minScore ? 'anchor+score' : 'anchor2+support'))
      : (!hasAnchor ? 'missing-anchor' : 'below-threshold')
    const stance = classifyStance(normalizedText)

    item.reviewReason = `${isRelevant ? 'Relevant' : 'Ausgeschlossen'} [${rule}] · stance=${stance} · anchor=${anchorMatches.slice(0, 3).join('|') || '-'} · support=${supportMatches.slice(0, 3).join('|') || '-'} · people=${whitelistedPeople.slice(0, 2).join('|') || '-'} · noise=${noiseMatches.slice(0, 2).join('|') || '-'} · score=${score.toFixed(2)}`

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
