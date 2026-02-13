import type { I18nText, Language } from '../i18n'
import { translateContent, translateStatus } from '../i18n'
import type { Vorstoss } from '../types'
import { formatDateCH } from '../utils/date'

type QuickFilterField = 'thema' | 'typ' | 'ebene' | 'kanton' | 'region'

type Props = {
  item: Vorstoss | null
  onClose: () => void
  onOpenPersonProfile: (name: string) => void
  onOpenPartyProfile: (party: string) => void
  onSubscribe: (context: string) => void
  onQuickFilter: (field: QuickFilterField, value: string) => void
  lang: Language
  t: I18nText
}

const normalizeTitle = (value: string, typ?: string) => {
  let out = value
    .replace(/^Vorstoss\s+\d+\s*:\s*/i, '')
    .replace(/^\s*\d{2}\.\d{3,4}\s*[·\-–—:]\s*/u, '')
    .trim()

  if (typ) {
    const escaped = typ.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    out = out.replace(new RegExp(`(?:\\.|,)?\\s*${escaped}\\s*$`, 'i'), '').trim()
  }

  return out
}

type TimelineItem = {
  datum: string
  label: string
  kind: 'result' | 'media'
  url?: string
}

export function DetailDrawer({ item, onClose, onOpenPersonProfile, onOpenPartyProfile, onSubscribe, onQuickFilter, lang, t }: Props) {
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
    { label: t.type, value: item.typ, filterField: 'typ' as const },
    { label: t.businessNo, value: item.geschaeftsnummer },
    { label: t.level, value: level, filterField: 'ebene' as const, rawValue: item.ebene },
    { label: t.canton, value: item.kanton ?? '-', filterField: 'kanton' as const },
    { label: t.region, value: item.regionGemeinde ?? '-', filterField: 'region' as const },
    { label: t.dateSubmitted, value: formatDateCH(item.datumEingereicht) },
  ]

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="row drawer-head">
          <div>
            <h2>{normalizeTitle(translateContent(item.titel, lang), item.typ)}</h2>
            <div className="drawer-status-row">
              <span className={`status-badge status-${statusSlug}`}>{translateStatus(item.status, lang)}</span>
            </div>
          </div>
          <button onClick={onClose}>{t.close}</button>
        </div>

        <p className="drawer-summary">{translateContent(item.kurzbeschreibung, lang)}</p>

        <h3>Falldaten</h3>
        <div className="detail-grid">
          {metaRows.map((row) => {
            const clickable = Boolean(row.filterField && row.value && row.value !== '-')
            const filterValue = row.rawValue ?? row.value

            return (
              <div className="detail-card" key={row.label}>
                <span className="detail-label">{row.label}</span>
                {clickable ? (
                  <button className="text-link-btn" onClick={() => onQuickFilter(row.filterField!, String(filterValue))}>
                    {row.value}
                  </button>
                ) : (
                  <span className="detail-value">{row.value}</span>
                )}
              </div>
            )
          })}
          <div className="detail-card">
            <span className="detail-label">{t.themes}</span>
            <div className="detail-link-row">
              {item.themen.map((theme) => (
                <button key={theme} className="text-link-btn" onClick={() => onQuickFilter('thema', theme)}>
                  {translateContent(theme, lang)}
                </button>
              ))}
            </div>
          </div>
          <div className="detail-card">
            <span className="detail-label">{t.submitters}</span>
            <div className="detail-links">
              {item.einreichende.map((p) => (
                <div key={`${p.name}-${p.partei}`} className="detail-link-row">
                  <button className="text-link-btn" onClick={() => onOpenPersonProfile(p.name)}>{p.name}</button>
                  <button className="text-link-btn" onClick={() => onOpenPartyProfile(p.partei)}>{p.partei}</button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="row wrap drawer-actions">
          <a href={item.linkGeschaeft} target="_blank" rel="noopener">
            <button className="btn-primary">{t.openBusiness}</button>
          </a>
          {item.typ === 'Volksinitiative' && item.metadaten?.initiativeLinks?.campaignUrl && (
            <a href={item.metadaten.initiativeLinks.campaignUrl} target="_blank" rel="noopener noreferrer">
              <button className="btn-secondary">Kampagnen-Website</button>
            </a>
          )}
          {item.typ === 'Volksinitiative' && item.metadaten?.initiativeLinks?.resultUrl && (
            <a href={item.metadaten.initiativeLinks.resultUrl} target="_blank" rel="noopener noreferrer">
              <button className="btn-secondary">Behörden-Resultate</button>
            </a>
          )}
          <button className="btn-secondary" onClick={() => onSubscribe(`Vorstoss ${item.geschaeftsnummer}`)}>E-Mail abonnieren</button>
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
        <button className="bug-report-fab" type="button">Fehler gefunden?</button>
      </aside>
    </div>
  )
}
