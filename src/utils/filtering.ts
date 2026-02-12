import type { Ebene, Status, Vorstoss } from '../types'

export type Filters = {
  globalQuery: string
  ebenen: Ebene[]
  status: Status[]
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
  return data.filter((v) => {
    if (!matchesGlobal(v, f.globalQuery)) return false
    if (f.ebenen.length && !f.ebenen.includes(v.ebene)) return false
    if (f.status.length && !f.status.includes(v.status)) return false
    if (f.kantone.length && (!v.kanton || !f.kantone.includes(v.kanton))) return false
    if (f.themen.length && !f.themen.some((t) => v.themen.includes(t))) return false
    if (f.von && v.datumEingereicht < f.von) return false
    if (f.bis && v.datumEingereicht > f.bis) return false
    return true
  })
}

export function defaultFilters(): Filters {
  return {
    globalQuery: '',
    ebenen: [],
    status: [],
    kantone: [],
    themen: [],
    schlagwoerter: [],
    von: '',
    bis: '',
  }
}
