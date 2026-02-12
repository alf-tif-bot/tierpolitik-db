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

  const onVisibleColumnsChange = useCallback((cols: { key: string; label: string }[]) => {
    setVisibleColumns(cols)
  }, [])

  return (
    <main className="container">
      <header className="panel">
        <h1>Tierpolitik-Monitor Schweiz</h1>
        <p className="brand-sub">Die wichtigsten parlamentarischen Vorstösse rund um Tierschutz und Tierrechte.</p>
      </header>

      <FiltersPanel data={data} filters={filters} onChange={setFilters} onReset={() => setFilters(defaultFilters())} activeCount={activeFilterCount} />

      <div className="row wrap">
        <strong>Treffer: {filtered.length}</strong>
      </div>

      <TableView data={filtered} onOpenDetail={openDetail} onVisibleColumnsChange={onVisibleColumnsChange} />

      <ExportButtons filtered={filtered} visibleColumns={visibleColumns} allColumns={allColumnsMeta} />

      <DetailDrawer item={selected} onClose={closeDetail} />

      <footer className="project-footer">
        <span>Ein Projekt von</span>
        <img className="footer-logo light" src="/branding/TIF_Logo_gruen_schwarz.png" alt="Tier im Fokus" />
        <img className="footer-logo dark" src="/branding/TIF_Logo_gruen_weiss.png" alt="Tier im Fokus" />
      </footer>
    </main>
  )
}
