const toIso = (value) => {
  if (!value) return null
  if (typeof value === 'string') {
    const ms = value.match(/\/Date\((\d+)\)\//)
    if (ms) return new Date(Number(ms[1])).toISOString()
    const d = new Date(value)
    if (!Number.isNaN(d.getTime())) return d.toISOString()
    return null
  }
  return null
}

const stripHtml = (value = '') => String(value).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

const slugify = (value) => String(value || '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/(^-|-$)/g, '')

const pickRows = (payload) => {
  if (Array.isArray(payload?.d)) return payload.d
  if (Array.isArray(payload?.d?.results)) return payload.d.results
  if (Array.isArray(payload?.value)) return payload.value
  return []
}

export function createParliamentOdataAdapter() {
  return {
    async fetch(source) {
      const top = source.options?.top ?? 80
      const lang = source.options?.lang ?? 'DE'
      const daysBack = source.options?.daysBack ?? 45
      const since = new Date(Date.now() - daysBack * 86400000).toISOString().slice(0, 19)
      const select = [
        'ID', 'Language', 'BusinessShortNumber', 'BusinessTypeName', 'Title', 'Description', 'TagNames',
        'SubmissionDate', 'Modified', 'BusinessStatusText'
      ].join(',')

      const params = new URLSearchParams({
        '$top': String(top),
        '$orderby': 'Modified desc',
        '$filter': `Language eq '${lang}' and Modified ge datetime'${since}'`,
        '$select': select,
        '$format': 'json',
      })
      const url = `${source.url}?${params.toString()}`
      const response = await fetch(url, { headers: { accept: 'application/json' } })
      if (!response.ok) throw new Error(`OData fetch failed (${response.status})`)
      const payload = await response.json()
      const rows = pickRows(payload)
      const fetchedAt = new Date().toISOString()

      return rows
        .filter((row) => row?.ID && row?.Title)
        .map((row) => {
          const summary = stripHtml(row.Description || row.BusinessStatusText || row.TagNames || '')
          const shortNo = row.BusinessShortNumber ? `${row.BusinessShortNumber} · ` : ''
          return {
            sourceId: source.id,
            sourceUrl: `https://www.parlament.ch/de/ratsbetrieb/suche-curia-vista/geschaeft?AffairId=${row.ID}`,
            externalId: slugify(`${row.ID}-${row.Language || lang}`),
            title: `${shortNo}${stripHtml(row.Title)}`,
            summary: summary.slice(0, 420),
            body: stripHtml(`${row.Description || ''}\n${row.TagNames || ''}`),
            publishedAt: toIso(row.SubmissionDate) || toIso(row.Modified),
            fetchedAt,
            language: (row.Language || lang).toLowerCase() === 'fr' ? 'fr' : 'de',
            score: 0,
            matchedKeywords: [],
            status: 'new',
            reviewReason: '',
          }
        })
    },
  }
}
