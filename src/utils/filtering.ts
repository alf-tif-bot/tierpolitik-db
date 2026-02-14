import type { Ebene, Status, Vorstoss } from '../types'

export type Filters = {
  globalQuery: string
  ebenen: Ebene[]
  status: Status[]
  typen: string[]
  kantone: string[]
  themen: string[]
  schlagwoerter: string[]
  von: string
  bis: string
}

const normalizeUmlauts = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .normalize('NFKC')
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')

const norm = (v: string) => normalizeUmlauts(v)

export const canonicalTheme = (value: string): string => {
  const raw = String(value || '').trim()
  if (!raw) return ''
  const n = norm(raw)

  if (n === 'unsichtbare tiere' || n === 'tiere' || n === 'tier' || n === 'massentier' || n === 'tierversuchsfreie' || n === 'tierversuchsfrei') return ''
  if (n === 'nutrition') return 'Ernährung'
  if (n === 'biodiversita' || n === 'biodiversite' || n === 'biodiversitat' || n === 'biodiversitaet') return 'Biodiversität'
  if (n === '3r') return '3R'

  const lc = raw.toLowerCase()
  return lc.charAt(0).toUpperCase() + lc.slice(1)
}

export function matchesGlobal(v: Vorstoss, query: string): boolean {
  if (!query.trim()) return true
  const q = norm(query)
  const haystack = [
    v.titel,
    v.kurzbeschreibung,
    v.geschaeftsnummer,
    ...v.einreichende.map((p) => `${p.name} ${p.partei}`),
    ...v.themen,
  ].join(' ')

  return norm(haystack).includes(q)
}

export function applyFilters(data: Vorstoss[], f: Filters): Vorstoss[] {
  return data
    .filter((v) => {
      if (!matchesGlobal(v, f.globalQuery)) return false
      if (f.ebenen.length && !f.ebenen.includes(v.ebene)) return false
      if (f.status.length && !f.status.includes(v.status)) return false
      if (f.typen.length && !f.typen.includes(v.typ)) return false
      if (f.kantone.length && (!v.kanton || !f.kantone.includes(v.kanton))) return false
      if (f.themen.length) {
      const itemThemes = new Set(v.themen.map(canonicalTheme).filter(Boolean))
      const selectedThemes = f.themen.map(canonicalTheme).filter(Boolean)
      if (!selectedThemes.some((t) => itemThemes.has(t))) return false
    }
      if (f.von && v.datumEingereicht < f.von) return false
      if (f.bis && v.datumEingereicht > f.bis) return false
      return true
    })
    .sort((a, b) => {
      const aDate = a.datumEingereicht || a.datumAktualisiert || ''
      const bDate = b.datumEingereicht || b.datumAktualisiert || ''
      if (aDate !== bDate) return bDate.localeCompare(aDate)
      return String(b.geschaeftsnummer || '').localeCompare(String(a.geschaeftsnummer || ''), 'de-CH')
    })
}

export function defaultFilters(): Filters {
  return {
    globalQuery: '',
    ebenen: [],
    status: [],
    typen: [],
    kantone: [],
    themen: [],
    schlagwoerter: [],
    von: '',
    bis: '',
  }
}
