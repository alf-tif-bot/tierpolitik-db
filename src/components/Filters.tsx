import { useMemo, useState, type RefObject } from 'react'
import type { I18nText, Language } from '../i18n'
import { translateContent, translateStatus, translateType } from '../i18n'
import type { Ebene, Status, Vorstoss } from '../types'
import { defaultFilters, type Filters } from '../utils/filtering'

type Props = {
  data: Vorstoss[]
  filters: Filters
  onChange: (next: Filters) => void
  lang: Language
  t: I18nText
  searchInputRef?: RefObject<HTMLInputElement | null>
}

function toggleValue<T extends string>(arr: T[], value: T): T[] {
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value]
}

type FilterItem = { value: string; label: string }

function normalizeDateInput(raw: string): string {
  const value = String(raw || '').trim()
  if (!value) return ''

  const iso = value.match(/^(\d{4,})-(\d{1,2})-(\d{1,2})$/)
  if (iso) {
    const year = iso[1].slice(0, 4)
    const month = iso[2].padStart(2, '0').slice(0, 2)
    const day = iso[3].padStart(2, '0').slice(0, 2)
    return `${year}-${month}-${day}`
  }

  const slash = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4,})$/)
  if (slash) {
    const month = slash[1].padStart(2, '0').slice(0, 2)
    const day = slash[2].padStart(2, '0').slice(0, 2)
    const year = slash[3].slice(0, 4)
    return `${year}-${month}-${day}`
  }

  return value
}

export function FiltersPanel({ data, filters, onChange, lang, t, searchInputRef }: Props) {
  const [showAdvanced, setShowAdvanced] = useState(false)

  const ebenen: FilterItem[] = [
    { value: 'Bund', label: t.section.federal },
    { value: 'Kanton', label: t.section.cantonal },
    { value: 'Gemeinde', label: t.section.municipal },
  ]

  const statuses: FilterItem[] = [
    'In Beratung', 'Angenommen', 'Abgelehnt', 'Abgeschrieben', 'Zurückgezogen',
  ].map((s) => ({ value: s, label: translateStatus(s, lang) }))

  const kantone = [
    'AG', 'AI', 'AR', 'BE', 'BL', 'BS', 'FR', 'GE', 'GL', 'GR', 'JU', 'LU', 'NE',
    'NW', 'OW', 'SG', 'SH', 'SO', 'SZ', 'TG', 'TI', 'UR', 'VD', 'VS', 'ZG', 'ZH',
  ]
  const typenItems: FilterItem[] = [...new Set(data.map((d) => d.typ))]
    .sort((a, b) => a.localeCompare(b, 'de-CH'))
    .map((v) => ({ value: v, label: translateType(v, lang) }))
  const defaultThemes = [...new Set(data.flatMap((d) => d.themen))]
  const themen = [...new Set([...defaultThemes, 'Unsichtbare Tiere'])].sort((a, b) => a.localeCompare(b, 'de-CH'))
  const themenItems: FilterItem[] = themen.map((v) => ({ value: v, label: translateContent(v, lang) }))

  const advancedActiveCount = useMemo(() => {
    return [
      filters.von,
      filters.bis,
      filters.kantone.length,
      filters.themen.length,
    ].filter(Boolean).length
  }, [filters])

  return (
    <section className="panel">
      <div className="filter-grid compact-search-grid">
        <label>
          {t.search}
          <input
            ref={searchInputRef}
            value={filters.globalQuery}
            onChange={(e) => onChange({ ...filters, globalQuery: e.target.value })}
            placeholder={t.searchPlaceholder}
          />
        </label>
      </div>

      <div className="multi-row compact-search-row">
        <MultiItems title={t.type} values={typenItems} selected={filters.typen} onToggle={(v) => onChange({ ...filters, typen: toggleValue(filters.typen, v) })} />
        <MultiItems title={t.level} values={ebenen} selected={filters.ebenen} onToggle={(v) => onChange({ ...filters, ebenen: toggleValue(filters.ebenen, v as Ebene) })} />
        <MultiItems title={t.status} values={statuses} selected={filters.status} onToggle={(v) => onChange({ ...filters, status: toggleValue(filters.status, v as Status) })} />
      </div>

      <div className="row wrap filter-actions">
        <button type="button" className="text-link-btn" onClick={() => setShowAdvanced((s) => !s)}>
          {showAdvanced ? t.detailsSearchHide : t.detailsSearchShow}
        </button>
        <button type="button" className="text-link-btn" onClick={() => onChange(defaultFilters())}>
          {t.resetFilters}
        </button>

        {!showAdvanced && advancedActiveCount > 0 && <span className="advanced-hint">{t.detailsActive}: {advancedActiveCount}</span>}
      </div>

      {showAdvanced && (
        <div className="advanced-search">
          <div className="filter-grid">
            <label>
              {t.from}
              <input
                type="date"
                min="1000-01-01"
                max="9999-12-31"
                value={filters.von}
                onChange={(e) => onChange({ ...filters, von: normalizeDateInput(e.target.value) })}
                onBlur={(e) => onChange({ ...filters, von: normalizeDateInput(e.target.value) })}
              />
            </label>
            <label>
              {t.to}
              <input
                type="date"
                min="1000-01-01"
                max="9999-12-31"
                value={filters.bis}
                onChange={(e) => onChange({ ...filters, bis: normalizeDateInput(e.target.value) })}
                onBlur={(e) => onChange({ ...filters, bis: normalizeDateInput(e.target.value) })}
              />
            </label>
          </div>

          <div className="multi-row">
            <Multi title={t.canton} values={kantone} selected={filters.kantone} onToggle={(v) => onChange({ ...filters, kantone: toggleValue(filters.kantone, v) })} />
            <MultiItems title={t.themes} values={themenItems} selected={filters.themen} onToggle={(v) => onChange({ ...filters, themen: toggleValue(filters.themen, v) })} />
          </div>
        </div>
      )}
    </section>
  )
}

function Multi({ title, values, selected, onToggle }: { title: string; values: string[]; selected: string[]; onToggle: (v: string) => void }) {
  return (
    <fieldset>
      <legend>{title}</legend>
      <div className="chips">
        {values.map((v) => (
          <button key={v} className={selected.includes(v) ? 'chip active' : 'chip'} onClick={() => onToggle(v)} type="button">
            {v}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

function MultiItems({ title, values, selected, onToggle }: { title: string; values: FilterItem[]; selected: string[]; onToggle: (v: string) => void }) {
  return (
    <fieldset>
      <legend>{title}</legend>
      <div className="chips">
        {values.map((item) => (
          <button key={item.value} className={selected.includes(item.value) ? 'chip active' : 'chip'} onClick={() => onToggle(item.value)} type="button">
            {item.label}
          </button>
        ))}
      </div>
    </fieldset>
  )
}
