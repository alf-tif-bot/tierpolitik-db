import fs from 'node:fs'
import path from 'node:path'
import { loadDb, saveDb } from './db.mjs'

export const ANCHOR_KEYWORDS = [
  'tier', 'tiere', 'tierschutz', 'tierwohl', 'nutztiere', 'tierhaltung', 'massentierhaltung', 'massentier', 'tiertransport',
  'tierversuch', 'tierversuche', 'versuchstiere', 'schlachthof',
  'haustier', 'hunde', 'hund', 'katze', 'katzen', 'hühner', 'huehner', 'geflügel', 'gefluegel', 'vogelgrippe', 'schwein', 'schweine', 'schweinemast', 'schweinezucht', 'rind',
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
  'sentience', 'empfindungsfähig', 'empfindungsfaehig', 'specisme', 'especismo',
  'élevage', 'elevage', 'allevamento', 'bestiame', 'viehhaltung', 'weidetier',
]

const SUPPORT_KEYWORDS = [
  'stall', 'haltung', 'transport', 'kontrolle', 'veterinär', 'veterinaer', 'vétérinaire', 'veterinaire', 'verordnung',
  'gesetz', 'initiative', 'motion', 'postulat', 'botschaft', 'sanktion', 'zucht', 'fleisch', 'proviande', 'suisseporcs', 'swissmilk', 'schweizer tierschutz', 'sts',
  'schlacht', 'mast', 'pelz', 'fisch', 'jagd', 'wildtier', 'bien-être', 'bien etre',
  'protection', 'animalier', 'animale', 'faune',
  'biodiversität', 'biodiversitaet', 'biodiversite',
  'landwirtschaft', 'agriculture', 'agricoltura',
  'ernährung', 'ernaehrung', 'nutrition', 'alimentazione',
  'zoo', 'zoos', 'veterinärmedizin', 'veterinaermedizin',
]

const NOISE_KEYWORDS = [
  'energie', 'elektrizität', 'elektrizitaet', 'steuern', 'finanz', 'ahv', 'armee',
  'rhone', 'gotthard', 'tunnel', 'digitalisierung', 'strassenverkehr', 'parkplatz', 'tourismus',
  'wohnung', 'wohnungsbau', 'mietrecht', 'cyber', 'datenschutz',
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

const reviewDecisionsPath = path.resolve(process.cwd(), 'data/review-decisions.json')
const feedbackOutPath = path.resolve(process.cwd(), 'data/relevance-feedback.json')

const FEEDBACK_IGNORE_KEYWORDS = new Set([
  'motion', 'initiative', 'postulat', 'gesetz', 'botschaft', 'kontrolle', 'transport', 'protection',
  'agriculture', 'agricoltura', 'landwirtschaft', 'sanktion', 'verordnung',
])

const loadReviewDecisions = () => {
  try {
    if (!fs.existsSync(reviewDecisionsPath)) return {}
    return JSON.parse(fs.readFileSync(reviewDecisionsPath, 'utf8'))
  } catch {
    return {}
  }
}

const buildFeedbackModel = (db, decisions) => {
  const stats = new Map()

  for (const item of db.items || []) {
    const id = `${item.sourceId}:${item.externalId}`
    const decision = decisions[id]?.status
    if (!decision || !['approved', 'rejected'].includes(decision)) continue

    const text = `${item.title}\n${item.summary}\n${item.body}`
    const normalizedText = normalize(text)
    const kws = [...new Set([
      ...ANCHOR_KEYWORDS.filter((kw) => hasKeyword(normalizedText, kw)),
      ...SUPPORT_KEYWORDS.filter((kw) => hasKeyword(normalizedText, kw)),
    ])]

    for (const kw of kws) {
      if (FEEDBACK_IGNORE_KEYWORDS.has(kw)) continue
      const s = stats.get(kw) || { approved: 0, rejected: 0 }
      if (decision === 'approved') s.approved += 1
      if (decision === 'rejected') s.rejected += 1
      stats.set(kw, s)
    }
  }

  const weights = new Map()
  for (const [kw, s] of stats.entries()) {
    const total = s.approved + s.rejected
    if (total < 3) continue
    const rawWeight = (s.approved - s.rejected) / total
    const weight = Math.abs(rawWeight) < 0.2 ? 0 : rawWeight
    if (weight !== 0) weights.set(kw, weight)
  }

  try {
    const sorted = [...weights.entries()]
      .map(([keyword, weight]) => ({ keyword, weight: Number(weight.toFixed(3)) }))
      .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight))
      .slice(0, 120)
    fs.writeFileSync(feedbackOutPath, JSON.stringify({ updatedAt: new Date().toISOString(), learned: sorted }, null, 2))
  } catch {
    // non-fatal
  }

  return weights
}

