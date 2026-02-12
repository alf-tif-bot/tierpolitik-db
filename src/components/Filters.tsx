import { useMemo, useState } from 'react'
import type { I18nText, Language } from '../i18n'
import { translateStatus } from '../i18n'
import type { Ebene, Status, Vorstoss } from '../types'
import type { Filters } from '../utils/filtering'

type Props = {
  data: Vorstoss[]
  filters: Filters
  onChange: (next: Filters) => void
  onReset: () => void
  activeCount: number
  lang: Language
  t: I18nText
}

function toggleValue<T extends string>(arr: T[], value: T): T[] {
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value]
}

type FilterItem = { value: string; label: string }

export function FiltersPanel({ data, filters, onChange, onReset, activeCount, lang, t }: Props) {
  const [showAdvanced, setShowAdvanced] = useState(false)

  const ebenen: FilterItem[] = [
    { value: 'Bund', label: t.section.federal },
    { value: 'Kanton', label: t.section.cantonal },
    { value: 'Gemeinde', label: t.section.municipal },
  ]

  const statuses: FilterItem[] = [
    'Eingereicht', 'In Beratung', 'Angenommen', 'Abgelehnt', 'Abgeschrieben',
  ].map((s) => ({ value: s, label: translateStatus(s, lang) }))

  const kantone = [
    'AG', 'AI', 'AR', 'BE', 'BL', 'BS', 'FR', 'GE', 'GL', 'GR', 'JU', 'LU', 'NE',
    'NW', 'OW', 'SG', 'SH', 'SO', 'SZ', 'TG', 'TI', 'UR', 'VD', 'VS', 'ZG', 'ZH',
  ]
  const themen = [...new Set(data.flatMap((d) => d.themen))].sort()
  const schlagwoerter = [...new Set(data.flatMap((d) => d.schlagwoerter))].sort()

  const advancedActiveCount = useMemo(() => {
    return [
      filters.von,
      filters.bis,
      filters.kantone.length,
      filters.themen.length,
      filters.schlagwoerter.length,
    ].filter(Boolean).length
  }, [filters])

  return (
    <section className="panel">
      <div className="filter-grid compact-search-grid">
        <label>
          {t.search}
          <input
            value={filters.globalQuery}
            onChange={(e) => onChange({ ...filters, globalQuery: e.target.value })}
            placeholder={t.searchPlaceholder}
          />
        </label>
      </div>

      <div className="multi-row compact-search-row">
        <MultiItems title={t.level} values={ebenen} selected={filters.ebenen} onToggle={(v) => onChange({ ...filters, ebenen: toggleValue(filters.ebenen, v as Ebene) })} />
        <MultiItems title={t.status} values={statuses} selected={filters.status} onToggle={(v) => onChange({ ...filters, status: toggleValue(filters.status, v as Status) })} />
      </div>

      <div className="row wrap filter-actions">
        <button type="button" onClick={() => setShowAdvanced((s) => !s)}>
          {showAdvanced ? t.detailsSearchHide : t.detailsSearchShow}
        </button>

        {!showAdvanced && advancedActiveCount > 0 && <span className="advanced-hint">{t.detailsActive}: {advancedActiveCount}</span>}

        <span>{t.activeFilters}: {activeCount}</span>
        <button onClick={onReset}>{t.resetFilters}</button>
      </div>

      {showAdvanced && (
        <div className="advanced-search">
          <div className="filter-grid">
            <label>
              {t.from}
              <input type="date" value={filters.von} onChange={(e) => onChange({ ...filters, von: e.target.value })} />
            </label>
            <label>
              {t.to}
              <input type="date" value={filters.bis} onChange={(e) => onChange({ ...filters, bis: e.target.value })} />
            </label>
          </div>

          <div className="multi-row">
            <Multi title={t.canton} values={kantone} selected={filters.kantone} onToggle={(v) => onChange({ ...filters, kantone: toggleValue(filters.kantone, v) })} />
            <Multi title={t.themes} values={themen} selected={filters.themen} onToggle={(v) => onChange({ ...filters, themen: toggleValue(filters.themen, v) })} />
            <Multi title={t.keywords} values={schlagwoerter} selected={filters.schlagwoerter} onToggle={(v) => onChange({ ...filters, schlagwoerter: toggleValue(filters.schlagwoerter, v) })} />
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
