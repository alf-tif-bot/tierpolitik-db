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
import { localizedMetaText, localizedMetaType, translateStatus } from '../i18n'
import type { Vorstoss } from '../types'
import { formatDateCH } from '../utils/date'

export const getAllColumnsMeta = (t: I18nText) => [
  { key: 'titel', label: t.titleCol },
  { key: 'typ', label: t.type },
  { key: 'status', label: t.status },
  { key: 'datumEingereicht', label: t.dateSubmitted },
  { key: 'ebene', label: t.level },
  { key: 'kanton', label: t.canton },
]

type Props = {
  data: Vorstoss[]
  onOpenDetail: (v: Vorstoss) => void
  onVisibleColumnsChange: (cols: { key: string; label: string }[]) => void
  keyboardEnabled?: boolean
  sectionId?: string
  lang: Language
  t: I18nText
}

const TABLE_PREFS_KEY = 'tierpolitik.table.prefs.v1'
const PAGE_SIZE_OPTIONS = [25, 50, 100]
const normalizeTitle = (value: string) => value
  .replace(/^Vorstoss\s+\d+\s*:\s*/i, '')
  .replace(/^\s*\d{2}\.\d{3,4}\s*[·\-–—:]\s*/u, '')

export function TableView({ data, onOpenDetail, onVisibleColumnsChange, keyboardEnabled = true, sectionId, lang, t }: Props) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [pageSize, setPageSize] = useState(25)
  const [highlightedRow, setHighlightedRow] = useState(0)

  const allColumnsMeta = useMemo(() => getAllColumnsMeta(t), [t])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(TABLE_PREFS_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as { sorting?: SortingState; pageSize?: number }
      if (parsed.sorting) setSorting(parsed.sorting)
      if (parsed.pageSize && PAGE_SIZE_OPTIONS.includes(parsed.pageSize)) setPageSize(parsed.pageSize)
    } catch {
      // ignore broken prefs
    }
  }, [])

  useEffect(() => {
    const payload = JSON.stringify({ sorting, pageSize })
    localStorage.setItem(TABLE_PREFS_KEY, payload)
  }, [sorting, pageSize])

  const columns = useMemo<ColumnDef<Vorstoss>[]>(() => [
    { accessorKey: 'titel', header: t.titleCol, cell: (i) => normalizeTitle(localizedMetaText(i.row.original, 'title', lang, i.getValue<string>())) },
    { accessorKey: 'typ', header: t.type, cell: (i) => localizedMetaType(i.row.original, lang) },
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
    initialState: { pagination: { pageSize: 25 } },
  })

  useEffect(() => {
    onVisibleColumnsChange(allColumnsMeta)
  }, [allColumnsMeta, onVisibleColumnsChange])

  useEffect(() => {
    table.setPageSize(pageSize)
  }, [pageSize, table])

  useEffect(() => {
    const pageRows = table.getRowModel().rows
    if (!pageRows.length) {
      setHighlightedRow(0)
      return
    }
    setHighlightedRow((prev) => Math.min(prev, pageRows.length - 1))
  }, [table.getState().pagination.pageIndex, table.getState().pagination.pageSize, sorting, data.length])

  useEffect(() => {
    if (!keyboardEnabled) return

    const isTypingTarget = (el: EventTarget | null) => {
      const node = el as HTMLElement | null
      if (!node) return false
      return node.tagName === 'INPUT' || node.tagName === 'TEXTAREA' || node.tagName === 'SELECT' || node.isContentEditable
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (isTypingTarget(event.target)) return

      const pageRows = table.getRowModel().rows
      if (!pageRows.length) return

      if (event.key.toLowerCase() === 'j') {
        event.preventDefault()
        setHighlightedRow((prev) => Math.min(prev + 1, pageRows.length - 1))
      }

      if (event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setHighlightedRow((prev) => Math.max(prev - 1, 0))
      }

      if (event.key === 'Enter') {
        event.preventDefault()
        const row = pageRows[highlightedRow]
        if (row) onOpenDetail(row.original)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [keyboardEnabled, highlightedRow, onOpenDetail, table, data.length])

  return (
    <section id={sectionId} className="panel">
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
              {table.getRowModel().rows.map((r, idx) => (
                <tr
                  key={r.id}
                  className={idx === highlightedRow ? 'row-highlight' : ''}
                  onClick={() => {
                    setHighlightedRow(idx)
                    onOpenDetail(r.original)
                  }}
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
        <span className="page-size-links">
          Anzeigen:&nbsp;
          {PAGE_SIZE_OPTIONS.map((size, idx) => (
            <span key={size}>
              <button
                type="button"
                className={pageSize === size ? 'text-link-btn active' : 'text-link-btn'}
                onClick={() => {
                  setPageSize(size)
                  table.setPageIndex(0)
                }}
              >
                {size}
              </button>
              {idx < PAGE_SIZE_OPTIONS.length - 1 ? ' / ' : ''}
            </span>
          ))}
        </span>
      </div>
    </section>
  )
}