const hasKeyword = (normalizedText, keyword) => {
  const kw = normalize(keyword)
  if (!kw) return false
  if (kw.includes(' ')) return normalizedText.includes(kw)
  const tokens = normalizedText.split(' ')
  if (kw.length <= 4) {
    return tokens.some((token) => token === kw)
  }
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
  const decisions = loadReviewDecisions()
  const feedbackWeights = buildFeedbackModel(db, decisions)
  const enabledSourceIds = new Set((db.sources || []).filter((s) => s.enabled !== false).map((s) => s.id))
  const affairTextMap = new Map()

  for (const item of db.items) {
    if (!enabledSourceIds.has(item.sourceId)) continue
    if (item?.meta?.scaffold) continue
    const affairId = String(item.affairId || item.externalId || '').split('-')[0]
    const variantText = Object.values(item.languageVariants || {})
      .map((v) => `${v?.title || ''}\n${v?.summary || ''}\n${v?.body || ''}`)
      .join('\n')
    const fullText = `${item.title}\n${item.summary}\n${item.body}\n${variantText}`.trim()
    if (!fullText) continue
    const prev = affairTextMap.get(affairId)
    affairTextMap.set(affairId, prev ? `${prev}\n${fullText}` : fullText)
  }

  let touched = 0
  let relevantCount = 0

  for (const item of db.items) {
    if (!enabledSourceIds.has(item.sourceId)) continue
    if (item?.meta?.scaffold) continue
    const affairId = String(item.affairId || item.externalId || '').split('-')[0]
    const variantText = Object.values(item.languageVariants || {})
      .map((v) => `${v?.title || ''}\n${v?.summary || ''}\n${v?.body || ''}`)
      .join('\n')
    const text = `${item.title}\n${item.summary}\n${item.body}\n${variantText}\n${affairTextMap.get(affairId) || ''}`
    const { score, matched, anchorMatches, supportMatches, noiseMatches, whitelistedPeople, normalizedText } = scoreText(text, keywords)

    const feedbackSignal = [...new Set([...anchorMatches, ...supportMatches])]
      .filter((kw) => !FEEDBACK_IGNORE_KEYWORDS.has(kw))
      .map((kw) => feedbackWeights.get(kw) || 0)
      .sort((a, b) => Math.abs(b) - Math.abs(a))
      .slice(0, 4)
    const feedbackMean = feedbackSignal.length
      ? feedbackSignal.reduce((a, b) => a + b, 0) / feedbackSignal.length
      : 0
    const feedbackBoost = Math.max(-0.14, Math.min(0.14, feedbackMean * 0.2))
    const adjustedScore = Math.max(0, Math.min(1, score + feedbackBoost))

    const hasAnchor = anchorMatches.length > 0
    const hasSupport = supportMatches.length > 0
    const supportStrong = supportMatches.length >= 3
    const hasWhitelistedPerson = whitelistedPeople.length > 0
    const noisyWithoutAnchor = !hasAnchor && noiseMatches.length >= 2
    const isRelevant = !noisyWithoutAnchor && (
      (hasAnchor && (adjustedScore >= minScore || (anchorMatches.length >= 2 && hasSupport)))
      || (supportStrong && adjustedScore >= Math.max(0.5, minScore + 0.08))
      || (hasWhitelistedPerson && (hasAnchor || hasSupport) && adjustedScore >= Math.max(0.14, minScore - 0.04))
    )

    item.score = adjustedScore
    item.matchedKeywords = matched

    const prevStatus = item.status
    const isManualLocked = ['approved', 'published', 'rejected'].includes(prevStatus)
    if (!isManualLocked) {
      item.status = isRelevant ? 'queued' : 'rejected'
    }

    const rule = isRelevant
      ? (hasWhitelistedPerson
        ? 'whitelist+theme'
        : (supportStrong && !hasAnchor ? 'support-strong+score' : (adjustedScore >= minScore ? 'anchor+score' : 'anchor2+support')))
      : (noisyWithoutAnchor ? 'noise-without-anchor' : (!hasAnchor ? 'missing-anchor' : 'below-threshold'))
    const stance = classifyStance(normalizedText)

    item.reviewReason = `${isRelevant ? 'Relevant' : 'Ausgeschlossen'} [${rule}] · stance=${stance} · anchor=${anchorMatches.slice(0, 3).join('|') || '-'} · support=${supportMatches.slice(0, 3).join('|') || '-'} · people=${whitelistedPeople.slice(0, 2).join('|') || '-'} · noise=${noiseMatches.slice(0, 2).join('|') || '-'} · feedback=${feedbackBoost.toFixed(2)} · score=${adjustedScore.toFixed(2)}`

    if (isRelevant) relevantCount += 1
    touched += 1
  }

  const enabledItems = db.items.filter((item) => enabledSourceIds.has(item.sourceId) && !item?.meta?.scaffold)

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
