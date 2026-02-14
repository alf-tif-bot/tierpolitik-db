import fs from 'node:fs'

const cantonsPath = new URL('../crawler/config.cantonal-sources.json', import.meta.url)
const outPath = new URL('../data/cantonal-source-registry.json', import.meta.url)

const cantons = JSON.parse(fs.readFileSync(cantonsPath, 'utf8'))

const detectPlatform = (url = '', html = '') => {
  const u = String(url).toLowerCase()
  const h = String(html).toLowerCase()
  if (u.includes('ratsinfo') || h.includes('ratsinfo')) return 'ratsinfo'
  if (u.includes('aio') || h.includes('allris') || h.includes('sessionnet')) return 'allris/sessionnet'
  if (h.includes('traktanden') || h.includes('geschaefte') || h.includes('vorstoesse')) return 'parliament-portal'
  if (h.includes('drupal')) return 'drupal-site'
  if (h.includes('typo3')) return 'typo3-site'
  if (h.includes('wordpress')) return 'wordpress-site'
  return 'generic-site'
}

const classifyReadiness = ({ url = '', platform = 'generic-site', ok = false, httpStatus = null }) => {
  const u = String(url).toLowerCase()
  if (!ok) {
    if (httpStatus === 403 || httpStatus === 429) return 'blocked-needs-manual'
    return 'unreachable-needs-manual'
  }
  if (platform === 'ratsinfo' || platform === 'allris/sessionnet') return 'adapter-ready-likely'
  if (u.includes('parlament') || u.includes('kantonsrat') || platform === 'parliament-portal') return 'site-discovery-needed'
  return 'manual-discovery-needed'
}

const probeSource = async (url) => {
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      headers: { 'user-agent': 'tierpolitik-crawler-registry/1.0 (+night-shift)' },
      signal: AbortSignal.timeout(18000),
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

const sourceRows = await Promise.all(cantons.map(async (entry) => {
  const probe = await probeSource(entry.url)
  const readiness = classifyReadiness({
    url: probe.finalUrl || entry.url,
    platform: probe.platform,
    ok: probe.ok,
    httpStatus: probe.httpStatus,
  })

  return {
    id: `ch-canton-${String(entry.canton).toLowerCase()}`,
    canton: entry.canton,
    parliament: entry.parliament,
    adapter: entry.adapter,
    url: entry.url,
    sinceYear: entry.sinceYear,
    status: probe.ok ? 'scaffolded' : 'probe-failed',
    readiness,
    probe: {
      checkedAt: new Date().toISOString(),
      ok: probe.ok,
      httpStatus: probe.httpStatus,
      finalUrl: probe.finalUrl,
      platform: probe.platform,
      error: probe.error || null,
    },
  }
}))

const byReadiness = sourceRows.reduce((acc, row) => {
  acc[row.readiness] = (acc[row.readiness] || 0) + 1
  return acc
}, {})

const registry = {
  generatedAt: new Date().toISOString(),
  coverage: {
    target: 'all-cantons',
    sinceYearMin: 2020,
    totalCantons: cantons.length,
    byReadiness,
  },
  sources: sourceRows,
}

fs.writeFileSync(outPath, JSON.stringify(registry, null, 2))
console.log('Cantonal source registry built', {
  outPath: outPath.pathname,
  totalCantons: registry.coverage.totalCantons,
  byReadiness,
})
