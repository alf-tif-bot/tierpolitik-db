import { flexRender, getCoreRowModel, getPaginationRowModel, getSortedRowModel, useReactTable, type ColumnDef, type VisibilityState } from '@tanstack/react-table'
import { useEffect, useMemo, useState } from 'react'
import type { I18nText, Language } from '../i18n'
import { translateContent, translateStatus } from '../i18n'
import type { Vorstoss } from '../types'
import { formatDateCH } from '../utils/date'

export const getAllColumnsMeta = (t: I18nText) => [
  { key: 'titel', label: 'Titel' },
  { key: 'ebene', label: t.level },
  { key: 'kanton', label: t.canton },
  { key: 'regionGemeinde', label: t.region },
  { key: 'status', label: t.status },
  { key: 'datumEingereicht', label: t.dateSubmitted },
  { key: 'schlagwoerter', label: t.keywords },
  { key: 'linkGeschaeft', label: 'Link' },
  { key: 'geschaeftsnummer', label: t.businessNo },
  { key: 'themen', label: t.themes },
  { key: 'kurzbeschreibung', label: 'Kurzbeschreibung' },
]

type Props = {
  data: Vorstoss[]
  onOpenDetail: (v: Vorstoss) => void
  onVisibleColumnsChange: (cols: { key: string; label: string }[]) => void
  lang: Language
  t: I18nText
}

export function TableView({ data, onOpenDetail, onVisibleColumnsChange, lang, t }: Props) {
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    geschaeftsnummer: false,
    themen: false,
    kurzbeschreibung: false,
  })

  const allColumnsMeta = useMemo(() => getAllColumnsMeta(t), [t])

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
    { accessorKey: 'schlagwoerter', header: t.keywords, cell: (i) => i.getValue<string[]>().map((v) => translateContent(v, lang)).join(', ') },
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
    state: { columnVisibility },
    initialState: { pagination: { pageSize: 10 } },
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
        <table>
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => (
                  <th key={h.id} onClick={h.column.getToggleSortingHandler()}>
                    {flexRender(h.column.columnDef.header, h.getContext())}
                    {h.column.getIsSorted() === 'asc' ? ' ▲' : h.column.getIsSorted() === 'desc' ? ' ▼' : ''}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((r) => (
              <tr key={r.id} onClick={() => onOpenDetail(r.original)}>
                {r.getVisibleCells().map((c) => <td key={c.id}>{flexRender(c.column.columnDef.cell, c.getContext())}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="row">
        <button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>{t.back}</button>
        <span>{t.page} {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}</span>
        <button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>{t.next}</button>
      </div>
    </section>
  )
}
