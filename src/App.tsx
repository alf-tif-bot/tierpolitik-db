import { useCallback, useEffect, useMemo, useState } from 'react'
import rawData from '../data/vorstoesse.json'
import './App.css'
import { DetailDrawer } from './components/DetailDrawer'
import { ExportButtons } from './components/ExportButtons'
import { FiltersPanel } from './components/Filters'
import { allColumnsMeta, TableView } from './components/TableView'
import { validateVorstoesse, type Vorstoss } from './types'
import { applyFilters, defaultFilters, type Filters } from './utils/filtering'
import { clearHashId, getHashId, setHashId } from './utils/urlHash'

const data = validateVorstoesse(rawData)

export default function App() {
  const [filters, setFilters] = useState<Filters>(defaultFilters)
  const [selected, setSelected] = useState<Vorstoss | null>(null)
  const [visibleColumns, setVisibleColumns] = useState<{ key: string; label: string }[]>(allColumnsMeta.slice(0, 9))

  const filtered = useMemo(() => applyFilters(data, filters), [filters])

  useEffect(() => {
    const id = getHashId()
    if (!id) return
    const hit = data.find((v) => v.id === id)
    if (hit) setSelected(hit)
  }, [])

  const openDetail = (item: Vorstoss) => {
    setSelected(item)
    setHashId(item.id)
  }

  const closeDetail = () => {
    setSelected(null)
    clearHashId()
  }

  const activeFilterCount = [
    filters.globalQuery,
    filters.von,
    filters.bis,
    filters.ebenen.length,
    filters.status.length,
    filters.kantone.length,
    filters.themen.length,
    filters.schlagwoerter.length,
  ].filter(Boolean).length

  const quickFilter = (kind: 'kantonal' | 'beratung' | 'letzte90') => {
    if (kind === 'kantonal') setFilters({ ...defaultFilters(), ebenen: ['Kanton'] })
    if (kind === 'beratung') setFilters({ ...defaultFilters(), status: ['In Beratung'] })
    if (kind === 'letzte90') {
      const today = new Date()
      const from = new Date(today.getTime() - 90 * 86400000).toISOString().slice(0, 10)
      setFilters({ ...defaultFilters(), von: from, bis: today.toISOString().slice(0, 10) })
    }
  }

  const onVisibleColumnsChange = useCallback((cols: { key: string; label: string }[]) => {
    setVisibleColumns(cols)
  }, [])

  return (
    <main className="container">
      <h1>Tierpolitik Vorstoesse Datenbank</h1>

      <div className="row wrap">
        <button className="chip" onClick={() => quickFilter('kantonal')}>Nur Kantonal</button>
        <button className="chip" onClick={() => quickFilter('beratung')}>In Beratung</button>
        <button className="chip" onClick={() => quickFilter('letzte90')}>Letzte 90 Tage</button>
      </div>

      <FiltersPanel data={data} filters={filters} onChange={setFilters} onReset={() => setFilters(defaultFilters())} activeCount={activeFilterCount} />

      <div className="row wrap">
        <strong>Treffer: {filtered.length}</strong>
      </div>

      <ExportButtons filtered={filtered} visibleColumns={visibleColumns} allColumns={allColumnsMeta} />

      <TableView data={filtered} onOpenDetail={openDetail} onVisibleColumnsChange={onVisibleColumnsChange} />

      <DetailDrawer item={selected} onClose={closeDetail} />
    </main>
  )
}
