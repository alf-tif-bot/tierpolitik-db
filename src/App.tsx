import { useCallback, useEffect, useMemo, useState } from 'react'
import rawData from '../data/vorstoesse.json'
import './App.css'
import { DetailDrawer } from './components/DetailDrawer'
import { ExportButtons } from './components/ExportButtons'
import { FiltersPanel } from './components/Filters'
import { getAllColumnsMeta, TableView } from './components/TableView'
import { i18n, languageNames, type Language } from './i18n'
import { validateVorstoesse, type Vorstoss } from './types'
import { applyFilters, defaultFilters, type Filters } from './utils/filtering'
import { clearHashId, getHashId, setHashId } from './utils/urlHash'

const data = validateVorstoesse(rawData)

export default function App() {
  const [lang, setLang] = useState<Language>('de')
  const [filters, setFilters] = useState<Filters>(defaultFilters)
  const [selected, setSelected] = useState<Vorstoss | null>(null)
  const [visibleColumns, setVisibleColumns] = useState<{ key: string; label: string }[]>([])

  const t = i18n[lang]
  const allColumnsMeta = useMemo(() => getAllColumnsMeta(t), [t])
  const filtered = useMemo(() => applyFilters(data, filters), [filters])

  useEffect(() => {
    const id = getHashId()
    if (!id) return
    const hit = data.find((v) => v.id === id)
    if (hit) setSelected(hit)
  }, [])

  useEffect(() => {
    setVisibleColumns(allColumnsMeta.slice(0, 8))
  }, [allColumnsMeta])

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
  ].filter(Boolean).length

  const onVisibleColumnsChange = useCallback((cols: { key: string; label: string }[]) => {
    setVisibleColumns(cols)
  }, [])

  return (
    <main className="container">
      <header className="hero-head">
        <div className="language-switch row">
          <div className="chips">
            {(Object.keys(languageNames) as Language[]).map((code) => (
              <button key={code} className={lang === code ? 'chip active' : 'chip'} type="button" onClick={() => setLang(code)}>
                {languageNames[code]}
              </button>
            ))}
          </div>
        </div>
        <h1>{t.title}</h1>
        <p className="brand-sub">{t.subtitle}</p>
      </header>

      <FiltersPanel data={data} filters={filters} onChange={setFilters} onReset={() => setFilters(defaultFilters())} activeCount={activeFilterCount} lang={lang} t={t} />

      <div className="row wrap">
        <strong>{t.results}: {filtered.length}</strong>
      </div>

      <TableView data={filtered} onOpenDetail={openDetail} onVisibleColumnsChange={onVisibleColumnsChange} lang={lang} t={t} />

      <ExportButtons filtered={filtered} visibleColumns={visibleColumns} allColumns={allColumnsMeta} t={t} />

      <DetailDrawer item={selected} onClose={closeDetail} lang={lang} t={t} />

      <footer className="project-footer">
        <span>{t.projectBy}</span>
        <a href="https://www.tierimfokus.ch" target="_blank" rel="noopener noreferrer" aria-label="Tier im Fokus Website">
          <img className="footer-logo light" src="/branding/TIF_Logo_gruen_schwarz.png" alt="Tier im Fokus" />
          <img className="footer-logo dark" src="/branding/TIF_Logo_gruen_weiss.png" alt="Tier im Fokus" />
        </a>
      </footer>
    </main>
  )
}
