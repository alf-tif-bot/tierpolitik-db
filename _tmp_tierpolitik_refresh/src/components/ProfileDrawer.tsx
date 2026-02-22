import type { Language } from '../i18n'
import { translateContent } from '../i18n'
import type { Vorstoss } from '../types'
import { formatDateCH } from '../utils/date'

type ProfileState =
  | { kind: 'person'; value: string }
  | { kind: 'party'; value: string }
  | null

type Props = {
  profile: ProfileState
  data: Vorstoss[]
  lang: Language
  onClose: () => void
  onOpenDetail: (item: Vorstoss) => void
  onSubscribe: (context: string) => void
}

const normalizeTitle = (value: string) => value.replace(/^Vorstoss\s+\d+\s*:\s*/i, '')

export function ProfileDrawer({ profile, data, lang, onClose, onOpenDetail, onSubscribe }: Props) {
  if (!profile) return null

  const isParty = profile.kind === 'party'
  const matching = data.filter((v) =>
    isParty
      ? v.einreichende.some((p) => p.partei === profile.value)
      : v.einreichende.some((p) => p.name === profile.value),
  )

  const title = isParty ? `Partei: ${profile.value}` : `Person: ${profile.value}`
  const subscriptionLabel = isParty ? `Partei ${profile.value}` : `Person ${profile.value}`

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="row drawer-head">
          <div>
            <h2>{title}</h2>
            <p className="drawer-summary">Vorstosshistorie ({matching.length})</p>
          </div>
          <button onClick={onClose}>Schliessen</button>
        </div>

        <div className="row wrap drawer-actions">
          <button className="btn-primary" onClick={() => onSubscribe(subscriptionLabel)}>E-Mail abonnieren</button>
        </div>

        <ul className="timeline-list">
          {matching.map((entry) => (
            <li key={entry.id} className="timeline-item result">
              <div className="timeline-dot" />
              <div className="timeline-content">
                <div className="timeline-meta">
                  <strong>{formatDateCH(entry.datumEingereicht)}</strong>
                  <span>{entry.ebene}</span>
                </div>
                <button className="text-link-btn" onClick={() => onOpenDetail(entry)}>
                  {normalizeTitle(translateContent(entry.titel, lang))}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  )
}
