import { useEffect, useState } from 'react'
import type { I18nText } from '../i18n'
import type { Vorstoss } from '../types'
import { buildCsv, downloadText } from '../utils/csv'

type Props = {
  filtered: Vorstoss[]
  visibleColumns: { key: string; label: string }[]
  t: I18nText
  showExports?: boolean
  showShortcutsLink?: boolean
}

export function ExportButtons({ filtered, visibleColumns, t, showExports = true, showShortcutsLink = true }: Props) {
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [showRoadmap, setShowRoadmap] = useState(false)

  useEffect(() => {
    if (!showShortcuts && !showRoadmap) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowShortcuts(false)
        setShowRoadmap(false)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [showShortcuts, showRoadmap])

  const exportCsv = () => {
    const csv = buildCsv(filtered, visibleColumns)
    downloadText('vorstoesse-tabellenansicht.csv', csv, 'text/csv;charset=utf-8')
  }

  const exportJson = () => {
    downloadText('vorstoesse-gefiltert.json', JSON.stringify(filtered, null, 2), 'application/json;charset=utf-8')
  }

  const hasAnyLink = showExports || showShortcutsLink

  return (
    <>
      {hasAnyLink && (
        <div className="export-links" aria-label={t.export}>
          {showExports && <span className="export-label">{t.export}:</span>}
          {showExports && (
            <>
              <a
                href="#"
                className="export-link"
                onClick={(e) => {
                  e.preventDefault()
                  exportCsv()
                }}
              >
                CSV (Tabellenansicht)
              </a>
              <span className="export-sep">·</span>
              <a
                href="#"
                className="export-link"
                onClick={(e) => {
                  e.preventDefault()
                  exportJson()
                }}
              >
                {t.jsonFiltered}
              </a>
            </>
          )}

          {showShortcutsLink && (
            <>
              {showExports && <span className="export-sep">·</span>}
              <a
                href="#"
                className="export-link"
                onClick={(e) => {
                  e.preventDefault()
                  setShowShortcuts(true)
                }}
              >
                Tastaturbefehle
              </a>
              <span className="export-sep">·</span>
              <a
                href="#"
                className="export-link"
                onClick={(e) => {
                  e.preventDefault()
                  setShowRoadmap(true)
                }}
              >
                Roadmap
              </a>
            </>
          )}
        </div>
      )}

      {showShortcuts && (
        <div className="drawer-backdrop" onClick={() => setShowShortcuts(false)}>
          <aside className="drawer" onClick={(e) => e.stopPropagation()}>
            <div className="row drawer-head">
              <h2>Tastaturbefehle</h2>
              <button onClick={() => setShowShortcuts(false)}>Schliessen</button>
            </div>
            <table className="shortcuts-table" aria-label="Tastaturbefehle">
              <tbody>
                <tr><td><strong>ESC</strong></td><td>Detailansicht schliessen</td></tr>
                <tr><td><strong>/</strong></td><td>ins Suchfeld springen</td></tr>
                <tr><td><strong>j / k</strong></td><td>in der aktuellen Tabellen-Seite runter/rauf</td></tr>
                <tr><td><strong>Enter</strong></td><td>markierten Vorstoss öffnen</td></tr>
                <tr><td><strong>w</strong></td><td>WHITE Mode</td></tr>
                <tr><td><strong>d</strong></td><td>DARK Mode</td></tr>
                <tr><td><strong>de / fr / it / en</strong></td><td>Sprache wechseln</td></tr>
              </tbody>
            </table>
          </aside>
        </div>
      )}

      {showRoadmap && (
        <div className="drawer-backdrop" onClick={() => setShowRoadmap(false)}>
          <aside className="drawer" onClick={(e) => e.stopPropagation()}>
            <div className="row drawer-head">
              <h2>Roadmap</h2>
              <button onClick={() => setShowRoadmap(false)}>Schliessen</button>
            </div>

            <section>
              <h3 style={{ marginTop: 0 }}>Zielbild</h3>
              <p style={{ marginTop: 0 }}>
                Der Tierpolitik-Monitor ist täglich verlässlich nutzbar: stabile Endpunkte, laufend gepflegte und
                verifizierte Vorstösse aus Bund/Kantonen/Städten sowie klare Feedback- und Review-Prozesse.
              </p>
            </section>

            <section>
              <h3>Weg dorthin</h3>
              <ol>
                <li><strong>Stabilisieren</strong> – Endpunkte (<code>/home-data</code>, <code>/feedback-submit</code>) und Deploy-Checks absichern.</li>
                <li><strong>Qualität im Betrieb</strong> – tägliche QA-Pässe, Review-Queue aktiv halten, nur verifizierbare Einträge freigeben.</li>
                <li><strong>Abdeckung ausbauen</strong> – kommunale Quellen über Bern/Zürich hinaus erweitern (z. B. Basel, Genf, Lausanne).</li>
                <li><strong>Team-Fluss verbessern</strong> – Review-/Ops-Schritte weiter automatisieren und Blocker (z. B. Discord-Slash) schliessen.</li>
              </ol>
            </section>

            <section>
              <h3>Milestones</h3>
              <ul>
                <li><strong>M1 (heute):</strong> Endpunkte stabil + erster Freigabe-Block erledigt + Live-Check grün.</li>
                <li><strong>M2 (diese Woche):</strong> tägliche QA-Routine (Mittag/Nachmittag) ohne trockene Queue etabliert.</li>
                <li><strong>M3 (nächste 1–2 Wochen):</strong> mindestens 3 zusätzliche Stadtquellen mit verifizierten Detail-URLs produktiv.</li>
                <li><strong>M4 (nächste 2–4 Wochen):</strong> nachhaltiger Betriebsmodus mit weniger manuellen Eingriffen und klaren SLOs.</li>
              </ul>
            </section>
          </aside>
        </div>
      )}
    </>
  )
}
