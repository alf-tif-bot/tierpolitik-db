import fs from 'node:fs'
import path from 'node:path'
import { loadDb, saveDb } from './db.mjs'

export const ANCHOR_KEYWORDS = [
  'tier', 'tiere', 'tierschutz', 'tierwohl', 'nutztiere', 'tierhaltung', 'massentierhaltung', 'massentier', 'tiertransport',
  'tierversuch', 'tierversuche', 'versuchstiere', 'tierversuchsfreie', 'schlachthof',
  'haustier', 'haustiere', 'heimtier', 'heimtiere', 'hunde', 'hund', 'katze', 'katzen', 'hühner', 'huehner', 'geflügel', 'gefluegel', 'vogelgrippe', 'schwein', 'schweine', 'schweinemast', 'schweinezucht', 'rind',
  'wildtier', 'wildtiere', 'wolf', 'biber', 'fuchs',
  'biodiversität', 'biodiversitaet', 'biodiversite', 'biodiversita',
  'zoo', 'zoos', 'zirkus', 'wildpark',
  'landwirtschaft', 'agriculture', 'agricoltura',
  'ernährung', 'ernaehrung', 'nutrition', 'alimentazione',
  'veterinär', 'veterinaer', 'vétérinaire', 'veterinaire', 'veterinario',
  'animal', 'animaux', 'animali', 'protection animale', 'bien-être animal', 'bien etre animal', 'benessere animale',
  'expérimentation animale', 'experiment animal', 'sperimentazione animale', 'sperimentazioni animali',
  'jagd', 'chasse', 'caccia', 'fischerei', 'pêche', 'peche', 'pesca',
  'stopfleber', 'foie gras', 'pelz', 'fourrure', '3r', 'apiculture', 'apiculteur',
  'sentience', 'empfindungsfähig', 'empfindungsfaehig', 'specisme', 'especismo',
  'élevage', 'elevage', 'allevamento', 'bestiame', 'viehhaltung', 'weidetier',
  'tierrechte', 'droits des animaux', 'diritti degli animali',
  'maltraitance animale', 'detention des animaux', 'detenzione di animali',
  'herdenschutz', 'wildtierkorridor', 'faune sauvage', 'fauna selvatica',
  'jagdbann', 'wildruhezone', 'fischsterben', 'amphibien',
]

const SUPPORT_KEYWORDS = [
  'stall', 'haltung', 'transport', 'kontrolle', 'veterinär', 'veterinaer', 'vétérinaire', 'veterinaire', 'verordnung',
  'gesetz', 'initiative', 'motion', 'postulat', 'botschaft', 'sanktion', 'zucht', 'fleisch', 'proviande', 'suisseporcs', 'swissmilk', 'schweizer tierschutz', 'sts',
  'tierseuche', 'tierseuchen', 'zoonose', 'zoonosen', 'haustierhaltung',
  'schlacht', 'mast', 'pelz', 'fisch', 'jagd', 'wildtier', 'bien-être', 'bien etre',
  'protection', 'animalier', 'animale', 'animali', 'faune', 'allevamenti',
  'biodiversität', 'biodiversitaet', 'biodiversite',
  'landwirtschaft', 'agriculture', 'agricoltura',
  'ernährung', 'ernaehrung', 'nutrition', 'alimentazione',
  'zoo', 'zoos', 'veterinärmedizin', 'veterinaermedizin',
]

const NOISE_KEYWORDS = [
  'energie', 'elektrizität', 'elektrizitaet', 'steuern', 'finanz', 'ahv', 'armee',
  'rhone', 'gotthard', 'tunnel', 'digitalisierung', 'strassenverkehr', 'parkplatz', 'tourismus',
  'wohnung', 'wohnungsbau', 'mietrecht', 'cyber', 'datenschutz',
  'gesundheitskosten', 'krankenkasse', 'spital', 'bildungswesen', 'schule', 'hochschule',
]

const CONTEXTUAL_ANIMAL_PHRASES = [
  'nutztiere halten',
  'haltung von nutztieren',
  'tierversuche ersetzen',
  'tierversuche reduzieren',
  'tiertransporte',
  'wildtiere schützen',
  'protection des animaux',
  'bien etre des animaux',
  'bien-être des animaux',
  'sperimentazione animale',
  'wohl der tiere',
  'protection de la faune',
  'benessere animale',
]

const WEAK_ANCHOR_KEYWORDS = new Set([
  'tier',
  'tiere',
  'animal',
  'animaux',
  'animale',
  'faune',
  'landwirtschaft',
  'agriculture',
  'agricoltura',
  'apiculture',
  'apiculteur',
  'biodiversität',
  'biodiversitaet',
  'biodiversite',
  'biodiversita',
  'ernährung',
  'ernaehrung',
  'nutrition',
  'alimentazione',
])

