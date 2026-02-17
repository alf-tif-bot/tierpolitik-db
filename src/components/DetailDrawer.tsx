import { useEffect, useRef, useState } from 'react'
import type { I18nText, Language } from '../i18n'
import { localizedMetaText, localizedMetaThemes, localizedMetaType, statusClassSlug, statusIcon, translateContent, translateStatus } from '../i18n'
import type { Vorstoss } from '../types'
import { formatDateCH } from '../utils/date'
import { formatSubmitterDisplay } from '../utils/submitters'

type QuickFilterField = 'thema' | 'typ' | 'ebene' | 'kanton' | 'region'

type Props = {
  item: Vorstoss | null
  onClose: () => void
  onOpenPersonProfile: (name: string) => void
  onOpenPartyProfile: (party: string) => void
  onSubscribe: (context: string) => void
  onQuickFilter: (field: QuickFilterField, value: string) => void
  onFeedbackSubmitted: (payload: { id: string; irrelevant: boolean }) => void
  lang: Language
  t: I18nText
}

const inferFederalChamber = (businessNo = '', level = '', fallbackRole = '') => {
  if (level !== 'Bund') return '-'

  const normalizedRole = String(fallbackRole || '').trim()
  if (/nationalrat/i.test(normalizedRole)) return 'Nationalrat'
  if (/ständerat|staenderat/i.test(normalizedRole)) return 'Ständerat'

  const m = String(businessNo || '').match(/\b\d{2}\.(\d{4})\b/)
  const block = m?.[1] || ''
  if (block.startsWith('3')) return 'Nationalrat'
  if (block.startsWith('4')) return 'Ständerat'
  return '-'
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

const API_BASE = (import.meta.env.VITE_API_BASE || '/.netlify/functions').replace(/\/$/, '')

type TimelineItem = {
  datum: string
  label: string
  kind: 'result' | 'media'
  url?: string
}

export function DetailDrawer({ item, onClose, onOpenPersonProfile, onOpenPartyProfile, onSubscribe, onQuickFilter, onFeedbackSubmitted, lang, t }: Props) {
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [feedbackType, setFeedbackType] = useState('Fehler gefunden')
  const [feedbackText, setFeedbackText] = useState('')
  const [feedbackState, setFeedbackState] = useState<'idle' | 'saving' | 'done' | 'error'>('idle')
  const modalRef = useRef<HTMLElement | null>(null)
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)
  const titleRef = useRef<HTMLHeadingElement | null>(null)

  useEffect(() => {
    setFeedbackOpen(false)
    setFeedbackState('idle')
    setFeedbackText('')
    setFeedbackType('Fehler gefunden')
  }, [item?.id])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) return
      if (event.key.toLowerCase() !== 'f') return
      event.preventDefault()
      setFeedbackOpen((open) => !open)
      setFeedbackState('idle')
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    if (!item) return

    const focusInitial = () => {
      if (closeButtonRef.current) {
        closeButtonRef.current.focus()
        return
      }
      titleRef.current?.focus()
    }

    focusInitial()

    const onKeyDown = (event: KeyboardEvent) => {
      if (!modalRef.current) return

      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }

      if (event.key !== 'Tab') return

      const focusable = Array.from(
        modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true')

      if (focusable.length === 0) {
        event.preventDefault()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement as HTMLElement | null

      if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      } else if (event.shiftKey && (active === first || !modalRef.current.contains(active))) {
        event.preventDefault()
        last.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [item, onClose])

  if (!item) return null

  const timeline: TimelineItem[] = [
    ...item.resultate.map((r) => ({
      datum: r.datum,
      label: `${statusIcon(r.status)} ${translateStatus(r.status, lang)} Â· ${r.bemerkung}`,
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
  const statusSlug = statusClassSlug(item.status)

  const stanceValue = item.metadaten?.haltung === 'pro-tierschutz'
    ? 'Pro Tierschutz'
    : item.metadaten?.haltung === 'tierschutzkritisch'
      ? 'Tierschutzkritisch'
      : 'Neutral / unklar'

  const themesLocalized = localizedMetaThemes(item, lang)

  const metaRows = [
    { label: t.type, value: localizedMetaType(item, lang), filterField: 'typ' as const, rawValue: item.typ },
    { label: t.businessNo, value: item.geschaeftsnummer },
    { label: t.level, value: level, filterField: 'ebene' as const, rawValue: item.ebene },
    { label: 'Rat', value: inferFederalChamber(item.geschaeftsnummer, item.ebene, item.einreichende?.[0]?.rolle || '') },
    { label: t.canton, value: item.kanton ?? '-', filterField: 'kanton' as const },
    { label: t.region, value: item.regionGemeinde ?? '-', filterField: 'region' as const },
    { label: t.dateSubmitted, value: formatDateCH(item.datumEingereicht) },
  ]

  const submitFeedback = async () => {
    try {
      setFeedbackState('saving')
      const payload = {
        id: item.id,
        geschaeftsnummer: item.geschaeftsnummer,
        title: item.titel,
        link: item.linkGeschaeft,
        category: feedbackType,
        message: feedbackText,
      }
      const res = await fetch(`${API_BASE}/feedback-submit`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error(await res.text())
      setFeedbackState('done')
      setFeedbackText('')

      const isIrrelevant = feedbackType === 'Vorstoss irrelevant'
      setTimeout(() => {
        setFeedbackOpen(false)
        if (isIrrelevant) {
          onFeedbackSubmitted({ id: item.id, irrelevant: true })
          onClose()
          window.requestAnimationFrame(() => {
            const overview = document.getElementById('vorstoesse-ueberblick')
            if (overview) overview.scrollIntoView({ behavior: 'smooth', block: 'start' })
          })
        }
      }, 700)
    } catch {
      setFeedbackState('error')
    }
  }

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside
        ref={modalRef}
        className="drawer"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="detail-modal-title"
        data-testid="modal"
      >
        <div className="row drawer-head">
          <div>
            <h2 id="detail-modal-title" ref={titleRef} tabIndex={-1}>{normalizeTitle(localizedMetaText(item, 'title', lang, item.titel), item.typ)}</h2>
            <div className="drawer-status-row">
              <span className={`status-badge status-${statusSlug}`}>{statusIcon(item.status)} {translateStatus(item.status, lang)}</span>
            </div>
          </div>
          <button ref={closeButtonRef} data-testid="close-button" onClick={onClose}>{t.close}</button>
        </div>

        <p className="drawer-summary">{localizedMetaText(item, 'summary', lang, item.kurzbeschreibung)}</p>

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
              {item.themen.map((theme, index) => {
                const label = String(themesLocalized[index] || translateContent(theme, lang) || theme)
                return (
                  <button key={theme} className="text-link-btn" onClick={() => onQuickFilter('thema', theme)}>
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="detail-card">
            <span className="detail-label">Tierbezug</span>
            <span className="detail-value">{stanceValue}</span>
          </div>
          <div className="detail-card">
            <span className="detail-label">{t.submitters}</span>
            <div className="detail-links">
              {item.einreichende.map((p) => (
                <div key={`${p.name}-${p.partei || ''}`} className="detail-link-row">
                  <button className="text-link-btn" onClick={() => onOpenPersonProfile(p.name)}>{formatSubmitterDisplay(p.name, p.partei)}</button>
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
              <button className="btn-secondary">BehÃ¶rden-Resultate</button>
            </a>
          )}
          <button className="btn-secondary" onClick={() => onSubscribe(`Vorstoss ${item.geschaeftsnummer}`)}>GeschÃ¤ft abonnieren</button>
        </div>

        <h3>{t.timeline}</h3>
        <ul className="timeline-list">
          {timeline.map((entry, i) => (
            <li key={`${entry.datum}-${i}`} className={`timeline-item ${entry.kind}`}>
              <div className="timeline-dot" />
              <div className="timeline-content">
                <div className="timeline-meta">
                  <strong>{formatDateCH(entry.datum)}</strong>
                  <span>{entry.kind === 'media' ? t.media : 'Status'}</span>
                </div>
                {entry.url ? <a href={entry.url} target="_blank" rel="noopener">{entry.label}</a> : <span>{entry.label}</span>}
              </div>
            </li>
          ))}
        </ul>
        {!feedbackOpen && (
          <button
            className="bug-report-fab"
            type="button"
            onClick={() => {
              setFeedbackOpen((open) => !open)
              setFeedbackState('idle')
            }}
          >
            Feedback
          </button>
        )}

        {feedbackOpen && (
          <div className="feedback-modal" role="dialog" aria-modal="true">
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>Feedback</h3>
            </div>
            <label>
              Kategorie
              <select value={feedbackType} onChange={(e) => setFeedbackType(e.target.value)}>
                <option>Fehler gefunden</option>
                <option>Vorstoss irrelevant</option>
                <option>Doppeleintrag</option>
                <option>Beschreibung verbessern</option>
                <option>Einreichende falsch</option>
                <option>Tierbezug unklar</option>
              </select>
            </label>
            <label>
              Notiz
              <textarea
                rows={4}
                placeholder="Beschreibe kurz, was angepasst werden soll."
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
              />
            </label>
            <div className="row">
              <button
                className="btn-primary"
                onClick={submitFeedback}
                disabled={feedbackState === 'saving'}
              >
                {feedbackState === 'saving' ? 'Sendeâ€¦' : 'Senden'}
              </button>
            </div>
            {feedbackState === 'done' && (
              <p className="muted">
                {feedbackType === 'Beschreibung verbessern'
                  ? 'Danke dir ðŸ’š Beschreibung wird automatisch Ã¼berarbeitet.'
                  : 'Danke dir fÃ¼rs Feedback ðŸ’š'}
              </p>
            )}
            {feedbackState === 'error' && <p className="muted">Feedback konnte nicht gesendet werden.</p>}
          </div>
        )}
      </aside>
    </div>
  )
}

