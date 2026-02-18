import type { Language } from '../i18n'
import { translateContent } from '../i18n'
import type { Vorstoss } from '../types'
import { formatDateCH } from '../utils/date'
import { normalizePartyName, normalizeSubmitterName } from '../utils/submitters'
import { toFrenchQuotes } from '../utils/text'

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

const normalizeTitle = (value: string) => toFrenchQuotes(value.replace(/^Vorstoss\s+\d+\s*:\s*/i, ''))

export function ProfileDrawer({ profile, data, lang, onClose, onOpenDetail, onSubscribe }: Props) {
  if (!profile) return null

  const isParty = profile.kind === 'party'
  const normalizedProfileValue = isParty ? normalizePartyName(profile.value) : normalizeSubmitterName(profile.value)

  const matching = data.filter((v) =>
    isParty
      ? v.einreichende.some((p) => normalizePartyName(p.partei) === normalizedProfileValue)
      : v.einreichende.some((p) => normalizeSubmitterName(p.name) === normalizedProfileValue),
  )

  const title = isParty ? `Partei: ${normalizedProfileValue}` : `Person: ${normalizedProfileValue}`
  const subscriptionLabel = isParty ? `Partei ${normalizedProfileValue}` : `Person ${normalizedProfileValue}`

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