const PARLIAMENT_PROCESS_KEYWORDS = [
  'interpellation',
  'anfrage',
  'schriftliche anfrage',
  'fragestunde',
  'vorstoss',
  'vorstosse',
  'vorstösse',
  'intervention parlementaire',
  'objet parlementaire',
  'atto parlamentare',
]

const PROCESS_ONLY_SUPPORT_KEYWORDS = new Set([
  'gesetz',
  'initiative',
  'motion',
  'postulat',
  'botschaft',
  'verordnung',
  'kontrolle',
  'sanktion',
])

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
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^\p{L}\p{N}]+/gu, ' ')
  .trim()

const reviewDecisionsPath = path.resolve(process.cwd(), 'data/review-decisions.json')
const fastlaneTagsPath = path.resolve(process.cwd(), 'data/review-fastlane-tags.json')
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

const loadFastlaneTags = () => {
  try {
    if (!fs.existsSync(fastlaneTagsPath)) return {}
    return JSON.parse(fs.readFileSync(fastlaneTagsPath, 'utf8'))
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

const buildFastlaneKeywordModel = (db, tags) => {
  const counts = new Map()

  for (const item of db.items || []) {
    const id = `${item.sourceId}:${item.externalId}`
    const tagged = Boolean(tags[id]?.fastlane)
    if (!tagged) continue

    const text = `${item.title}\n${item.summary}\n${item.body}`
    const normalizedText = normalize(text)
    const kws = [...new Set([
      ...ANCHOR_KEYWORDS.filter((kw) => hasKeyword(normalizedText, kw)),
      ...SUPPORT_KEYWORDS.filter((kw) => hasKeyword(normalizedText, kw)),
    ])]

    for (const kw of kws) {
      if (FEEDBACK_IGNORE_KEYWORDS.has(kw)) continue
      counts.set(kw, (counts.get(kw) || 0) + 1)
    }
  }

  const weights = new Map()
  for (const [kw, count] of counts.entries()) {
    if (count < 2) continue
    weights.set(kw, Math.min(0.22, count * 0.06))
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
  const contextualHits = CONTEXTUAL_ANIMAL_PHRASES.filter((kw) => hasKeyword(normalizedText, kw))
  const processHits = PARLIAMENT_PROCESS_KEYWORDS.filter((kw) => hasKeyword(normalizedText, kw))
  const matched = keywords.filter((kw) => hasKeyword(normalizedText, kw))

  const anchorScore = Math.min(0.7, anchorMatches.length * 0.28)
  const supportScore = Math.min(0.45, supportMatches.length * 0.14)
  const contextualBoost = Math.min(0.16, contextualHits.length * 0.08)
  const processBoost = (anchorMatches.length > 0 && processHits.length > 0) ? Math.min(0.08, processHits.length * 0.03) : 0
  const whitelistBoost = whitelistedPeople.length > 0 ? 0.12 : 0
  const genericOnlyPenalty = anchorMatches.length === 0 && supportMatches.length <= 2 ? 0.08 : 0
  const noisePenalty = Math.min(0.3, noiseMatches.length * 0.1)
  const score = Math.max(0, Math.min(1, anchorScore + supportScore + contextualBoost + processBoost + whitelistBoost - noisePenalty - genericOnlyPenalty))

  return { score, matched, normalizedText, anchorMatches, supportMatches, contextualHits, processHits, noiseMatches, whitelistedPeople }
}

export function runRelevanceFilter({ minScore = 0.34, fallbackMin = 3, keywords = DEFAULT_KEYWORDS } = {}) {
  const db = loadDb()
  const decisions = loadReviewDecisions()
  const fastlaneTags = loadFastlaneTags()
  const feedbackWeights = buildFeedbackModel(db, decisions)
  const fastlaneKeywordWeights = buildFastlaneKeywordModel(db, fastlaneTags)
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

  const strongPositiveKeywords = new Set(
    [...feedbackWeights.entries()]
      .filter(([, weight]) => weight >= 0.55)
      .map(([kw]) => kw),
  )
  const strongNegativeKeywords = new Set(
    [...feedbackWeights.entries()]
      .filter(([, weight]) => weight <= -0.55)
      .map(([kw]) => kw),
  )

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
    const { score, matched, anchorMatches, supportMatches, contextualHits, processHits, noiseMatches, whitelistedPeople, normalizedText } = scoreText(text, keywords)

    const matchedSignals = [...new Set([...anchorMatches, ...supportMatches])]
      .filter((kw) => !FEEDBACK_IGNORE_KEYWORDS.has(kw))

    const feedbackSignal = matchedSignals
      .map((kw) => feedbackWeights.get(kw) || 0)
      .sort((a, b) => Math.abs(b) - Math.abs(a))
      .slice(0, 4)
    const feedbackMean = feedbackSignal.length
      ? feedbackSignal.reduce((a, b) => a + b, 0) / feedbackSignal.length
      : 0
    const feedbackBoost = Math.max(-0.14, Math.min(0.14, feedbackMean * 0.2))

    const fastlaneSignal = matchedSignals
      .map((kw) => fastlaneKeywordWeights.get(kw) || 0)
      .sort((a, b) => b - a)
      .slice(0, 3)
    const fastlaneBoost = Math.min(0.16, fastlaneSignal.reduce((a, b) => a + b, 0))

    const adjustedScore = Math.max(0, Math.min(1, score + feedbackBoost + fastlaneBoost))

    const hasAnchor = anchorMatches.length > 0
    const hasSupport = supportMatches.length > 0
    const hasContextual = contextualHits.length > 0
    const supportStrong = supportMatches.length >= 3
    const weakAnchorCount = anchorMatches.filter((kw) => WEAK_ANCHOR_KEYWORDS.has(kw)).length
    const onlyWeakAnchors = hasAnchor && weakAnchorCount === anchorMatches.length
    const hasWhitelistedPerson = whitelistedPeople.length > 0
    const strongPositiveHits = [...new Set([...anchorMatches, ...supportMatches])].filter((kw) => strongPositiveKeywords.has(kw))
    const strongNegativeHits = [...new Set([...anchorMatches, ...supportMatches])].filter((kw) => strongNegativeKeywords.has(kw))
    const noisyWithoutAnchor = !hasAnchor && noiseMatches.length >= 2
    const negativeFeedbackOnly = strongNegativeHits.length > 0 && !hasAnchor && adjustedScore < Math.max(0.42, minScore + 0.06)
    const recallByFeedback = strongPositiveHits.length >= 2 && adjustedScore >= Math.max(0.22, minScore - 0.08)

    const supportIsProcessOnly = hasSupport && supportMatches.every((kw) => PROCESS_ONLY_SUPPORT_KEYWORDS.has(kw))
    const weakAnchorBlocked = onlyWeakAnchors
      && !hasContextual
      && (!hasSupport || supportIsProcessOnly)
      && adjustedScore < Math.max(minScore + 0.12, 0.48)

    const isRelevant = !noisyWithoutAnchor && !negativeFeedbackOnly && !weakAnchorBlocked && (
      (hasAnchor && (adjustedScore >= minScore || (anchorMatches.length >= 2 && hasSupport)))
      || (hasContextual && (hasAnchor || hasSupport) && adjustedScore >= Math.max(0.26, minScore - 0.06))
      || (supportStrong && !supportIsProcessOnly && adjustedScore >= Math.max(0.5, minScore + 0.08))
      || (hasWhitelistedPerson && (hasAnchor || hasSupport || hasContextual) && adjustedScore >= Math.max(0.14, minScore - 0.04))
      || recallByFeedback
    )

    item.score = adjustedScore
    item.matchedKeywords = matched

    const prevStatus = item.status
    const itemDecision = decisions[`${item.sourceId}:${item.externalId}`]?.status
    const normalizedDecision = ['queued', 'approved', 'published', 'rejected'].includes(String(itemDecision))
      ? String(itemDecision)
      : null
    const isManualLocked = ['approved', 'published'].includes(prevStatus) || normalizedDecision !== null

    if (normalizedDecision) {
      item.status = normalizedDecision === 'published' ? 'published' : normalizedDecision
    } else if (!isManualLocked) {
      item.status = isRelevant ? 'queued' : 'rejected'
    }

    const rule = isRelevant
      ? (hasWhitelistedPerson
        ? 'whitelist+theme'
        : (hasContextual && !hasAnchor
          ? 'contextual+score'
          : (supportStrong && !hasAnchor
            ? 'support-strong+score'
            : (recallByFeedback ? 'feedback-recall' : (adjustedScore >= minScore ? 'anchor+score' : 'anchor2+support')))))
      : (noisyWithoutAnchor
        ? 'noise-without-anchor'
        : (negativeFeedbackOnly
          ? 'feedback-negative-only'
          : (weakAnchorBlocked ? 'weak-anchor-without-context' : (!hasAnchor ? 'missing-anchor' : 'below-threshold'))))
    const stance = classifyStance(normalizedText)

    item.reviewReason = `${isRelevant ? 'Relevant' : 'Ausgeschlossen'} [${rule}] · stance=${stance} · anchor=${anchorMatches.slice(0, 3).join('|') || '-'} · support=${supportMatches.slice(0, 3).join('|') || '-'} · context=${contextualHits.slice(0, 2).join('|') || '-'} · process=${processHits.slice(0, 2).join('|') || '-'} · fb+=${strongPositiveHits.slice(0, 2).join('|') || '-'} · fb-=${strongNegativeHits.slice(0, 2).join('|') || '-'} · people=${whitelistedPeople.slice(0, 2).join('|') || '-'} · noise=${noiseMatches.slice(0, 2).join('|') || '-'} · feedback=${feedbackBoost.toFixed(2)} · fastlane=${fastlaneBoost.toFixed(2)} · score=${adjustedScore.toFixed(2)}`

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
