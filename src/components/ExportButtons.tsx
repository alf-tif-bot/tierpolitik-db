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

  useEffect(() => {
    if (!showShortcuts) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowShortcuts(false)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [showShortcuts])

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
    </>
  )
}
