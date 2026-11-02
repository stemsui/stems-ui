import { on, type Handle, type Props, type RemixNode } from 'remix/component'
import type { Column, Row, RowData } from '@tanstack/table-core'

import {
  renderDataTableTemplate,
  type DataTableFeatures,
  type DataTableInstance,
} from '#stems/lib/data-table.ts'
import { cn } from '#stems/lib/utils.ts'
import { Button, buttonVariants } from '#stems/ui/button.tsx'
import { Checkbox, type CheckboxProps } from '#stems/ui/checkbox.tsx'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#stems/ui/dropdown-menu.tsx'
import { Input, type InputProps } from '#stems/ui/input.tsx'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '#stems/ui/select.tsx'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '#stems/ui/table.tsx'

export {
  createDataTable,
  createDataTableColumnHelper,
  dataTableFeatures,
  renderDataTableTemplate,
  type DataTableColumnDef,
  type DataTableColumnMeta,
  type DataTableFeatures,
  type DataTableInstance,
  type DataTableOptions,
  type ColumnFiltersState,
  type ColumnVisibilityState,
  type PaginationState,
  type RowSelectionState,
  type SortingState,
  type Updater,
} from '#stems/lib/data-table.ts'

export type DataTableProps<TData extends RowData> = Omit<Props<'div'>, 'children'> & {
  table: DataTableInstance<TData>
  tableProps?: Props<'table'>
  caption?: RemixNode
  empty?: RemixNode
  loading?: boolean
  loadingContent?: RemixNode
  showFooter?: boolean
  rowProps?: (row: Row<DataTableFeatures, TData>) => Props<'tr'>
}

