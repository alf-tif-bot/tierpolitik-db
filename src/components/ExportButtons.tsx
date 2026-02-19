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
                <li><strong>Review auf Deutsch + stabile UX</strong> – alle Review-Texte/Labels deutsch darstellen, Mobile-Buttons robust halten.</li>
                <li><strong>Kantone systematisch korrigieren</strong> – zuerst <strong>NW, UR, TI, NE, SZ, ZG</strong>; pro Kanton echte Geschäfts-Detailseiten erzwingen (keine Übersichtsseiten).</li>
                <li><strong>Städte gezielt erweitern</strong> – nach Bern/Zürich: <strong>Basel, Genf, Lausanne</strong> mit verifizierten Ratsgeschäft-Links.</li>
                <li><strong>Bund historisch vertiefen</strong> – Suchhorizont schrittweise von heute bis <strong>2000</strong> ausdehnen, mit Qualitäts-Gates pro Schritt.</li>
              </ol>
            </section>

            <section>
              <h3>Milestones</h3>
              <ul>
                <li><strong>M1 (heute):</strong> Review stabil klickbar, Deutschdarstellung verbessert, offene Queue wieder verbreitert.</li>
                <li><strong>M2 (diese Woche):</strong> NW/UR/TI auf konkrete Detail-Links umgestellt; Hindernisse dokumentiert (Login, JS-Rendering, fehlende IDs).</li>
                <li><strong>M3 (nächste 1–2 Wochen):</strong> NE/SZ/ZG + Basel/Genf/Lausanne produktiv mit verifizierten Detail-URLs.</li>
                <li><strong>M4 (nächste 2–3 Wochen):</strong> Bund-Horizont auf 2010 erweitert, dann in Etappen 2005 → 2000 (nur mit Qualitätsschwelle je Etappe).</li>
              </ul>
            </section>

            <section>
              <h3>Nächste Crawl-Strategie (Priorität)</h3>
              <ul>
                <li><strong>NW:</strong> Landrat-Übersicht ersetzt durch konkrete Traktanden-/Geschäfts-URLs (Hindernis: viele allgemeine Landingpages).</li>
                <li><strong>UR:</strong> Session-Seiten auf einzelne Geschäftsdetailseiten herunterbrechen (Hindernis: Session-Listen ohne stabile IDs).</li>
                <li><strong>TI:</strong> Ricerca-Resultate bis auf einzelne Atti/Interpellanze verlinken (Hindernis: mehrsprachige Struktur + Cookie/JS).</li>
                <li><strong>NE/SZ/ZG:</strong> pro Quelle Link-Ranking mit Detail-ID-Pflicht aktivieren (Hindernis: Portale liefern zuerst Rubrikseiten).</li>
                <li><strong>Städte:</strong> Basel/Genf/Lausanne erst freischalten, wenn mindestens 1 verifizierbare Detail-URL pro Lauf gefunden wird.</li>
              </ul>
            </section>
          </aside>
        </div>
      )}
    </>
  )
}
