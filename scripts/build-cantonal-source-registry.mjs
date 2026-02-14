import fs from 'node:fs'

const cantonsPath = new URL('../crawler/config.cantonal-sources.json', import.meta.url)
const outPath = new URL('../data/cantonal-source-registry.json', import.meta.url)

const cantons = JSON.parse(fs.readFileSync(cantonsPath, 'utf8'))

const PARLIAMENT_URL_HINTS = [
  '/objets-parlementaires',
  '/interventions-parlementaires',
  '/objets-et-rapports-de-commissions',
  '/recherche-objets',
  '/ricerca-messaggi-e-atti',
  '/grandconseil/',
]

const detectPlatform = (url = '', html = '') => {
  const u = String(url).toLowerCase()
  const h = String(html).toLowerCase()
  if (h.includes('verifying your browser') || h.includes('vérification de votre navigateur')) return 'waf-challenge'
  if (u.includes('ratsinfo') || h.includes('ratsinfo')) return 'ratsinfo'
  if (u.includes('parlinfo') || h.includes('parlinfo') || u.includes('/grweb/')) return 'parliament-portal'
  if (u.includes('aio') || h.includes('allris') || h.includes('sessionnet')) return 'allris/sessionnet'
  if (PARLIAMENT_URL_HINTS.some((hint) => u.includes(hint))) return 'parliament-portal'
  if (h.includes('traktanden') || h.includes('geschaefte') || h.includes('vorstoesse') || h.includes('objets parlementaires')) return 'parliament-portal'
  if (h.includes('drupal')) return 'drupal-site'
  if (h.includes('typo3')) return 'typo3-site'
  if (h.includes('wordpress')) return 'wordpress-site'
  return 'generic-site'
}

const classifyReadiness = ({ url = '', platform = 'generic-site', ok = false, httpStatus = null }) => {
  const u = String(url).toLowerCase()
  const hasParliamentHint = [
    'parlament',
    'kantonsrat',
    'grandconseil',
    'objets-parlementaires',
    'interventions-parlementaires',
    'objets-et-rapports-de-commissions',
    'ricerca-messaggi-e-atti',
  ].some((hint) => u.includes(hint))

  if (!ok || platform === 'waf-challenge') {
    if (httpStatus === 403 || httpStatus === 429 || platform === 'waf-challenge') return 'blocked-needs-manual'
    return 'unreachable-needs-manual'
  }
  if (platform === 'ratsinfo' || platform === 'allris/sessionnet') return 'adapter-ready-likely'
  if (platform === 'parliament-portal' || (['typo3-site', 'drupal-site'].includes(platform) && hasParliamentHint) || hasParliamentHint) {
    return 'site-discovery-needed'
  }
  return 'manual-discovery-needed'
}

const normalizeBase = (value) => String(value || '').replace(/\/+$/, '')

const buildCandidates = (entry) => {
  const configured = Array.isArray(entry.urlCandidates)
    ? entry.urlCandidates.map((u) => String(u || '').trim()).filter(Boolean)
    : []

  const base = normalizeBase(entry.url)
  const alternateHost = base.startsWith('https://www.')
    ? base.replace('https://www.', 'https://')
    : (base.startsWith('https://') ? base.replace('https://', 'https://www.') : base)

  const heuristics = [
    base,
    alternateHost,
    `${base}/parlament`,
    `${base}/kantonsrat`,
    `${base}/grand-conseil`,
    `${alternateHost}/parlament`,
  ]

  return [...new Set([...configured, ...heuristics].filter(Boolean))]
}

const probeSource = async (url) => {
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      headers: { 'user-agent': 'tierpolitik-crawler-registry/1.1 (+night-shift)' },
      signal: AbortSignal.timeout(7000),
    })
    const text = await response.text()
    const platform = detectPlatform(url, text)
    return {
      ok: response.ok,
      httpStatus: response.status,
      finalUrl: response.url,
      platform,
    }
  } catch (error) {
    return {
      ok: false,
      httpStatus: null,
      finalUrl: url,
      platform: 'unreachable',
      error: String(error?.message || error),
    }
  }
}

const probeQuality = (probe) => {
  if (!probe.ok) {
    if (probe.httpStatus === 403 || probe.httpStatus === 429) return 1
    return 0
  }
  let score = 5
  if (probe.platform === 'ratsinfo' || probe.platform === 'allris/sessionnet') score += 4
  if (probe.platform === 'parliament-portal') score += 2
  if (probe.finalUrl && probe.finalUrl !== probe.url) score += 1
  return score
}

const selectBestProbe = (probes) => {
  if (!probes.length) return null
  return [...probes].sort((a, b) => probeQuality(b) - probeQuality(a))[0]
}

const sourceRows = await Promise.all(cantons.map(async (entry) => {
  const candidates = buildCandidates(entry)
  const probes = []
  for (const candidateUrl of candidates.slice(0, 3)) {
    const probe = await probeSource(candidateUrl)
    probes.push({ ...probe, url: candidateUrl })
    if (probe.ok && ['ratsinfo', 'allris/sessionnet', 'parliament-portal'].includes(probe.platform)) break
  }

  const bestProbe = selectBestProbe(probes) || {
    ok: false,
    httpStatus: null,
    finalUrl: entry.url,
    platform: 'unreachable',
    error: 'no-probe',
    url: entry.url,
  }

  const readiness = classifyReadiness({
    url: bestProbe.finalUrl || entry.url,
    platform: bestProbe.platform,
    ok: bestProbe.ok,
    httpStatus: bestProbe.httpStatus,
  })

  return {
    id: `ch-canton-${String(entry.canton).toLowerCase()}`,
    canton: entry.canton,
    parliament: entry.parliament,
    adapter: entry.adapter,
    url: entry.url,
    sinceYear: entry.sinceYear,
    status: bestProbe.ok ? 'scaffolded' : 'probe-failed',
    readiness,
    probe: {
      checkedAt: new Date().toISOString(),
      ok: bestProbe.ok,
      httpStatus: bestProbe.httpStatus,
      finalUrl: bestProbe.finalUrl,
      platform: bestProbe.platform,
      error: bestProbe.error || null,
      candidateCount: candidates.length,
      candidatesTried: probes.map((p) => ({
        url: p.url,
        ok: p.ok,
        httpStatus: p.httpStatus,
        finalUrl: p.finalUrl,
        platform: p.platform,
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
  },
  sources: sourceRows,
}

fs.writeFileSync(outPath, JSON.stringify(registry, null, 2))
console.log('Cantonal source registry built', {
  outPath: outPath.pathname,
  totalCantons: registry.coverage.totalCantons,
  byReadiness,
})
