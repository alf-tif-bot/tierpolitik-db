import fs from 'node:fs'

const cantonsPath = new URL('../crawler/config.cantonal-sources.json', import.meta.url)
const outPath = new URL('../data/cantonal-source-registry.json', import.meta.url)

const cantons = JSON.parse(fs.readFileSync(cantonsPath, 'utf8'))
const PROBE_CANDIDATE_LIMIT = Math.max(4, Number(process.env.CANTON_PROBE_CANDIDATE_LIMIT || 12))
const PROBE_CONCURRENCY = Math.max(1, Number(process.env.CANTON_PROBE_CONCURRENCY || 4))
const PROBE_TIMEOUT_MS = Math.max(3000, Number(process.env.CANTON_PROBE_TIMEOUT_MS || 7000))
const PROBE_RETRY_TIMEOUT_MS = Math.max(PROBE_TIMEOUT_MS, Number(process.env.CANTON_PROBE_RETRY_TIMEOUT_MS || 12000))

const PARLIAMENT_URL_HINTS = [
  '/objets-parlementaires',
  '/interventions-parlementaires',
  '/objets-et-rapports-de-commissions',
  '/objets-du-conseil',
  '/objets/pages/accueil.aspx',
  '/parlamentsdienst',
  '/kantonsratview',
  '/kantonsratmain',
  '/grosserrat',
  '/kantonsrat.html',
  '/recherche-objets',
  '/ricerca-messaggi-e-atti',
  '/geschaefte',
  '/geschaefte-grosser-rat',
  '/geschaefte-des-kantonsrats',
  '/geschaefte-suche',
  '/geschaefte/suche',
  '/sessionen',
  '/protokolle',
  '/vorstoesse',
  '/vorstosse',
  '/kantonsrat',
  '/landrat',
  '/grand-conseil',
  '/grandconseil/',
  '/parlinfo',
]

const PARLIAMENT_TEXT_HINTS = [
  'traktanden',
  'geschaefte',
  'geschäfte',
  'vorstoesse',
  'vorstösse',
  'parlamentarische vorstösse',
  'objets parlementaires',
  'interventions parlementaires',
  'objets et rapports de commissions',
  'objets du conseil',
  'grand conseil',
  'kantonsrat',
  'landrat',
  'grosser rat',
  'session',
  'sessionen',
  'parlement',
]

const detectPlatform = ({ requestUrl = '', finalUrl = '', html = '' } = {}) => {
  const u = `${String(requestUrl)} ${String(finalUrl)}`.toLowerCase()
  const h = String(html).toLowerCase()
  if (h.includes('verifying your browser') || h.includes('vérification de votre navigateur')) return 'waf-challenge'
  if (h.includes('maintenance page') || h.includes('site en maintenance')) return 'maintenance-mode'
  if (u.includes('ratsinfo') || h.includes('ratsinfo')) return 'ratsinfo'
  if (u.includes('parlinfo') || h.includes('parlinfo') || u.includes('/grweb/')) return 'parliament-portal'
  if (u.includes('aio') || h.includes('allris') || h.includes('sessionnet')) return 'allris/sessionnet'
  if (PARLIAMENT_URL_HINTS.some((hint) => u.includes(hint))) return 'parliament-portal'
  if (PARLIAMENT_TEXT_HINTS.some((hint) => h.includes(hint))) return 'parliament-portal'
  if (h.includes('drupal')) return 'drupal-site'
  if (h.includes('typo3')) return 'typo3-site'
  if (h.includes('wordpress')) return 'wordpress-site'
  return 'generic-site'
}

const hasSearchOrAffairPath = (url = '') => [
  'geschaefte',
  'geschaefte-grosser-rat',
  'geschaefte-des-kantonsrats',
  'geschaefte-suche',
  'vorstoesse',
  'vorstosse',
  'objets-parlementaires',
  'interventions-parlementaires',
  'objets-et-rapports-de-commissions',
  'recherche-objets',
  'ricerca-messaggi-e-atti',
  'objets-du-conseil',
  'objets/pages/accueil.aspx',
  'parlamentsdienst',
  'kantonsratview',
  'kantonsratmain',
  'grosserrat',
  'kantonsrat.html',
  'objets/Pages/accueil.aspx',
  'objets/pages/accueil.aspx',
  'sitzung',
].some((hint) => String(url).toLowerCase().includes(String(hint).toLowerCase()))

