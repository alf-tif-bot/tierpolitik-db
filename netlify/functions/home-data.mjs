import fs from 'node:fs'
import path from 'node:path'
import { withPgClient } from '../../crawler/db-postgres.mjs'

const initiativeLinksPath = path.resolve(process.cwd(), 'data/initiative-links.json')
const vorstoessePath = path.resolve(process.cwd(), 'data/vorstoesse.json')
const initiativeLinkMap = fs.existsSync(initiativeLinksPath)
  ? JSON.parse(fs.readFileSync(initiativeLinksPath, 'utf8'))
  : {}
const fallbackVorstoesse = fs.existsSync(vorstoessePath)
  ? JSON.parse(fs.readFileSync(vorstoessePath, 'utf8'))
  : []

const inferType = (title = '', sourceId = '') => {
  const text = `${title} ${sourceId}`.toLowerCase()
  if (text.includes('postulat')) return 'Postulat'
  if (text.includes('motion')) return 'Motion'
  if (text.includes('interpellation')) return 'Interpellation'
  if (text.includes('anfrage') || text.includes('frage')) return 'Anfrage'
  if (text.includes('initiative')) return 'Volksinitiative'
  return 'Interpellation'
}

const extractStance = (reason = '', title = '', summary = '', body = '') => {
  const text = `${title} ${summary} ${body}`.toLowerCase()
  if (text.includes('stopfleber') || text.includes('foie gras')) return 'pro-tierschutz'
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

const langRank = (lang = 'de') => {
  if (lang === 'de') return 0
  if (lang === 'fr') return 1
  if (lang === 'it') return 2
  return 3
}

const fallbackPersonByLang = {
  de: { name: 'Parlamentsgeschäft (Bund)', rolle: 'Nationalrat', partei: 'Überparteilich' },
  fr: { name: 'Objet parlementaire (Confédération)', rolle: 'Nationalrat', partei: 'Überparteilich' },
  it: { name: 'Atto parlamentare (Confederazione)', rolle: 'Nationalrat', partei: 'Überparteilich' },
}

const inferSubmitter = (lang, title = '', summary = '', body = '') => {
  const text = `${title} ${summary} ${body}`.toLowerCase()
  if (text.includes('blv') || text.includes('lebensmittelsicherheit') || text.includes('veterinärwesen')) {
    return { name: 'BLV', rolle: 'Regierung', partei: 'Bundesverwaltung' }
  }
  if (text.includes('bundesrat') || text.includes('message du conseil fédéral') || text.includes('messaggio del consiglio federale')) {
    return { name: 'Bundesrat', rolle: 'Regierung', partei: 'Bundesrat' }
  }
  if (text.includes('kommission')) {
    return { name: 'Parlamentarische Kommission', rolle: 'Nationalrat', partei: 'Überparteilich' }
  }
  return fallbackPersonByLang[lang] || fallbackPersonByLang.de
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

const THEME_EXCLUDE = new Set(['botschaft'])
const sanitizeThemes = (arr = []) => arr
  .map((x) => String(x || '').trim())
  .filter((x) => x && !THEME_EXCLUDE.has(x.toLowerCase()))

const firstSentence = (text = '') => {
  const c = clean(text)
  if (!c) return ''
  const low = c.toLowerCase()
  if (
    low.includes('stellungnahme zum vorstoss liegt vor')
    || low.includes('beratung in kommission')
    || low.includes('erledigt')
  ) return ''
  const m = c.match(/(.{40,220}?[.!?])\s/)
  if (m) return m[1]
  return c.slice(0, 220)
}

const summarizeVorstoss = ({ title = '', summary = '', body = '', status = '' }) => {
  const t = clean(title)
  const s = firstSentence(summary)
  const b = firstSentence(body)
  const low = `${t} ${summary} ${body}`.toLowerCase()
  const statusLabel = status === 'approved' ? 'in Beratung' : status === 'published' ? 'abgeschlossen' : 'eingereicht'

  const sentences = []

  if (low.includes('stopfleber') || low.includes('foie gras')) {
    sentences.push('Dieser Vorstoss betrifft die Stopfleber-Thematik (Foie gras) und die politische Umsetzung eines Importverbots bzw. eines indirekten Gegenentwurfs.')
    sentences.push('Im Zentrum steht, wie streng der Schutz von Tieren in der Produktions- und Importkette rechtlich ausgestaltet werden soll.')
  } else if (low.includes('tierversuch') || low.includes('3r') || low.includes('expérimentation animale')) {
    sentences.push('Dieser Vorstoss behandelt Alternativen zu Tierversuchen (3R) und die Frage, wie Forschung gezielt in tierfreie bzw. tierärmere Methoden gelenkt werden kann.')
    sentences.push('Diskutiert werden typischerweise Ressourcen, Anreize und konkrete Umsetzungsmechanismen im Forschungsbereich.')
  } else if (low.includes('wolf') || low.includes('wildtier') || low.includes('jagd') || low.includes('chasse')) {
    sentences.push('Dieser Vorstoss betrifft die Wildtierpolitik, insbesondere das Spannungsfeld zwischen Schutz, Regulierung und Jagd.')
    sentences.push('Für die Einordnung ist zentral, ob die vorgeschlagenen Massnahmen den Schutzstatus stärken oder Eingriffe ausweiten.')
  }

  if (s) sentences.push(s)
  if (b && b !== s) sentences.push(b)

  const unique = []
  const seen = new Set()
  for (const line of sentences) {
    const key = clean(line).toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    unique.push(line)
  }

  return unique
    .slice(0, 3)
    .join(' ')
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
          select title, summary, ''::text as body
          from motion_versions mv
          where mv.motion_id = m.id
          order by mv.version_no desc
          limit 1
        ) mv on true
        where m.status in ('approved','published','rejected')
          and m.source_id like 'ch-parliament-%'
          and coalesce(m.published_at, m.fetched_at) >= (now() - interval '5 years')
        order by m.updated_at desc
        limit 1200
      `)
      return res.rows
    })

    const affairIds = [...new Set(rows.map((r) => String(r.external_id || '').split('-')[0]).filter(Boolean))]

    const deRows = affairIds.length
      ? await withPgClient(async (client) => {
        const res = await client.query(
          `select m.external_id, mv.title, mv.summary, mv.body
           from motions m
           left join lateral (
             select title, summary, ''::text as body
             from motion_versions mv
             where mv.motion_id = m.id
             order by mv.version_no desc
             limit 1
           ) mv on true
           where m.source_id like 'ch-parliament-%-de'
             and split_part(m.external_id, '-', 1) = any($1::text[])
           order by m.updated_at desc`,
          [affairIds],
        )
        return res.rows
      })
      : []

    const deByAffair = new Map()
    for (const row of deRows) {
      const affairId = String(row.external_id || '').split('-')[0]
      if (!deByAffair.has(affairId)) deByAffair.set(affairId, row)
    }

    const grouped = new Map()
    for (const row of rows) {
      const affairId = String(row.external_id || '').split('-')[0]
      const lang = langFromSource(row.source_id)
      const prev = grouped.get(affairId)
      if (!prev) {
        grouped.set(affairId, row)
        continue
      }
      const prevLang = langFromSource(prev.source_id)
      const betterLang = langRank(lang) < langRank(prevLang)
      const newer = new Date(row.fetched_at || row.published_at || 0).getTime() > new Date(prev.fetched_at || prev.published_at || 0).getTime()
      if (betterLang || (!betterLang && newer)) grouped.set(affairId, row)
    }

    const dedupedRows = [...grouped.values()]

    const mapped = dedupedRows.map((r, index) => {
      const sprache = langFromSource(r.source_id)
      const affairId = String(r.external_id || '').split('-')[0]
      const deVariant = deByAffair.get(affairId)
      const displayTitle = deVariant?.title || r.title
      const displaySummary = deVariant?.summary || r.summary
      const displayBody = deVariant?.body || r.body
      const eingereicht = toIsoDate(r.published_at || r.fetched_at)
      const updated = toIsoDate(r.fetched_at || r.published_at)
      const stance = extractStance(r.review_reason, displayTitle, displaySummary, displayBody)
      const idSafe = String(r.external_id || `${Date.now()}-${index}`).replace(/[^a-zA-Z0-9-]/g, '-')
      const link = String(r.source_url || '').startsWith('http')
        ? r.source_url
        : `https://www.parlament.ch/de/ratsbetrieb/suche-curia-vista/geschaeft?AffairId=${affairId}`
      const typ = inferType(displayTitle || '', r.source_id || '')
      const statusLabel = mapStatus(r.status)
      const initiativeLinks = buildInitiativeLinks({
        typ,
        title: displayTitle,
        externalId: r.external_id,
        status: statusLabel,
      })

      const normalizedSummary = clean(summarizeVorstoss({
        title: displayTitle,
        summary: displaySummary,
        body: displayBody,
        status: r.status,
      }))
      const summaryText = normalizedSummary.length >= 10
        ? normalizedSummary
        : `Kurzüberblick: ${displayTitle || `Vorstoss ${index + 1}`} (${statusLabel}).`

      return {
        id: `vp-${idSafe.toLowerCase()}`,
        titel: displayTitle || `Vorstoss ${index + 1}`,
        typ,
        kurzbeschreibung: summaryText,
        geschaeftsnummer: String(r.external_id || `AUTO-${index + 1}`),
        ebene: 'Bund',
        kanton: null,
        regionGemeinde: null,
        status: statusLabel,
        datumEingereicht: eingereicht,
        datumAktualisiert: updated,
        themen: sanitizeThemes(Array.isArray(r.matched_keywords) && r.matched_keywords.length ? r.matched_keywords : ['Tierschutz']).slice(0, 6),
        schlagwoerter: (Array.isArray(r.matched_keywords) && r.matched_keywords.length ? r.matched_keywords : ['Tierpolitik']).slice(0, 8),
        einreichende: [inferSubmitter(sprache, displayTitle, displaySummary, displayBody)],
        linkGeschaeft: link,
        resultate: [{ datum: eingereicht, status: statusLabel, bemerkung: 'Stand gemäss Parlamentsdaten' }],
        medien: [],
        metadaten: { sprache, haltung: stance, initiativeLinks, zuletztGeprueftVon: 'DB Live API' },
      }
    })

    const minimumRows = Math.max(20, Math.min(60, fallbackVorstoesse.length || 20))
    const payload = mapped.length >= minimumRows ? mapped : fallbackVorstoesse

    return {
      statusCode: 200,
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify(payload),
    }
  } catch {
    return {
      statusCode: 200,
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify(fallbackVorstoesse),
    }
  }
}

export default handler
