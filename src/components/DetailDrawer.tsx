import type { Vorstoss } from '../types'

type Props = {
  item: Vorstoss | null
  onClose: () => void
}

export function DetailDrawer({ item, onClose }: Props) {
  if (!item) return null

  const timeline: Array<{ datum: string; label: string; url?: string }> = [
    ...item.resultate.map((r) => ({ datum: r.datum, label: `Resultat: ${r.status} - ${r.bemerkung}` })),
    ...item.medien.map((m) => ({ datum: m.datum, label: `Medien: ${m.titel} (${m.quelle})`, url: m.url })),
  ].sort((a, b) => a.datum.localeCompare(b.datum))

  const permalink = `${window.location.origin}${window.location.pathname}#${item.id}`

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="row">
          <h2>{item.titel}</h2>
          <button onClick={onClose}>Schliessen</button>
        </div>

        <p>{item.kurzbeschreibung}</p>
        <p><strong>Geschaeftsnummer:</strong> {item.geschaeftsnummer}</p>
        <p><strong>Ebene:</strong> {item.ebene}</p>
        <p><strong>Kanton:</strong> {item.kanton ?? '-'}</p>
        <p><strong>Region/Gemeinde:</strong> {item.regionGemeinde ?? '-'}</p>
        <p><strong>Status:</strong> {item.status}</p>
        <p><strong>Datum eingereicht:</strong> {item.datumEingereicht}</p>
        <p><strong>Themen:</strong> {item.themen.join(', ')}</p>
        <p><strong>Schlagwoerter:</strong> {item.schlagwoerter.join(', ')}</p>
        <p><strong>Einreichende:</strong> {item.einreichende.map((p) => `${p.name} (${p.partei})`).join(', ')}</p>

        <div className="row wrap">
          <button onClick={() => navigator.clipboard.writeText(permalink)}>Link kopieren</button>
          <a href={item.linkGeschaeft} target="_blank" rel="noopener"><button>Geschaeft oeffnen</button></a>
        </div>

        <h3>Timeline</h3>
        <ul>
          {timeline.map((t, i) => (
            <li key={`${t.datum}-${i}`}>
              <strong>{t.datum}</strong> - {t.url ? <a href={t.url} target="_blank" rel="noopener">{t.label}</a> : t.label}
            </li>
          ))}
        </ul>
      </aside>
    </div>
  )
}