/** Semantic table rendering only. Compose toolbar and pagination alongside it. */
export function DataTable<TData extends RowData>(handle: Handle<DataTableProps<TData>>) {
  return () => {
    let {
      table,
      tableProps,
      caption,
      empty = 'No results.',
      loading = false,
      loadingContent = 'Loading…',
      showFooter = false,
      rowProps,
      class: className,
      ...props
    } = handle.props
    let rows = table.getRowModel().rows
    let colSpan = Math.max(1, table.getVisibleLeafColumns().length)
    return (
      <div
        data-slot="data-table"
        {...props}
        class={cn('overflow-hidden rounded-md border', className)}
      >
        <Table {...tableProps} aria-busy={loading ? 'true' : 'false'}>
          {caption != null ? <TableCaption>{caption}</TableCaption> : null}
          <TableHeader>
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id}>
                {group.headers.map((header) => {
                  let sorted = header.column.getIsSorted()
                  return (
                    <TableHead
                      key={header.id}
                      colSpan={header.colSpan}
                      scope={header.subHeaders.length > 0 ? 'colgroup' : 'col'}
                      aria-sort={
                        header.isPlaceholder ||
                        header.subHeaders.length > 0 ||
                        !header.column.getCanSort()
                          ? undefined
                          : sorted === 'asc'
                            ? 'ascending'
                            : sorted === 'desc'
                              ? 'descending'
                              : 'none'
                      }
                      class={header.column.columnDef.meta?.headerClass}
                    >
                      {header.isPlaceholder
                        ? null
                        : renderDataTableTemplate(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading || rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={colSpan} class="h-24 text-center">
                  <span role="status">{loading ? loadingContent : empty}</span>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-selected={row.getIsSelected() ? '' : undefined}
                  {...rowProps?.(row)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} class={cell.column.columnDef.meta?.cellClass}>
                      {renderDataTableTemplate(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
          {showFooter ? (
            <TableFooter>
              {table.getFooterGroups().map((group) => (
                <TableRow key={group.id}>
                  {group.headers.map((header) => (
                    <TableCell
                      key={header.id}
                      colSpan={header.colSpan}
                      class={header.column.columnDef.meta?.footerClass}
                    >
                      {header.isPlaceholder
                        ? null
                        : renderDataTableTemplate(
                            header.column.columnDef.footer,
                            header.getContext(),
                          )}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableFooter>
          ) : null}
        </Table>
      </div>
    )
  }
}

export type DataTableColumnHeaderProps<TData extends RowData, TValue = unknown> = Props<'div'> & {
  column: Column<DataTableFeatures, TData, TValue>
  title: string
}

/** Sort ascending/descending, clear sorting, or hide a column. */
export function DataTableColumnHeader<TData extends RowData, TValue = unknown>(
  handle: Handle<DataTableColumnHeaderProps<TData, TValue>>,
) {
  return () => {
    let { column, title, class: className, ...props } = handle.props
    let sortable = column.getCanSort()
    let hideable = column.getCanHide()
    let sorted = column.getIsSorted()
    return (
      <div
        data-slot="data-table-column-header"
        {...props}
        class={cn('flex items-center gap-2', className)}
      >
        {sortable || hideable ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              class={buttonVariants({ variant: 'ghost', size: 'sm', class: '-ms-2.5' })}
              aria-label={`${title} column options`}
            >
              {title}
              <DataTableIcon
                name={sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : 'sort'}
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" class="w-40">
              {sortable ? (
                <>
                  <DropdownMenuItem mix={on('click', () => column.toggleSorting(false))}>
                    <DataTableIcon name="ascending" />
                    Ascending
                  </DropdownMenuItem>
                  <DropdownMenuItem mix={on('click', () => column.toggleSorting(true))}>
                    <DataTableIcon name="descending" />
                    Descending
                  </DropdownMenuItem>
                  {sorted ? (
                    <DropdownMenuItem mix={on('click', () => column.clearSorting())}>
                      Clear sorting
                    </DropdownMenuItem>
                  ) : null}
                </>
              ) : null}
              {sortable && hideable ? <DropdownMenuSeparator /> : null}
              {hideable ? (
                <DropdownMenuItem mix={on('click', () => column.toggleVisibility(false))}>
                  <DataTableIcon name="hide" />
                  Hide column
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          title
        )}
      </div>
    )
  }
}

export type DataTableViewOptionsProps<TData extends RowData> = Props<'div'> & {
  table: DataTableInstance<TData>
  labels?: Record<string, string>
}

export function DataTableViewOptions<TData extends RowData>(
  handle: Handle<DataTableViewOptionsProps<TData>>,
) {
  return () => {
    let { table, labels, class: className, ...props } = handle.props
    let columns = table
      .getAllLeafColumns()
      .filter((column) => column.accessorFn && column.getCanHide())
    return (
      <div data-slot="data-table-view-options" {...props} class={cn('ms-auto', className)}>
        <DropdownMenu>
          <DropdownMenuTrigger
            disabled={columns.length === 0}
            class={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            <DataTableIcon name="columns" />
            Columns
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" class="w-44">
            <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {columns.map((column) => (
              <DropdownMenuCheckboxItem
                key={column.id}
                checked={column.getIsVisible()}
                onCheckedChange={(checked) => column.toggleVisibility(checked)}
              >
                {labels?.[column.id] ??
                  column.columnDef.meta?.label ??
                  (typeof column.columnDef.header === 'string'
                    ? column.columnDef.header
                    : column.id)}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    )
  }
}

export type DataTableFilterProps<TData extends RowData> = Omit<
  InputProps,
  'value' | 'defaultValue'
> & {
  table: DataTableInstance<TData>
  /** Omit for global search; provide a column id for a column filter. */
  columnId?: string
}

export function DataTableFilter<TData extends RowData>(
  handle: Handle<DataTableFilterProps<TData>>,
) {
  return () => {
    let { table, columnId, class: className, mix, ...props } = handle.props
    let column = columnId === undefined ? undefined : table.getColumn(columnId)
    let value = columnId === undefined ? table.atoms.globalFilter.get() : column?.getFilterValue()
    return (
      <Input
        data-slot="data-table-filter"
        aria-label={columnId === undefined ? 'Search table' : `Filter ${columnId}`}
        placeholder="Filter…"
        disabled={columnId !== undefined && (!column || !column.getCanFilter())}
        {...props}
        class={cn('max-w-sm', className)}
        value={typeof value === 'string' ? value : ''}
        mix={[
          on<HTMLInputElement, 'input'>('input', (event) => {
            let next = event.currentTarget.value
            if (columnId === undefined) table.setGlobalFilter(next)
            else column?.setFilterValue(next)
          }),
          mix,
        ]}
      />
    )
  }
}

export type DataTableSelectionCheckboxProps<TData extends RowData> = Omit<
  CheckboxProps,
  'checked' | 'defaultChecked' | 'indeterminate' | 'onCheckedChange'
> & {
  table: DataTableInstance<TData>
  row?: Row<DataTableFeatures, TData>
  label?: string
}

/** Header selection is page-scoped; supply a row for an individual checkbox. */
export function DataTableSelectionCheckbox<TData extends RowData>(
  handle: Handle<DataTableSelectionCheckboxProps<TData>>,
) {
  return () => {
    let { table, row, label, disabled, ...props } = handle.props
    let selected = row ? row.getIsSelected() : table.getIsAllPageRowsSelected()
    let some = row ? row.getIsSomeSelected() : table.getIsSomePageRowsSelected()
    let selectable = row
      ? row.getCanSelect()
      : table.getRowModel().rows.some((item) => item.getCanSelect())
    return (
      <Checkbox
        data-slot="data-table-selection-checkbox"
        aria-label={label ?? (row ? `Select row ${row.id}` : 'Select all rows on this page')}
        {...props}
        checked={selected}
        indeterminate={!selected && some}
        disabled={disabled || !selectable}
        onCheckedChange={(checked) =>
          row ? row.toggleSelected(checked) : table.toggleAllPageRowsSelected(checked)
        }
      />
    )
  }
}

export type DataTablePaginationProps<TData extends RowData> = Props<'div'> & {
  table: DataTableInstance<TData>
  pageSizeOptions?: number[]
  showSelectionCount?: boolean
}

export function DataTablePagination<TData extends RowData>(
  handle: Handle<DataTablePaginationProps<TData>>,
) {
  return () => {
    let {
      table,
      pageSizeOptions = [10, 20, 25, 30, 40, 50],
      showSelectionCount = true,
      class: className,
      ...props
    } = handle.props
    let { pageIndex, pageSize } = table.atoms.pagination.get()
    let pageCount = table.getPageCount()
    let known = pageCount >= 0 && Number.isFinite(pageCount)
    let sizes = [...new Set([pageSize, ...pageSizeOptions])].filter((size) => size > 0)
    let items = sizes.map((size) => ({ value: String(size), label: String(size) }))
    return (
      <div
        data-slot="data-table-pagination"
        {...props}
        class={cn('flex flex-wrap items-center justify-between gap-4 px-2', className)}
      >
        {showSelectionCount ? (
          <div
            data-slot="data-table-selection-count"
            class="flex-1 text-sm text-muted-foreground"
            aria-live="polite"
          >
            {table.getFilteredSelectedRowModel().rows.length} of{' '}
            {table.getFilteredRowModel().rows.length} loaded row(s) selected.
          </div>
        ) : null}
        <div class="ms-auto flex flex-wrap items-center gap-4 lg:gap-6">
          <div class="flex items-center gap-2">
            <span class="text-sm font-medium">Rows per page</span>
            <Select
              items={items}
              value={String(pageSize)}
              onValueChange={(value) => table.setPageSize(Number(value))}
            >
              <SelectTrigger size="sm" class="w-20" aria-label="Rows per page">
                <SelectValue />
              </SelectTrigger>
              <SelectContent side="top" alignItemWithTrigger={false}>
                {items.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div data-slot="data-table-page-count" class="text-sm font-medium" aria-live="polite">
            Page {known && pageCount === 0 ? 0 : pageIndex + 1}
            {known ? ` of ${pageCount}` : ''}
          </div>
          <div class="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Go to first page"
              disabled={!table.getCanPreviousPage()}
              mix={on('click', () => table.firstPage())}
            >
              <DataTableIcon name="first" class="rtl:rotate-180" />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Go to previous page"
              disabled={!table.getCanPreviousPage()}
              mix={on('click', () => table.previousPage())}
            >
              <DataTableIcon name="previous" class="rtl:rotate-180" />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Go to next page"
              disabled={!table.getCanNextPage()}
              mix={on('click', () => table.nextPage())}
            >
              <DataTableIcon name="next" class="rtl:rotate-180" />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Go to last page"
              disabled={!table.getCanLastPage()}
              mix={on('click', () => table.lastPage())}
            >
              <DataTableIcon name="last" class="rtl:rotate-180" />
            </Button>
          </div>
        </div>
      </div>
    )
  }
}

const iconPaths = {
  ascending: 'm5 12 7-7 7 7M12 5v14',
  descending: 'm5 12 7 7 7-7M12 5v14',
  sort: 'm8 3-4 4 4 4M4 3v18m12 0 4-4-4-4m4-10v18',
  columns: 'M4 3v4m0 4v10m8-18v10m0 4v4m8-18v4m0 4v10M1 7h6m2 10h6m2-10h6',
  hide: 'm3 3 18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.2A10.6 10.6 0 0 1 12 5c7 0 10 7 10 7a16 16 0 0 1-3 4M6.5 6.5A18 18 0 0 0 2 12s3 7 10 7a11 11 0 0 0 5.5-1.5',
  first: 'm11 17-5-5 5-5m7 10-5-5 5-5',
  previous: 'm15 18-6-6 6-6',
  next: 'm9 18 6-6-6-6',
  last: 'm6 17 5-5-5-5m7 10 5-5-5-5',
} as const

function DataTableIcon(handle: Handle<Props<'svg'> & { name: keyof typeof iconPaths }>) {
  return () => {
    let { name, class: className, ...props } = handle.props
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
        {...props}
        class={cn('size-4 shrink-0', className)}
      >
        <path d={iconPaths[name]} />
      </svg>
    )
  }
}