const extractYearsFromUrl = (url = '') => {
  const matches = String(url).match(/(?:19|20)\d{2}/g) || []
  return [...new Set(matches.map((value) => Number(value)).filter((value) => Number.isFinite(value)))]
}

const hasArchiveSignals = (url = '') => {
  const lower = String(url).toLowerCase()
  return [
    'archive',
    'archiv',
    'historique',
    'histoire',
    'bis-',
    'bis_',
    'bis20',
    'before-',
    'avant-',
    'fino-al-',
  ].some((token) => lower.includes(token))
}

const isLikelyBeforeSinceYear = (url = '', sinceYear = 2020) => {
  const years = extractYearsFromUrl(url)
  if (!years.length) return false
  const maxYear = Math.max(...years)
  return maxYear < Number(sinceYear)
}

const hasNonRootPath = (url = '') => {
  try {
    const parsed = new URL(String(url))
    return parsed.pathname && parsed.pathname !== '/'
  } catch {
    return String(url).replace(/^https?:\/\/[^/]+/i, '').length > 1
  }
}

const hasParliamentHost = (url = '') => {
  try {
    const host = new URL(String(url)).hostname.toLowerCase()
    return ['parlament', 'parliament', 'kantonsrat', 'landrat', 'grosserrat', 'grandconseil'].some((token) => host.includes(token))
  } catch {
    return false
  }
}

const classifyReadiness = ({
  url = '',
  platform = 'generic-site',
  ok = false,
  httpStatus = null,
  hasParliamentSignals = false,
  error = '',
  sinceYear = 2020,
}) => {
  const u = String(url).toLowerCase()
  const err = String(error || '').toLowerCase()
  const hasParliamentHint = [
    'parlament',
    'kantonsrat',
    'grandconseil',
    'objets-parlementaires',
    'interventions-parlementaires',
    'objets-et-rapports-de-commissions',
    'ricerca-messaggi-e-atti',
    'parlinfo',
    'grosserrat',
  ].some((hint) => u.includes(hint))
  const hasSearchOrAffairPathForUrl = hasSearchOrAffairPath(u)

  if (!ok || platform === 'waf-challenge' || platform === 'maintenance-mode') {
    if ((platform === 'waf-challenge' || platform === 'maintenance-mode') && (hasParliamentSignals || hasParliamentHint)) return 'site-discovery-needed'
    if (httpStatus === 429 && (hasParliamentSignals || hasParliamentHint || platform === 'parliament-portal')) return 'site-discovery-needed'
    if ([404, 410, 500, 502, 503].includes(Number(httpStatus)) && (hasParliamentSignals || hasParliamentHint || platform === 'parliament-portal')) {
      return 'site-discovery-needed'
    }
    if (!httpStatus && err.includes('timeout') && (hasParliamentSignals || hasParliamentHint || platform === 'parliament-portal')) {
      return 'site-discovery-needed'
    }
    if (httpStatus === 403) return 'blocked-needs-manual'
    return 'unreachable-needs-manual'
  }
  const likelyArchiveOnly = hasArchiveSignals(u) || isLikelyBeforeSinceYear(u, sinceYear)

  if ((platform === 'ratsinfo' || platform === 'allris/sessionnet') && !likelyArchiveOnly) return 'adapter-ready-likely'
  if (platform === 'parliament-portal' && hasSearchOrAffairPathForUrl && (hasParliamentSignals || hasParliamentHint) && !likelyArchiveOnly) return 'adapter-ready-likely'
  if (platform === 'parliament-portal' && hasParliamentSignals && (hasNonRootPath(u) || hasParliamentHost(u)) && !likelyArchiveOnly) return 'adapter-ready-likely'
  if (platform === 'parliament-portal' && (hasParliamentSignals || hasSearchOrAffairPathForUrl)) return 'site-discovery-needed'
  if ((['typo3-site', 'drupal-site'].includes(platform) && hasParliamentHint) || hasParliamentHint || hasParliamentSignals) {
    return 'site-discovery-needed'
  }
  return 'manual-discovery-needed'
}

