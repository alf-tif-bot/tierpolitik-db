import { withPgClient } from '../../crawler/db-postgres.mjs'

const inferType = (title = '', sourceId = '') => {
  const text = `${title} ${sourceId}`.toLowerCase()
  if (text.includes('postulat')) return 'Postulat'
  if (text.includes('motion')) return 'Motion'
  if (text.includes('interpellation')) return 'Interpellation'
  if (text.includes('anfrage') || text.includes('frage')) return 'Anfrage'
  if (text.includes('initiative')) return 'Volksinitiative'
  return 'Interpellation'
}

const mapStatus = (status = '') => {
  const s = String(status).toLowerCase()
  if (s === 'published') return 'Angenommen'
  if (s === 'approved') return 'In Beratung'
  if (s === 'rejected') return 'Abgelehnt'
  return 'Eingereicht'
}

const toIsoDate = (value) => {
  if (!value) return new Date().toISOString().slice(0, 10)
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 10)
  return d.toISOString().slice(0, 10)
}

const langFromSource = (sourceId = '') => {
  const low = String(sourceId).toLowerCase()
  if (low.endsWith('-fr')) return 'fr'
  if (low.endsWith('-it')) return 'it'
  return 'de'
}

const personByLang = {
  de: { name: 'Parlamentsdienst', rolle: 'Nationalrat', partei: 'Überparteilich' },
  fr: { name: 'Service parlementaire', rolle: 'Nationalrat', partei: 'Überparteilich' },
  it: { name: 'Servizio parlamentare', rolle: 'Nationalrat', partei: 'Überparteilich' },
}

export default async () => {
  try {
    const rows = await withPgClient(async (client) => {
      const res = await client.query(`
        select
          m.source_id,
          m.external_id,
          m.source_url,
          m.status,
          m.review_reason,
          m.published_at,
          m.fetched_at,
          m.matched_keywords,
          mv.title,
          mv.summary
        from motions m
        left join lateral (
          select title, summary
          from motion_versions mv
          where mv.motion_id = m.id
          order by mv.version_no desc
          limit 1
        ) mv on true
        where m.status in ('approved','published')
          and m.source_id like 'ch-parliament-%'
        order by m.updated_at desc
        limit 1200
      `)
      return res.rows
    })

    const mapped = rows.map((r, index) => {
      const sprache = langFromSource(r.source_id)
      const eingereicht = toIsoDate(r.published_at || r.fetched_at)
      const updated = toIsoDate(r.fetched_at || r.published_at)
      const idSafe = String(r.external_id || `${Date.now()}-${index}`).replace(/[^a-zA-Z0-9-]/g, '-')
      const affairId = String(r.external_id || '').split('-')[0]
      const link = String(r.source_url || '').startsWith('http')
        ? r.source_url
        : `https://www.parlament.ch/de/ratsbetrieb/suche-curia-vista/geschaeft?AffairId=${affairId}`

      return {
        id: `vp-${idSafe.toLowerCase()}`,
        titel: r.title || `Vorstoss ${index + 1}`,
        typ: inferType(r.title || '', r.source_id || ''),
        kurzbeschreibung: r.summary || r.review_reason || 'Automatisch aus DB geladen.',
        geschaeftsnummer: String(r.external_id || `AUTO-${index + 1}`),
        ebene: 'Bund',
        kanton: null,
        regionGemeinde: null,
        status: mapStatus(r.status),
        datumEingereicht: eingereicht,
        datumAktualisiert: updated,
        themen: (Array.isArray(r.matched_keywords) && r.matched_keywords.length ? r.matched_keywords : ['Tierschutz']).slice(0, 5),
        schlagwoerter: (Array.isArray(r.matched_keywords) && r.matched_keywords.length ? r.matched_keywords : ['Tierpolitik']).slice(0, 8),
        einreichende: [personByLang[sprache]],
        linkGeschaeft: link,
        resultate: [{ datum: eingereicht, status: mapStatus(r.status), bemerkung: `Status aus DB: ${r.status}` }],
        medien: [],
        metadaten: { sprache, zuletztGeprueftVon: 'DB Live API' },
      }
    })

    return {
      statusCode: 200,
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify(mapped),
    }
  } catch (error) {
    return {
      statusCode: 500,
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ error: error.message || 'home-data failed' }),
    }
  }
}
