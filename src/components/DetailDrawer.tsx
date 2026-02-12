import type { I18nText, Language } from '../i18n'
import { translateContent, translateStatus } from '../i18n'
import type { Vorstoss } from '../types'
import { formatDateCH } from '../utils/date'

type Props = {
  item: Vorstoss | null
  onClose: () => void
  lang: Language
  t: I18nText
}

type TimelineItem = {
  datum: string
  label: string
  kind: 'result' | 'media'
  url?: string
}

export function DetailDrawer({ item, onClose, lang, t }: Props) {
  if (!item) return null

  const timeline: TimelineItem[] = [
    ...item.resultate.map((r) => ({
      datum: r.datum,
      label: `${translateStatus(r.status, lang)} · ${r.bemerkung}`,
      kind: 'result' as const,
    })),
    ...item.medien.map((m) => ({
      datum: m.datum,
      label: `${m.titel} (${m.quelle})`,
      kind: 'media' as const,
      url: m.url,
    })),
  ].sort((a, b) => a.datum.localeCompare(b.datum))

  const level = item.ebene === 'Bund' ? t.section.federal : item.ebene === 'Kanton' ? t.section.cantonal : item.ebene === 'Gemeinde' ? t.section.municipal : item.ebene
  const statusSlug = item.status.toLowerCase().replace(/\s+/g, '-')

  const metaRows = [
    { label: t.businessNo, value: item.geschaeftsnummer },
    { label: t.level, value: level },
    { label: t.canton, value: item.kanton ?? '-' },
    { label: t.region, value: item.regionGemeinde ?? '-' },
    { label: t.dateSubmitted, value: formatDateCH(item.datumEingereicht) },
    { label: t.themes, value: item.themen.map((v) => translateContent(v, lang)).join(', ') },
    { label: t.submitters, value: item.einreichende.map((p) => `${p.name} (${p.partei})`).join(', ') },
  ]

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="row drawer-head">
          <div>
            <h2>{translateContent(item.titel, lang)}</h2>
            <div className="drawer-status-row">
              <span className={`status-badge status-${statusSlug}`}>{translateStatus(item.status, lang)}</span>
            </div>
          </div>
          <button onClick={onClose}>{t.close}</button>
        </div>

        <p className="drawer-summary">{translateContent(item.kurzbeschreibung, lang)}</p>

        <h3>Falldaten</h3>
        <div className="detail-grid">
          {metaRows.map((row) => (
            <div className="detail-card" key={row.label}>
              <span className="detail-label">{row.label}</span>
              <span className="detail-value">{row.value}</span>
            </div>
          ))}
        </div>

        <div className="row wrap drawer-actions">
          <a href={item.linkGeschaeft} target="_blank" rel="noopener">
            <button className="btn-primary">{t.openBusiness}</button>
          </a>
        </div>

        <h3>{t.timeline}</h3>
        <ul className="timeline-list">
          {timeline.map((entry, i) => (
            <li key={`${entry.datum}-${i}`} className={`timeline-item ${entry.kind}`}>
              <div className="timeline-dot" />
              <div className="timeline-content">
                <div className="timeline-meta">
                  <strong>{formatDateCH(entry.datum)}</strong>
                  <span>{entry.kind === 'media' ? t.media : t.result}</span>
                </div>
                {entry.url ? <a href={entry.url} target="_blank" rel="noopener">{entry.label}</a> : <span>{entry.label}</span>}
              </div>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  )
}