const normalizeBase = (value) => String(value || '').replace(/\/+$/, '')

const expandCandidateVariants = (url) => {
  const raw = normalizeBase(url)
  if (!raw) return []
  const variants = new Set([raw])
  if (raw.startsWith('https://www.')) variants.add(raw.replace('https://www.', 'https://'))
  if (raw.startsWith('https://') && !raw.startsWith('https://www.')) variants.add(raw.replace('https://', 'https://www.'))
  return [...variants]
}

const buildCandidates = (entry) => {
  const configured = Array.isArray(entry.urlCandidates)
    ? entry.urlCandidates.flatMap((u) => expandCandidateVariants(String(u || '').trim())).filter(Boolean)
    : []

  const base = normalizeBase(entry.url)
  const alternateHost = base.startsWith('https://www.')
    ? base.replace('https://www.', 'https://')
    : (base.startsWith('https://') ? base.replace('https://', 'https://www.') : base)

  const cantonCode = String(entry?.canton || '').toLowerCase()
  const hostHints = cantonCode
    ? [
      `https://${cantonCode}.ratsinfomanagement.net`,
      `https://www.ratsinfo.${cantonCode}.ch`,
      `https://ratsinfo.${cantonCode}.ch`,
    ]
    : []

  const configuredTopLevel = configured.filter((url) => {
    try {
      return new URL(url).pathname === '/'
    } catch {
      return false
    }
  })

  const configuredDeepLinks = configured.filter((url) => !configuredTopLevel.includes(url))

  const pathHints = [
    'geschaefte',
    'geschaefte-grosser-rat',
    'geschaefte-des-kantonsrats',
    'geschaefte-suche',
    'vorstoesse',
    'vorstosse',
    'objets-parlementaires',
    'interventions-parlementaires',
    'objets-et-rapports-de-commissions',
    'objets-du-conseil',
    'recherche-objets',
    'ricerca-messaggi-e-atti',
    'parlamentsdienst',
    'grosserrat',
    'kantonsrat.html',
    'parlament',
    'kantonsrat',
    'landrat',
    'grand-conseil',
    'gran-consiglio',
    'behoerden/kantonsrat.html',
  ]

  const heuristics = [
    ...expandCandidateVariants(base),
    ...expandCandidateVariants(alternateHost),
    ...pathHints.flatMap((hint) => expandCandidateVariants(`${base}/${hint}`)),
    ...pathHints.flatMap((hint) => expandCandidateVariants(`${alternateHost}/${hint}`)),
  ]

  // Priorisierung für Recall: zuerst bekannte Base-Hosts + ratsinfo/allris-Hosthints,
  // dann tiefe URL-Kandidaten und erst danach heuristische Pfadvarianten.
  return [...new Set([
    ...configuredTopLevel,
    ...expandCandidateVariants(base),
    ...expandCandidateVariants(alternateHost),
    ...configuredDeepLinks,
    ...hostHints,
    ...heuristics,
  ].filter(Boolean))]
}

const detectParliamentSignals = ({ requestUrl = '', finalUrl = '', html = '' } = {}) => {
  const u = `${String(requestUrl)} ${String(finalUrl)}`.toLowerCase()
  const h = String(html).toLowerCase()
  return PARLIAMENT_URL_HINTS.some((hint) => u.includes(hint)) || PARLIAMENT_TEXT_HINTS.some((hint) => h.includes(hint))
}

