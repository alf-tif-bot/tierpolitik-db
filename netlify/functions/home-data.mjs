import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { withPgClient } from '../../crawler/db-postgres.mjs'

const require = createRequire(import.meta.url)

const initiativeLinksPath = path.resolve(process.cwd(), 'data/initiative-links.json')
const vorstoessePath = path.resolve(process.cwd(), 'data/vorstoesse.json')
const initiativeLinkMap = fs.existsSync(initiativeLinksPath)
  ? JSON.parse(fs.readFileSync(initiativeLinksPath, 'utf8'))
  : {}

let fallbackVorstoesse = []
try {
  if (fs.existsSync(vorstoessePath)) {
    fallbackVorstoesse = JSON.parse(fs.readFileSync(vorstoessePath, 'utf8'))
  }
} catch {
  // ignore and try bundled fallback below
}

if (!Array.isArray(fallbackVorstoesse) || !fallbackVorstoesse.length) {
  try {
    const bundled = require('../../data/vorstoesse.json')
    fallbackVorstoesse = Array.isArray(bundled) ? bundled : []
  } catch {
    fallbackVorstoesse = []
  }
}

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

const toIsoDate = (value, fallbackYear) => {
  const d = value ? new Date(value) : null
  const base = d && !Number.isNaN(d.getTime()) ? d : null

  if (base) {
    let year = base.getUTCFullYear()
    if (fallbackYear && Number.isFinite(fallbackYear) && Math.abs(year - fallbackYear) >= 2) {
      year = fallbackYear
    }
    const month = String(base.getUTCMonth() + 1).padStart(2, '0')
    const day = String(base.getUTCDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  if (fallbackYear && Number.isFinite(fallbackYear)) return `${fallbackYear}-01-01`
  return new Date().toISOString().slice(0, 10)
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

const typeLabels = {
  Volksinitiative: { de: 'Volksinitiative', fr: 'Initiative populaire', it: 'Iniziativa popolare', en: 'Popular initiative' },
  Interpellation: { de: 'Interpellation', fr: 'Interpellation', it: 'Interpellanza', en: 'Interpellation' },
  Motion: { de: 'Motion', fr: 'Motion', it: 'Mozione', en: 'Motion' },
  Postulat: { de: 'Postulat', fr: 'Postulat', it: 'Postulato', en: 'Postulate' },
  Anfrage: { de: 'Anfrage', fr: 'Question', it: 'Interrogazione', en: 'Question' },
}

const inferYearFromBusiness = (title = '', externalId = '') => {
  const titleMatch = String(title || '').match(/^\s*(\d{2})\.(\d{2,4})\b/)
  if (titleMatch?.[1]) {
    const yy = Number(titleMatch[1])
    return yy >= 70 ? 1900 + yy : 2000 + yy
  }

  const num = String(externalId || '').split('-')[0]
  const exMatch = num.match(/^(\d{4})\d{2,4}$/)
  if (exMatch?.[1]) return Number(exMatch[1])
  return undefined
}

const fallbackPersonByLang = {
  de: { name: 'Parlamentsgeschäft (Bund)', rolle: 'Nationalrat', partei: 'Überparteilich' },
  fr: { name: 'Objet parlementaire (Confédération)', rolle: 'Nationalrat', partei: 'Überparteilich' },
  it: { name: 'Atto parlamentare (Confederazione)', rolle: 'Nationalrat', partei: 'Überparteilich' },
}

const parseMunicipalSubmitters = (body = '') => {
  const m = String(body || '').match(/eingereicht von:\s*([^\n]+)/i)
  if (!m?.[1]) return []
  return m[1]
    .split(',')
    .map((x) => String(x || '').replace(/\s+/g, ' ').trim())
    .filter((x) => x.length >= 3)
    .slice(0, 6)
    .map((entry) => {
      const withParty = entry.match(/^(.+?)\s*\(([^)]+)\)$/)
      if (withParty) {
        return { name: withParty[1].trim(), rolle: 'Gemeinderat', partei: withParty[2].trim() }
      }
      return { name: entry, rolle: 'Gemeinderat', partei: '' }
    })
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

const buildInitiativeLinks = ({ typ, externalId }) => {
  if (typ !== 'Volksinitiative') return undefined

  const affairId = String(externalId || '').split('-')[0]
  const mapped = initiativeLinkMap[affairId] || {}
  const campaignUrl = String(mapped.campaignUrl || '').trim()
  const resultUrl = String(mapped.resultUrl || '').trim()

  if (!campaignUrl && !resultUrl) return undefined
  return {
    ...(campaignUrl ? { campaignUrl } : {}),
    ...(resultUrl ? { resultUrl } : {}),
  }
}

const clean = (text = '') => String(text)
  .replace(/\s+/g, ' ')
  .replace(/^\s+|\s+$/g, '')

const normalizeDisplayTitle = (row, title = '') => {
  let t = clean(title)
  if (!t) return t
  const isBern = String(row?.source_id || '').includes('municipal-')
    && String(row?.source_url || '').includes('stadtrat.bern.ch')
  if (isBern) t = t.replace(/^Bern\s*[·:-]\s*/i, '')
  return t
}

const THEME_EXCLUDE = new Set(['botschaft', 'initiative', 'motion', 'postulat', 'interpellation', 'anfrage'])
const sanitizeThemes = (arr = []) => arr
  .map((x) => String(x || '').trim())
  .filter((x) => x && !THEME_EXCLUDE.has(x.toLowerCase()))
  .filter((x) => !['tiere', 'animals', 'animali'].includes(String(x || '').toLowerCase()))

const formatThemeLabel = (value = '') => {
  const s = String(value || '').trim()
  if (!s) return s
  return s.charAt(0).toUpperCase() + s.slice(1)
}

const municipalThemesFromTitle = (title = '') => {
  const t = String(title || '').toLowerCase()
  const out = []
  if (t.includes('feuerwerk') || t.includes('lärm') || t.includes('laerm')) out.push('Feuerwerk')
  if (t.includes('tierpark')) out.push('Tierpark')
  if (t.includes('biodivers')) out.push('Biodiversität')
  if (t.includes('wald')) out.push('Wald')
  if (t.includes('siedlungsgebiet')) out.push('Siedlungsgebiet')
  if (t.includes('landwirtschaftsgebiet')) out.push('Landwirtschaft')
  if (!out.length && t.includes('tier')) out.push('Tierschutz')
  if (!out.length) out.push('Tierschutz')
  return [...new Set(out)].slice(0, 4)
}

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

const summarizeVorstoss = ({ title = '', summary = '', body = '', status = '', sourceId = '' }) => {
  const t = clean(title)
  if (String(sourceId || '').startsWith('ch-municipal-')) {
    const state = status === 'published' ? 'abgeschlossen' : status === 'approved' ? 'in Beratung' : 'eingereicht'
    return `${t} (Gemeinde, ${state}).`
  }
  const summaryClean = clean(summary).replace(/eingereicht von:[^\n]*/ig, '').trim()
  const bodyClean = clean(body).replace(/eingereicht von:[^\n]*/ig, '').trim()
  const s = firstSentence(summaryClean)
  const b = firstSentence(bodyClean)
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

const isParliamentSourceId = (sourceId = '') => String(sourceId || '').startsWith('ch-parliament-')
const isPublicSourceId = (sourceId = '') => {
  const sid = String(sourceId || '')
  return sid.startsWith('ch-parliament-') || sid.startsWith('ch-municipal-') || sid.startsWith('ch-cantonal-')
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
        where m.status in ('approved','published')
          and (
            m.source_id like 'ch-parliament-%'
            or m.source_id like 'ch-municipal-%'
            or m.source_id like 'ch-cantonal-%'
          )
          and coalesce(mv.title, '') <> ''
          and coalesce(m.published_at, m.fetched_at) >= (now() - interval '5 years')
        order by m.updated_at desc
        limit 1200
      `)
      return res.rows
    })

    const affairIds = [...new Set(
      rows
        .filter((r) => isParliamentSourceId(r.source_id))
        .map((r) => String(r.external_id || '').split('-')[0])
        .filter(Boolean),
    )]

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

    const variantsByAffair = new Map()
    for (const row of rows) {
      if (!isParliamentSourceId(row.source_id)) continue
      const affairId = String(row.external_id || '').split('-')[0]
      if (!affairId) continue
      const lang = langFromSource(row.source_id)
      const prevAffair = variantsByAffair.get(affairId) || {}
      const prev = prevAffair[lang]
      const prevTs = new Date(prev?.fetched_at || prev?.published_at || 0).getTime()
      const curTs = new Date(row.fetched_at || row.published_at || 0).getTime()
      if (!prev || curTs >= prevTs) {
        prevAffair[lang] = row
        variantsByAffair.set(affairId, prevAffair)
      }
    }

    const grouped = new Map()
    for (const row of rows) {
      const isParliament = isParliamentSourceId(row.source_id)
      const key = isParliament
        ? String(row.external_id || '').split('-')[0]
        : `${row.source_id}:${row.external_id}`
      if (!key) continue
      const lang = langFromSource(row.source_id)
      const prev = grouped.get(key)
      if (!prev) {
        grouped.set(key, row)
        continue
      }
      const prevLang = langFromSource(prev.source_id)
      const betterLang = isParliament && (langRank(lang) < langRank(prevLang))
      const newer = new Date(row.fetched_at || row.published_at || 0).getTime() > new Date(prev.fetched_at || prev.published_at || 0).getTime()
      if (betterLang || (!betterLang && newer)) grouped.set(key, row)
    }

    const dedupedRows = [...grouped.values()]

    const mapped = dedupedRows.map((r, index) => {
      const sprache = langFromSource(r.source_id)
      const isParliament = isParliamentSourceId(r.source_id)
      const affairId = String(r.external_id || '').split('-')[0]
      const deVariant = isParliament ? deByAffair.get(affairId) : null
      const displayTitleRaw = deVariant?.title || r.title
      const displayTitle = normalizeDisplayTitle(r, displayTitleRaw)
      const displaySummary = deVariant?.summary || r.summary
      const displayBody = deVariant?.body || r.body
      const inferredYear = inferYearFromBusiness(displayTitle, r.external_id)
      const eingereicht = toIsoDate(r.published_at || r.fetched_at, inferredYear)
      const updated = toIsoDate(r.fetched_at || r.published_at, inferredYear)
      const stance = extractStance(r.review_reason, displayTitle, displaySummary, displayBody)
      const idSafe = String(r.external_id || `${Date.now()}-${index}`).replace(/[^a-zA-Z0-9-]/g, '-')
      const sourceLinkFromBody = String(displayBody || '').match(/Quelle:\s*(https?:\/\/\S+)/i)?.[1] || ''
      const link = sourceLinkFromBody.startsWith('http')
        ? sourceLinkFromBody
        : (String(r.source_url || '').startsWith('http')
          ? r.source_url
          : `https://www.parlament.ch/de/ratsbetrieb/suche-curia-vista/geschaeft?AffairId=${affairId}`)
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
        sourceId: r.source_id,
      }))
      const summaryText = normalizedSummary.length >= 10
        ? normalizedSummary
        : `Kurzüberblick: ${displayTitle || `Vorstoss ${index + 1}`} (${statusLabel}).`

      const normalizedThemes = sanitizeThemes(Array.isArray(r.matched_keywords) && r.matched_keywords.length ? r.matched_keywords : ['Tierschutz'])
      const isMunicipal = String(r?.source_id || '').startsWith('ch-municipal-')
      const baseThemes = isMunicipal
        ? municipalThemesFromTitle(displayTitle)
        : (normalizedThemes.length ? normalizedThemes : ['Tierschutz']).slice(0, 6)

      if (!clean(displayTitle)) return null

      const i18nOut = {
        title: { de: clean(displayTitle) },
        summary: { de: summaryText },
        type: { de: typeLabels[typ]?.de || typ },
        themes: { de: baseThemes },
      }
      const affairVariants = isParliament ? (variantsByAffair.get(affairId) || {}) : {}
      for (const [lang, variant] of Object.entries(affairVariants)) {
        const l = ['de', 'fr', 'it', 'en'].includes(lang) ? lang : 'de'
        const vTitle = clean(variant?.title || '')
        const vSummaryRaw = summarizeVorstoss({
          title: variant?.title || displayTitle,
          summary: variant?.summary || '',
          body: variant?.body || '',
          status: variant?.status || r.status,
        })
        const vSummary = clean(vSummaryRaw || summaryText)
        const vType = inferType(vTitle || displayTitle, variant?.source_id || r.source_id || '')
        if (vTitle) i18nOut.title[l] = vTitle
        if (vSummary) i18nOut.summary[l] = vSummary
        i18nOut.type[l] = typeLabels[vType]?.[l] || typeLabels[typ]?.[l] || vType
        i18nOut.themes[l] = baseThemes
      }

      const municipalSubmitters = String(r?.source_id || '').startsWith('ch-municipal-')
        ? parseMunicipalSubmitters(displayBody)
        : []

      return {
        id: `vp-${idSafe.toLowerCase()}`,
        titel: clean(displayTitle),
        typ,
        kurzbeschreibung: summaryText,
        geschaeftsnummer: String(r.external_id || `AUTO-${index + 1}`),
        ebene: 'Bund',
        kanton: null,
        regionGemeinde: null,
        status: statusLabel,
        datumEingereicht: eingereicht,
        datumAktualisiert: updated,
        themen: baseThemes.map((x) => formatThemeLabel(x)),
        schlagwoerter: (Array.isArray(r.matched_keywords) && r.matched_keywords.length ? r.matched_keywords : ['Tierpolitik']).slice(0, 8),
        einreichende: municipalSubmitters.length ? municipalSubmitters : [inferSubmitter(sprache, displayTitle, displaySummary, displayBody)],
        linkGeschaeft: link,
        resultate: [{ datum: eingereicht, status: statusLabel, bemerkung: 'Stand gemäss Parlamentsdaten' }],
        medien: [],
        metadaten: { sprache, haltung: stance, initiativeLinks, i18n: i18nOut, zuletztGeprueftVon: 'DB Live API' },
      }
    })

    const cleanedMapped = mapped.filter(Boolean)
    const payload = cleanedMapped.length > 0 ? cleanedMapped : fallbackVorstoesse

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
