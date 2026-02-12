import type { Vorstoss } from '../types'
import { buildCsv, downloadText } from '../utils/csv'

type Props = {
  filtered: Vorstoss[]
  visibleColumns: { key: string; label: string }[]
  allColumns: { key: string; label: string }[]
}

export function ExportButtons({ filtered, visibleColumns, allColumns }: Props) {
  const exportCsv = (mode: 'visible' | 'all') => {
    const columns = mode === 'visible' ? visibleColumns : allColumns
    const csv = buildCsv(filtered, columns)
    downloadText(`vorstoesse-${mode}.csv`, csv, 'text/csv;charset=utf-8')
  }

  const exportJson = () => {
    downloadText('vorstoesse-gefiltert.json', JSON.stringify(filtered, null, 2), 'application/json;charset=utf-8')
  }

  return (
    <div className="row wrap">
      <button onClick={() => exportCsv('visible')}>CSV Export (sichtbare Spalten)</button>
      <button onClick={() => exportCsv('all')}>CSV Export (alle Spalten)</button>
      <button onClick={exportJson}>JSON Export (gefiltert)</button>
    </div>
  )
}
