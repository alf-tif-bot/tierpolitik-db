import fs from 'node:fs'
import path from 'node:path'
import { withPgClient } from '../../crawler/db-postgres.mjs'

const initiativeLinksPath = path.resolve(process.cwd(), 'data/initiative-links.json')
const initiativeLinkMap = fs.existsSync(initiativeLinksPath)
  ? JSON.parse(fs.readFileSync(initiativeLinksPath, 'utf8'))
  : {}

const inferType = (title = '', sourceId = '') => {
  const text = `${title} ${sourceId}`.toLowerCase()
  if (text.includes('postulat')) return 'Postulat'
  if (text.includes('motion')) return 'Motion'
  if (text.includes('interpellation')) return 'Interpellation'
  if (text.includes('anfrage') || text.includes('frage')) return 'Anfrage'
  if (text.includes('initiative')) return 'Volksinitiative'
  return 'Interpellation'
}

const extractStance = (reason = '') => {
  const m = String(reason).match(/stance=([^·]+)/)
  return (m?.[1] || 'neutral/unklar').trim()
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

const buildInitiativeLinks = ({ typ, title, externalId, status }) => {
  if (typ !== 'Volksinitiative') return undefined

  const affairId = String(externalId || '').split('-')[0]
  const mapped = initiativeLinkMap[affairId] || {}
  const campaignUrl = mapped.campaignUrl
    || `https://duckduckgo.com/?q=${encodeURIComponent(`${title} Volksinitiative Kampagne`)}`

  const isPast = ['Angenommen', 'Abgelehnt', 'Abgeschrieben'].includes(status)
  const resultUrl = mapped.resultUrl
    || (isPast
      ? `https://www.admin.ch/gov/de/start/suche.html?query=${encodeURIComponent(`${title} Volksinitiative Abstimmungsresultat`)}`
      : undefined)

  return { campaignUrl, resultUrl }
}

const clean = (text = '') => String(text)
  .replace(/\s+/g, ' ')
  .replace(/^\s+|\s+$/g, '')

const firstSentence = (text = '') => {
  const c = clean(text)
  if (!c) return ''
  const m = c.match(/(.{40,220}?[.!?])\s/)
  if (m) return m[1]
  return c.slice(0, 220)
}

const summarizeVorstoss = ({ title = '', summary = '', body = '', status = '' }) => {
  const t = clean(title)
  const s = firstSentence(summary)
  const b = firstSentence(body)
  const src = s || b
  const low = `${t} ${summary} ${body}`.toLowerCase()

  if (low.includes('stopfleber') || low.includes('foie gras')) {
    return 'Der Vorstoss betrifft Import/Regulierung von Stopfleber (Foie gras) und konkretisiert die politische Umsetzung im Parlament.'
  }
  if (low.includes('tierversuch') || low.includes('3r') || low.includes('expérimentation animale')) {
    return 'Der Vorstoss behandelt Alternativen zu Tierversuchen (3R) und den Ausbau von Forschung, Ressourcen oder Anreizen.'
  }
  if (low.includes('wolf') || low.includes('wildtier') || low.includes('jagd') || low.includes('chasse')) {
    return 'Der Vorstoss betrifft Wildtierpolitik (z. B. Regulierung, Schutz oder Jagd) und hat direkte Relevanz für den Tierschutzkontext.'
  }
  if (src) return src

  const statusLabel = status === 'approved' ? 'in Beratung' : status === 'published' ? 'abgeschlossen' : 'eingereicht'
  return `Parlamentarischer Vorstoss im Bereich Tierpolitik (${statusLabel}); Detailtext wird aus dem Originalgeschäft ergänzt.`
}

export const handler = async () => {
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
          mv.summary,
          mv.body
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
      const stance = extractStance(r.review_reason)
      const idSafe = String(r.external_id || `${Date.now()}-${index}`).replace(/[^a-zA-Z0-9-]/g, '-')
      const affairId = String(r.external_id || '').split('-')[0]
      const link = String(r.source_url || '').startsWith('http')
        ? r.source_url
        : `https://www.parlament.ch/de/ratsbetrieb/suche-curia-vista/geschaeft?AffairId=${affairId}`
      const typ = inferType(r.title || '', r.source_id || '')
      const statusLabel = mapStatus(r.status)
      const initiativeLinks = buildInitiativeLinks({
        typ,
        title: r.title,
        externalId: r.external_id,
        status: statusLabel,
      })

      return {
        id: `vp-${idSafe.toLowerCase()}`,
        titel: r.title || `Vorstoss ${index + 1}`,
        typ,
        kurzbeschreibung: summarizeVorstoss({
          title: r.title,
          summary: r.summary,
          body: r.body,
          status: r.status,
        }),
        geschaeftsnummer: String(r.external_id || `AUTO-${index + 1}`),
        ebene: 'Bund',
        kanton: null,
        regionGemeinde: null,
        status: statusLabel,
        datumEingereicht: eingereicht,
        datumAktualisiert: updated,
        themen: [
          ...(Array.isArray(r.matched_keywords) && r.matched_keywords.length ? r.matched_keywords : ['Tierschutz']),
          stance === 'pro-tierschutz' ? 'Pro Tierschutz' : stance === 'tierschutzkritisch' ? 'Tierschutzkritisch' : 'Neutral/Unklar',
        ].slice(0, 6),
        schlagwoerter: (Array.isArray(r.matched_keywords) && r.matched_keywords.length ? r.matched_keywords : ['Tierpolitik']).slice(0, 8),
        einreichende: [personByLang[sprache]],
        linkGeschaeft: link,
        resultate: [{ datum: eingereicht, status: statusLabel, bemerkung: `Status aus DB: ${r.status}` }],
        medien: [],
        metadaten: { sprache, haltung: stance, initiativeLinks, zuletztGeprueftVon: 'DB Live API' },
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

export default handler
