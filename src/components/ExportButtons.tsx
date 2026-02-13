import { useState } from 'react'
import type { I18nText } from '../i18n'
import type { Vorstoss } from '../types'
import { buildCsv, downloadText } from '../utils/csv'

type Props = {
  filtered: Vorstoss[]
  visibleColumns: { key: string; label: string }[]
  t: I18nText
}

export function ExportButtons({ filtered, visibleColumns, t }: Props) {
  const [showShortcuts, setShowShortcuts] = useState(false)

  const exportCsv = () => {
    const csv = buildCsv(filtered, visibleColumns)
    downloadText('vorstoesse-tabellenansicht.csv', csv, 'text/csv;charset=utf-8')
  }

  const exportJson = () => {
    downloadText('vorstoesse-gefiltert.json', JSON.stringify(filtered, null, 2), 'application/json;charset=utf-8')
  }

  return (
    <>
      <div className="export-links" aria-label={t.export}>
        <span className="export-label">{t.export}:</span>
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
        <span className="export-sep">·</span>
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
      </div>

      {showShortcuts && (
        <div className="drawer-backdrop" onClick={() => setShowShortcuts(false)}>
          <aside className="drawer" onClick={(e) => e.stopPropagation()}>
            <div className="row drawer-head">
              <h2>Tastaturbefehle</h2>
              <button onClick={() => setShowShortcuts(false)}>Schliessen</button>
            </div>
            <ul>
              <li><strong>ESC</strong> → Detailansicht schliessen</li>
              <li><strong>/</strong> → ins Suchfeld springen</li>
              <li><strong>j / k</strong> → in der aktuellen Tabellen-Seite runter/rauf</li>
              <li><strong>Enter</strong> → markierten Vorstoss öffnen</li>
              <li><strong>w</strong> → WHITE Mode</li>
              <li><strong>d</strong> → DARK Mode</li>
              <li><strong>de / fr / it / en</strong> → Sprache wechseln</li>
            </ul>
          </aside>
        </div>
      )}
    </>
  )
}
