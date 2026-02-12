import { flexRender, getCoreRowModel, getPaginationRowModel, getSortedRowModel, useReactTable, type ColumnDef, type VisibilityState } from '@tanstack/react-table'
import { useEffect, useMemo, useState } from 'react'
import type { Vorstoss } from '../types'

export const allColumnsMeta = [
  { key: 'titel', label: 'Titel' },
  { key: 'ebene', label: 'Ebene' },
  { key: 'kanton', label: 'Kanton' },
  { key: 'regionGemeinde', label: 'Region/Gemeinde' },
  { key: 'status', label: 'Status' },
  { key: 'datumEingereicht', label: 'Datum eingereicht' },
  { key: 'schlagwoerter', label: 'Schlagwörter' },
  { key: 'einreichende', label: 'Einreichende' },
  { key: 'linkGeschaeft', label: 'Link' },
  { key: 'geschaeftsnummer', label: 'Geschäftsnummer' },
  { key: 'themen', label: 'Themen' },
  { key: 'kurzbeschreibung', label: 'Kurzbeschreibung' },
]

type Props = {
  data: Vorstoss[]
  onOpenDetail: (v: Vorstoss) => void
  onVisibleColumnsChange: (cols: { key: string; label: string }[]) => void
}

export function TableView({ data, onOpenDetail, onVisibleColumnsChange }: Props) {
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    geschaeftsnummer: false,
    themen: false,
    kurzbeschreibung: false,
  })

  const columns = useMemo<ColumnDef<Vorstoss>[]>(() => [
    { accessorKey: 'titel', header: 'Titel' },
    { accessorKey: 'ebene', header: 'Ebene' },
    { accessorKey: 'kanton', header: 'Kanton', cell: (i) => i.getValue<string | null>() ?? '-' },
    { accessorKey: 'regionGemeinde', header: 'Region/Gemeinde', cell: (i) => i.getValue<string | null>() ?? '-' },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: (i) => {
        const value = i.getValue<string>()
        const slug = value.toLowerCase().replace(/\s+/g, '-')
        return <span className={`status-badge status-${slug}`}>{value}</span>
      },
    },
    { accessorKey: 'datumEingereicht', header: 'Datum eingereicht' },
    { accessorKey: 'schlagwoerter', header: 'Schlagwörter', cell: (i) => i.getValue<string[]>().join(', ') },
    { accessorKey: 'einreichende', header: 'Einreichende', cell: (i) => i.getValue<Vorstoss['einreichende']>().map((p) => p.name).join(', ') },
    { accessorKey: 'linkGeschaeft', header: 'Link', cell: (i) => <a href={i.getValue<string>()} target="_blank" rel="noopener">Öffnen</a> },
    { accessorKey: 'geschaeftsnummer', header: 'Geschäftsnummer' },
    { accessorKey: 'themen', header: 'Themen', cell: (i) => i.getValue<string[]>().join(', ') },
    { accessorKey: 'kurzbeschreibung', header: 'Kurzbeschreibung' },
  ], [])

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
  }, [columnVisibility, onVisibleColumnsChange, table])

  return (
    <section className="panel">
      <div className="row wrap">
        <details>
          <summary>Spalten ein-/ausblenden</summary>
          <div className="chips">
            {table.getAllLeafColumns().map((c) => (
              <label key={c.id}><input type="checkbox" checked={c.getIsVisible()} onChange={c.getToggleVisibilityHandler()} /> {allColumnsMeta.find((m) => m.key === c.id)?.label ?? c.id}</label>
            ))}
          </div>
        </details>

        <label>
          Seitenlänge
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
        <button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>Zurueck</button>
        <span>Seite {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}</span>
        <button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>Weiter</button>
      </div>
    </section>
  )
}
