const toIso = (value) => {
  if (!value) return null
  if (typeof value === 'string') {
    const ms = value.match(/\/Date\((\d+)\)\//)
    if (ms) return new Date(Number(ms[1])).toISOString()
    const d = new Date(value)
    if (!Number.isNaN(d.getTime())) return d.toISOString()
  }
  return null
}

const stripHtml = (value = '') => String(value).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

const mapLanguage = (lang) => {
  const normalized = String(lang || '').toLowerCase()
  if (normalized === 'fr') return 'fr'
  if (normalized === 'it') return 'it'
  if (normalized === 'en') return 'en'
  return 'de'
}

const pickRows = (payload) => {
  if (Array.isArray(payload?.d)) return payload.d
  if (Array.isArray(payload?.d?.results)) return payload.d.results
  if (Array.isArray(payload?.value)) return payload.value
  return []
}

const parseCsvOption = (value) => String(value || '')
  .split(',')
  .map((x) => x.trim())
  .filter(Boolean)

const normalize = (value = '') => String(value)
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^\p{L}\p{N}]+/gu, ' ')
  .trim()

const BUSINESS_TYPE_ALIASES = {
  motion: ['motion', 'mozione'],
  postulat: ['postulat', 'postulato'],
  interpellation: ['interpellation', 'interpellanza'],
  anfrage: ['anfrage', 'frage', 'question', 'questione'],
}

const buildBusinessTypeMatchers = (includes = []) => {
  const normalized = includes.map((v) => normalize(v)).filter(Boolean)
  const expanded = new Set()
  for (const token of normalized) {
    expanded.add(token)
    for (const [key, variants] of Object.entries(BUSINESS_TYPE_ALIASES)) {
      if (token.includes(key) || variants.some((v) => token.includes(v))) {
        variants.forEach((v) => expanded.add(v))
      }
    }
  }
  return [...expanded]
}

const langPreference = ['de', 'fr', 'it', 'en']

const pickBestVariant = (variants = {}) => {
  for (const lang of langPreference) {
    if (variants[lang]) return variants[lang]
  }
  return Object.values(variants)[0]
}

const mergeAbortSignals = (...signals) => {
  const valid = signals.filter(Boolean)
  if (!valid.length) return undefined
  const controller = new AbortController()
  const abortFrom = (source) => {
    if (!controller.signal.aborted) controller.abort(source?.reason)
  }

  for (const signal of valid) {
    if (signal.aborted) {
      abortFrom(signal)
      break
    }
    signal.addEventListener('abort', () => abortFrom(signal), { once: true })
  }

  return controller.signal
}

export function createParliamentOdataV2Adapter() {
  return {
    async fetch(source, { signal, timeoutMs } = {}) {
      const languages = parseCsvOption(source.options?.langs || 'DE,FR,IT')
      const top = Number(source.options?.top ?? 900)
      const daysBack = Number(source.options?.daysBack ?? 3650)
      const sourceBudgetMs = Math.max(15000, Number(timeoutMs || 0) || 0)
      const requestTimeoutMs = Math.max(8000, Number(source.options?.requestTimeoutMs ?? Math.min(45000, sourceBudgetMs || 30000)))
      const businessTypeIncludes = parseCsvOption(source.options?.businessTypeIncludes)
      const businessTypeMatchers = buildBusinessTypeMatchers(businessTypeIncludes)
      const since = new Date(Date.now() - daysBack * 86400000).toISOString().slice(0, 19)

      const select = [
        'ID', 'Language', 'BusinessShortNumber', 'BusinessTypeName', 'Title', 'Description', 'TagNames',
        'SubmissionDate', 'Modified', 'BusinessStatusText',
      ].join(',')

      const fetchRows = async (lang) => {
        const filter = `Language eq '${lang}' and Modified ge datetime'${since}'`
        const params = new URLSearchParams({
          '$top': String(top),
          '$orderby': 'Modified desc',
          '$filter': filter,
          '$select': select,
          '$format': 'json',
        })
        const url = `${source.url}?${params.toString()}`
        const response = await fetch(url, {
          headers: { accept: 'application/json' },
          signal: mergeAbortSignals(signal, AbortSignal.timeout(requestTimeoutMs)),
        })
        if (!response.ok) throw new Error(`OData fetch failed (${response.status})`)
        const payload = await response.json()
        return pickRows(payload)
      }

      const byAffair = new Map()
      const fetchedAt = new Date().toISOString()

      const languageRuns = await Promise.allSettled(languages.map(async (rawLang) => ({
        rawLang,
        rows: await fetchRows(rawLang),
      })))

      const successfulRuns = languageRuns
        .filter((run) => run.status === 'fulfilled')
        .map((run) => run.value)

      if (!successfulRuns.length) {
        const reasons = languageRuns
          .map((run) => (run.status === 'rejected' ? String(run.reason?.message || run.reason) : null))
          .filter(Boolean)
        throw new Error(`OData fetch failed for all languages${reasons.length ? `: ${reasons.join(' | ')}` : ''}`)
      }

      for (const { rawLang, rows } of successfulRuns) {
        for (const row of rows) {
          if (!row?.ID || !row?.Title) continue
          if (businessTypeMatchers.length > 0) {
            const t = normalize(row.BusinessTypeName || '')
            if (!businessTypeMatchers.some((v) => t.includes(v))) continue
          }

          const lang = mapLanguage(row.Language || rawLang)
          const affairId = String(row.ID)
          const variant = {
            title: `${row.BusinessShortNumber ? `${row.BusinessShortNumber} · ` : ''}${stripHtml(row.Title)}`,
            summary: stripHtml(row.Description || row.BusinessStatusText || row.TagNames || '').slice(0, 420),
            body: stripHtml(`${row.Description || ''}\n${row.TagNames || ''}`),
            sourceUrl: `https://www.parlament.ch/de/ratsbetrieb/suche-curia-vista/geschaeft?AffairId=${affairId}`,
            publishedAt: toIso(row.SubmissionDate) || toIso(row.Modified),
            language: lang,
            businessTypeName: stripHtml(row.BusinessTypeName || ''),
          }

          const prev = byAffair.get(affairId) || {
            affairId,
            variants: {},
            latestPublishedAt: null,
          }

          prev.variants[lang] = variant
          const ts = Date.parse(variant.publishedAt || '')
          const prevTs = Date.parse(prev.latestPublishedAt || '')
          if (!Number.isNaN(ts) && (Number.isNaN(prevTs) || ts > prevTs)) {
            prev.latestPublishedAt = variant.publishedAt
          }
          byAffair.set(affairId, prev)
        }
      }

      return [...byAffair.values()].map((entry) => {
        const best = pickBestVariant(entry.variants)
        return {
          sourceId: source.id,
          sourceUrl: best?.sourceUrl || `https://www.parlament.ch/de/ratsbetrieb/suche-curia-vista/geschaeft?AffairId=${entry.affairId}`,
          externalId: entry.affairId,
          affairId: entry.affairId,
          title: best?.title || `Parlamentsgeschäft ${entry.affairId}`,
          summary: best?.summary || '',
          body: best?.body || '',
          publishedAt: entry.latestPublishedAt,
          fetchedAt,
          language: best?.language || 'de',
          languageVariants: entry.variants,
          score: 0,
          matchedKeywords: [],
          status: 'new',
          reviewReason: '',
        }
      })
    },
  }
}
