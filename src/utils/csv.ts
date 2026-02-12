import type { Vorstoss } from '../types'

const escapeCsv = (value: string) => `"${value.replaceAll('"', '""')}"`

export function buildCsv(rows: Vorstoss[], columns: { key: string; label: string }[]): string {
  const header = columns.map((c) => escapeCsv(c.label)).join(',')
  const body = rows.map((r) => {
    const mapped: Record<string, string> = {
      id: r.id,
      titel: r.titel,
      ebene: r.ebene,
      kanton: r.kanton ?? '',
      regionGemeinde: r.regionGemeinde ?? '',
      status: r.status,
      datumEingereicht: r.datumEingereicht,
      schlagwoerter: r.schlagwoerter.join(' | '),
      einreichende: r.einreichende.map((p) => `${p.name} (${p.partei})`).join(' | '),
      linkGeschaeft: r.linkGeschaeft,
      geschaeftsnummer: r.geschaeftsnummer,
      themen: r.themen.join(' | '),
      kurzbeschreibung: r.kurzbeschreibung,
    }
    return columns.map((c) => escapeCsv(mapped[c.key] ?? '')).join(',')
  })
  return [header, ...body].join('\n')
}

export function downloadText(filename: string, content: string, type: string): void {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
