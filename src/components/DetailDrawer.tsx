import type { I18nText, Language } from '../i18n'
import { translateStatus } from '../i18n'
import type { Vorstoss } from '../types'
import { formatDateCH } from '../utils/date'

type Props = {
  item: Vorstoss | null
  onClose: () => void
  lang: Language
  t: I18nText
}

export function DetailDrawer({ item, onClose, lang, t }: Props) {
  if (!item) return null

  const timeline: Array<{ datum: string; label: string; url?: string }> = [
    ...item.resultate.map((r) => ({ datum: r.datum, label: `Resultat: ${r.status} - ${r.bemerkung}` })),
    ...item.medien.map((m) => ({ datum: m.datum, label: `Medien: ${m.titel} (${m.quelle})`, url: m.url })),
  ].sort((a, b) => a.datum.localeCompare(b.datum))

  const permalink = `${window.location.origin}${window.location.pathname}#${item.id}`

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="row drawer-head">
          <h2>{item.titel}</h2>
          <button onClick={onClose}>{t.close}</button>
        </div>

        <p>{item.kurzbeschreibung}</p>
        <p><strong>{t.businessNo}:</strong> {item.geschaeftsnummer}</p>
        <p><strong>{t.level}:</strong> {item.ebene}</p>
        <p><strong>{t.canton}:</strong> {item.kanton ?? '-'}</p>
        <p><strong>{t.region}:</strong> {item.regionGemeinde ?? '-'}</p>
        <p><strong>{t.status}:</strong> <span className={`status-badge status-${item.status.toLowerCase().replace(/\s+/g, '-')}`}>{translateStatus(item.status, lang)}</span></p>
        <p><strong>{t.dateSubmitted}:</strong> {formatDateCH(item.datumEingereicht)}</p>
        <p><strong>{t.themes}:</strong> {item.themen.join(', ')}</p>
        <p><strong>{t.keywords}:</strong> {item.schlagwoerter.join(', ')}</p>
        <p><strong>{t.submitters}:</strong> {item.einreichende.map((p) => `${p.name} (${p.partei})`).join(', ')}</p>

        <div className="row wrap">
          <button onClick={() => navigator.clipboard.writeText(permalink)}>{t.copyLink}</button>
          <a href={item.linkGeschaeft} target="_blank" rel="noopener"><button>{t.openBusiness}</button></a>
        </div>

        <h3>{t.timeline}</h3>
        <ul>
          {timeline.map((entry, i) => (
            <li key={`${entry.datum}-${i}`}>
              <strong>{formatDateCH(entry.datum)}</strong> - {entry.url ? <a href={entry.url} target="_blank" rel="noopener">{entry.label}</a> : entry.label}
            </li>
          ))}
        </ul>
      </aside>
    </div>
  )
}
