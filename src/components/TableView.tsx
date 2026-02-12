import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table'
import { useEffect, useMemo, useState } from 'react'
import type { I18nText, Language } from '../i18n'
import { translateContent, translateStatus } from '../i18n'
import type { Vorstoss } from '../types'
import { formatDateCH } from '../utils/date'

export const getAllColumnsMeta = (t: I18nText) => [
  { key: 'titel', label: t.titleCol },
  { key: 'ebene', label: t.level },
  { key: 'kanton', label: t.canton },
  { key: 'regionGemeinde', label: t.region },
  { key: 'status', label: t.status },
  { key: 'datumEingereicht', label: t.dateSubmitted },
  { key: 'linkGeschaeft', label: 'Link' },
  { key: 'geschaeftsnummer', label: t.businessNo },
  { key: 'themen', label: t.themes },
  { key: 'kurzbeschreibung', label: t.shortDescription },
]

type Props = {
  data: Vorstoss[]
  onOpenDetail: (v: Vorstoss) => void
  onVisibleColumnsChange: (cols: { key: string; label: string }[]) => void
  lang: Language
  t: I18nText
}

const TABLE_PREFS_KEY = 'tierpolitik.table.prefs.v1'

export function TableView({ data, onOpenDetail, onVisibleColumnsChange, lang, t }: Props) {
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    geschaeftsnummer: false,
    themen: false,
    kurzbeschreibung: false,
  })
  const [sorting, setSorting] = useState<SortingState>([])
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 })

  const allColumnsMeta = useMemo(() => getAllColumnsMeta(t), [t])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(TABLE_PREFS_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as {
        columnVisibility?: VisibilityState
        sorting?: SortingState
        pageSize?: number
      }
      if (parsed.columnVisibility) setColumnVisibility(parsed.columnVisibility)
      if (parsed.sorting) setSorting(parsed.sorting)
      if (parsed.pageSize && [10, 25, 50].includes(parsed.pageSize)) {
        setPagination((prev) => ({ ...prev, pageSize: parsed.pageSize as 10 | 25 | 50 }))
      }
    } catch {
      // ignore broken prefs
    }
  }, [])

  useEffect(() => {
    const payload = JSON.stringify({ columnVisibility, sorting, pageSize: pagination.pageSize })
    localStorage.setItem(TABLE_PREFS_KEY, payload)
  }, [columnVisibility, sorting, pagination.pageSize])

  const columns = useMemo<ColumnDef<Vorstoss>[]>(() => [
    { accessorKey: 'titel', header: t.titleCol, cell: (i) => translateContent(i.getValue<string>(), lang) },
    {
      accessorKey: 'ebene',
      header: t.level,
      cell: (i) => {
        const value = i.getValue<string>()
        if (value === 'Bund') return t.section.federal
        if (value === 'Kanton') return t.section.cantonal
        if (value === 'Gemeinde') return t.section.municipal
        return value
      },
    },
    { accessorKey: 'kanton', header: t.canton, cell: (i) => i.getValue<string | null>() ?? '-' },
    { accessorKey: 'regionGemeinde', header: t.region, cell: (i) => i.getValue<string | null>() ?? '-' },
    {
      accessorKey: 'status',
      header: t.status,
      cell: (i) => {
        const value = i.getValue<string>()
        const slug = value.toLowerCase().replace(/\s+/g, '-')
        return <span className={`status-badge status-${slug}`}>{translateStatus(value, lang)}</span>
      },
    },
    { accessorKey: 'datumEingereicht', header: t.dateSubmitted, cell: (i) => formatDateCH(i.getValue<string>()) },
    { accessorKey: 'linkGeschaeft', header: 'Link', cell: (i) => <a href={i.getValue<string>()} target="_blank" rel="noopener">{t.open}</a> },
    { accessorKey: 'geschaeftsnummer', header: t.businessNo },
    { accessorKey: 'themen', header: t.themes, cell: (i) => i.getValue<string[]>().map((v) => translateContent(v, lang)).join(', ') },
    { accessorKey: 'kurzbeschreibung', header: t.shortDescription, cell: (i) => translateContent(i.getValue<string>(), lang) },
  ], [lang, t])

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onSortingChange: setSorting,
    state: {
      columnVisibility,
      sorting,
      pagination,
    },
    onPaginationChange: setPagination,
    initialState: { pagination },
  })

  useEffect(() => {
    const visibleCols = table
      .getVisibleLeafColumns()
      .map((c) => allColumnsMeta.find((m) => m.key === c.id))
      .filter(Boolean) as { key: string; label: string }[]
    onVisibleColumnsChange(visibleCols)
  }, [allColumnsMeta, columnVisibility, onVisibleColumnsChange, table])

  return (
    <section className="panel">
      <div className="row wrap">
        <details>
          <summary>{t.columnsToggle}</summary>
          <div className="chips">
            {table.getAllLeafColumns().map((c) => (
              <label key={c.id}><input type="checkbox" checked={c.getIsVisible()} onChange={c.getToggleVisibilityHandler()} /> {allColumnsMeta.find((m) => m.key === c.id)?.label ?? c.id}</label>
            ))}
          </div>
        </details>

        <label>
          {t.pageSize}
          <select value={table.getState().pagination.pageSize} onChange={(e) => table.setPageSize(Number(e.target.value))}>
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>
        </label>
      </div>

      <div className="table-wrap">
        <div className="table-scroll">
          <table>
            <thead>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((h, idx) => {
                    const sorted = h.column.getIsSorted()
                    const isSticky = idx === 0
                    return (
                      <th key={h.id} className={`${isSticky ? 'sticky-col' : ''} ${sorted ? 'is-sorted' : ''}`}>
                        <button className="sort-btn" type="button" onClick={h.column.getToggleSortingHandler()}>
                          <span>{flexRender(h.column.columnDef.header, h.getContext())}</span>
                          <span className="sort-indicator" aria-hidden>
                            {sorted === 'asc' ? '▲' : sorted === 'desc' ? '▼' : '↕'}
                          </span>
                        </button>
                      </th>
                    )
                  })}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((r) => (
                <tr key={r.id} onClick={() => onOpenDetail(r.original)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onOpenDetail(r.original)}>
                  {r.getVisibleCells().map((c, idx) => <td key={c.id} className={idx === 0 ? 'sticky-col cell-title' : ''}>{flexRender(c.column.columnDef.cell, c.getContext())}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="row pagination-row">
        <button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>{t.back}</button>
        <span>{t.page} {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}</span>
        <button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>{t.next}</button>
      </div>
    </section>
  )
}