const probeSource = async (url, timeoutMs = PROBE_TIMEOUT_MS) => {
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      headers: { 'user-agent': 'tierpolitik-crawler-registry/1.3 (+night-shift)' },
      signal: AbortSignal.timeout(timeoutMs),
    })
    const text = await response.text()
    const platform = detectPlatform({ requestUrl: url, finalUrl: response.url, html: text })
    const hasParliamentSignals = detectParliamentSignals({ requestUrl: url, finalUrl: response.url, html: text })
    return {
      ok: response.ok,
      httpStatus: response.status,
      finalUrl: response.url,
      requestUrl: url,
      platform,
      hasParliamentSignals,
    }
  } catch (error) {
    return {
      ok: false,
      httpStatus: null,
      finalUrl: url,
      platform: 'unreachable',
      hasParliamentSignals: false,
      error: String(error?.message || error),
    }
  }
}

const probeQuality = (probe, sinceYear = 2020) => {
  if (!probe.ok) {
    if (probe.httpStatus === 403 || probe.httpStatus === 429) return probe.hasParliamentSignals ? 2 : 1
    return probe.hasParliamentSignals ? 1 : 0
  }
  let score = 5
  if (probe.platform === 'ratsinfo' || probe.platform === 'allris/sessionnet') score += 4
  if (probe.platform === 'parliament-portal') score += 2
  if (probe.hasParliamentSignals) score += 1
  const targetUrl = probe.finalUrl || probe.url
  const targetLower = String(targetUrl).toLowerCase()
  if (hasSearchOrAffairPath(targetUrl)) score += 3
  if (probe.finalUrl && probe.finalUrl !== probe.url) score += 1
  if (hasArchiveSignals(targetUrl)) score -= 3
  if (isLikelyBeforeSinceYear(targetUrl, sinceYear)) score -= 4
  if (targetLower.includes('sitzungsdienst.net') && !hasSearchOrAffairPath(targetLower) && !probe.hasParliamentSignals) score -= 6
  return score
}

const selectBestProbe = (probes, sinceYear = 2020) => {
  if (!probes.length) return null
  return [...probes].sort((a, b) => probeQuality(b, sinceYear) - probeQuality(a, sinceYear))[0]
}

// intentionally probing all shortlisted candidates for better recall/precision

const shouldRetryProbe = (probe) => {
  if (!probe || probe.ok) return false
  const status = Number(probe.httpStatus)
  if ([408, 425, 429, 500, 502, 503, 504].includes(status)) return true
  const err = String(probe.error || '').toLowerCase()
  if (err.includes('timeout') || err.includes('timed out') || err.includes('etimedout')) return true
  return false
}

const probeCandidates = async (candidates) => {
  const limited = candidates.slice(0, PROBE_CANDIDATE_LIMIT)
  const probes = new Array(limited.length)
  let nextIndex = 0

  const worker = async () => {
    while (true) {
      const current = nextIndex
      nextIndex += 1
      if (current >= limited.length) return
      const candidateUrl = limited[current]
      const probe = await probeSource(candidateUrl, PROBE_TIMEOUT_MS)
      probes[current] = { ...probe, url: candidateUrl }
    }
  }

  await Promise.all(Array.from({ length: Math.min(PROBE_CONCURRENCY, limited.length) }, () => worker()))

  const retryIndexes = probes
    .map((probe, index) => ({ probe, index }))
    .filter(({ probe }) => shouldRetryProbe(probe))
    .map(({ index }) => index)

  if (retryIndexes.length) {
    await Promise.all(retryIndexes.map(async (index) => {
      const candidateUrl = limited[index]
      const retryProbe = await probeSource(candidateUrl, PROBE_RETRY_TIMEOUT_MS)
      const prev = probes[index]
      const currentScore = probeQuality({ ...prev, url: candidateUrl })
      const retryScore = probeQuality({ ...retryProbe, url: candidateUrl })
      if (retryScore >= currentScore) {
        probes[index] = { ...retryProbe, url: candidateUrl, retried: true }
      } else {
        probes[index] = { ...prev, url: candidateUrl, retried: true, retrySuppressed: true }
      }
    }))
  }

  return probes.filter(Boolean)
}

