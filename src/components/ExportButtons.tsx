import type { I18nText } from '../i18n'
import type { Vorstoss } from '../types'
import { buildCsv, downloadText } from '../utils/csv'

type Props = {
  filtered: Vorstoss[]
  visibleColumns: { key: string; label: string }[]
  t: I18nText
}

export function ExportButtons({ filtered, visibleColumns, t }: Props) {
  const exportCsv = () => {
    const csv = buildCsv(filtered, visibleColumns)
    downloadText('vorstoesse-tabellenansicht.csv', csv, 'text/csv;charset=utf-8')
  }

  const exportJson = () => {
    downloadText('vorstoesse-gefiltert.json', JSON.stringify(filtered, null, 2), 'application/json;charset=utf-8')
  }

  return (
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
    </div>
  )
}
