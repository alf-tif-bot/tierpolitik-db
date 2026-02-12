import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table'
import { useEffect, useMemo, useState } from 'react'
import type { I18nText, Language } from '../i18n'
import { translateContent, translateStatus } from '../i18n'
import type { Vorstoss } from '../types'
import { formatDateCH } from '../utils/date'

export const getAllColumnsMeta = (t: I18nText) => [
  { key: 'titel', label: t.titleCol },
  { key: 'status', label: t.status },
  { key: 'datumEingereicht', label: t.dateSubmitted },
  { key: 'ebene', label: t.level },
  { key: 'kanton', label: t.canton },
]

type Props = {
  data: Vorstoss[]
  onOpenDetail: (v: Vorstoss) => void
  onVisibleColumnsChange: (cols: { key: string; label: string }[]) => void
  highlightedId?: string
  lang: Language
  t: I18nText
}

const TABLE_PREFS_KEY = 'tierpolitik.table.prefs.v1'
const normalizeTitle = (value: string) => value.replace(/^Vorstoss\s+\d+\s*:\s*/i, '')

export function TableView({ data, onOpenDetail, onVisibleColumnsChange, highlightedId, lang, t }: Props) {
  const [sorting, setSorting] = useState<SortingState>([])

  const allColumnsMeta = useMemo(() => getAllColumnsMeta(t), [t])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(TABLE_PREFS_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as { sorting?: SortingState }
      if (parsed.sorting) setSorting(parsed.sorting)
    } catch {
      // ignore broken prefs
    }
  }, [])

  useEffect(() => {
    const payload = JSON.stringify({ sorting })
    localStorage.setItem(TABLE_PREFS_KEY, payload)
  }, [sorting])

  const columns = useMemo<ColumnDef<Vorstoss>[]>(() => [
    { accessorKey: 'titel', header: t.titleCol, cell: (i) => normalizeTitle(translateContent(i.getValue<string>(), lang)) },
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
  ], [lang, t])

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    state: { sorting },
    initialState: { pagination: { pageSize: 10 } },
  })

  useEffect(() => {
    onVisibleColumnsChange(allColumnsMeta)
  }, [allColumnsMeta, onVisibleColumnsChange])

  return (
    <section className="panel">
      <div className="table-wrap">
        <div className="table-scroll">
          <table>
            <thead>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((h) => {
                    const sorted = h.column.getIsSorted()
                    return (
                      <th key={h.id} className={sorted ? 'is-sorted' : ''}>
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
                <tr
                  key={r.id}
                  className={r.original.id === highlightedId ? 'row-highlight' : ''}
                  onClick={() => onOpenDetail(r.original)}
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && onOpenDetail(r.original)}
                >
                  {r.getVisibleCells().map((c, idx) => <td key={c.id} className={idx === 0 ? 'cell-title' : ''}>{flexRender(c.column.columnDef.cell, c.getContext())}</td>)}
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