const sourceRows = await Promise.all(cantons.map(async (entry) => {
  const candidates = buildCandidates(entry)
  const probes = await probeCandidates(candidates)

  const bestProbe = selectBestProbe(probes, entry.sinceYear) || {
    ok: false,
    httpStatus: null,
    finalUrl: entry.url,
    platform: 'unreachable',
    hasParliamentSignals: false,
    error: 'no-probe',
    url: entry.url,
  }

  const bestUrl = bestProbe.finalUrl || entry.url
  const hasAnyParliamentSignals = probes.some((p) => p.hasParliamentSignals)
  const sinceYearLikelyCovered = !isLikelyBeforeSinceYear(bestUrl, entry.sinceYear)
  const readiness = classifyReadiness({
    url: bestUrl,
    platform: bestProbe.platform,
    ok: bestProbe.ok,
    httpStatus: bestProbe.httpStatus,
    hasParliamentSignals: bestProbe.hasParliamentSignals || hasAnyParliamentSignals,
    error: bestProbe.error,
    sinceYear: entry.sinceYear,
  })

  return {
    id: `ch-canton-${String(entry.canton).toLowerCase()}`,
    canton: entry.canton,
    parliament: entry.parliament,
    adapter: entry.adapter,
    url: entry.url,
    urlCandidates: Array.isArray(entry.urlCandidates) ? entry.urlCandidates : [],
    sinceYear: entry.sinceYear,
    status: bestProbe.ok ? 'scaffolded' : 'probe-failed',
    readiness,
    sinceYearLikelyCovered,
    probe: {
      checkedAt: new Date().toISOString(),
      ok: bestProbe.ok,
      httpStatus: bestProbe.httpStatus,
      finalUrl: bestProbe.finalUrl,
      platform: bestProbe.platform,
      hasParliamentSignals: Boolean(bestProbe.hasParliamentSignals),
      archiveSignals: hasArchiveSignals(bestUrl),
      yearsDetected: extractYearsFromUrl(bestUrl),
      error: bestProbe.error || null,
      candidateCount: candidates.length,
      candidatesTried: probes.map((p) => ({
        url: p.url,
        ok: p.ok,
        httpStatus: p.httpStatus,
        finalUrl: p.finalUrl,
        platform: p.platform,
        hasParliamentSignals: Boolean(p.hasParliamentSignals),
        archiveSignals: hasArchiveSignals(p.finalUrl || p.url),
        yearsDetected: extractYearsFromUrl(p.finalUrl || p.url),
        retried: Boolean(p.retried),
        retrySuppressed: Boolean(p.retrySuppressed),
      })),
    },
  }
}))

const byReadiness = sourceRows.reduce((acc, row) => {
  acc[row.readiness] = (acc[row.readiness] || 0) + 1
  return acc
}, {})

const byAdapter = sourceRows.reduce((acc, row) => {
  const key = row.adapter || 'unknown'
  acc[key] = (acc[key] || 0) + 1
  return acc
}, {})

const sinceYearViolations = sourceRows
  .filter((row) => Number(row.sinceYear) > 2020)
  .map((row) => ({ canton: row.canton, sinceYear: row.sinceYear }))

const sinceYearCoverageGaps = sourceRows
  .filter((row) => !row.sinceYearLikelyCovered)
  .map((row) => ({ canton: row.canton, sinceYear: row.sinceYear, finalUrl: row?.probe?.finalUrl || row.url }))

const unresolvedCantons = sourceRows
  .filter((row) => !['adapter-ready-likely', 'site-discovery-needed'].includes(row.readiness))
  .map((row) => row.canton)

const registry = {
  generatedAt: new Date().toISOString(),
  coverage: {
    target: 'all-cantons',
    sinceYearMin: 2020,
    totalCantons: cantons.length,
    byReadiness,
    byAdapter,
    unresolvedCantons,
    sinceYearViolations,
    sinceYearCoverageGaps,
  },
  sources: sourceRows,
}

fs.writeFileSync(outPath, JSON.stringify(registry, null, 2))
console.log('Cantonal source registry built', {
  outPath: outPath.pathname,
  totalCantons: registry.coverage.totalCantons,
  byReadiness,
  probeCandidateLimit: PROBE_CANDIDATE_LIMIT,
  probeConcurrency: PROBE_CONCURRENCY,
})
