import type { Handle, RemixNode } from 'remix/component'
import {
  columnFilteringFeature,
  columnVisibilityFeature,
  constructTable,
  createColumnHelper,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  filterFns,
  globalFilteringFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  sortFns,
  tableFeatures,
  type ColumnDef,
  type RowData,
  type Table,
  type TableOptions,
} from '@tanstack/table-core'
import { storeReactivityBindings } from '@tanstack/table-core/store-reactivity-bindings'

export type {
  ColumnFiltersState,
  ColumnVisibilityState,
  PaginationState,
  RowSelectionState,
  SortingState,
  Updater,
} from '@tanstack/table-core'

export interface DataTableColumnMeta {
  /** Human-readable label for the column visibility menu. */
  label?: string
  headerClass?: string
  cellClass?: string
  footerClass?: string
}

/** The shadcn Data Table feature set, plus global search. No React dependency. */
export const dataTableFeatures = tableFeatures({
  coreReactivityFeature: storeReactivityBindings(),
  columnFilteringFeature,
  columnVisibilityFeature,
  globalFilteringFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  filteredRowModel: createFilteredRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  sortedRowModel: createSortedRowModel(),
  filterFns,
  sortFns,
  columnMeta: {} as DataTableColumnMeta,
})

export type DataTableFeatures = typeof dataTableFeatures
export type DataTableInstance<TData extends RowData> = Table<DataTableFeatures, TData>
export type DataTableColumnDef<TData extends RowData, TValue = unknown> = ColumnDef<
  DataTableFeatures,
  TData,
  TValue
>
export type DataTableOptions<TData extends RowData> = Omit<
  TableOptions<DataTableFeatures, TData>,
  'features'
>

/** Preserves accessor value types. Use helper.columns([...]) for mixed value types. */
export function createDataTableColumnHelper<TData extends RowData>() {
  return createColumnHelper<DataTableFeatures, TData>()
}

/**
 * Call once in component setup, then call the returned getter in every render.
 * Options are read during render, so props, data, and controlled state stay current.
 * State changes redraw the owner and its composed controls. Disposal unsubscribes.
 */
export function createDataTable<TData extends RowData>(
  handle: Pick<Handle, 'signal' | 'update' | 'queueTask'>,
  getOptions: () => DataTableOptions<TData>,
): () => DataTableInstance<TData> {
  let signal = handle.signal
  let table: DataTableInstance<TData> | undefined
  let defaults: TableOptions<DataTableFeatures, TData>
  let syncing = false
  let previousOptions: DataTableOptions<TData> | undefined

  return () => {
    let options = getOptions()
    syncing = true
    try {
      if (!table) {
        table = constructTable({
          features: dataTableFeatures,
          data: options.data,
          columns: options.columns,
          initialState: options.initialState,
          atoms: options.atoms,
        })
        // Keep TanStack's default callbacks when a controlled option is later removed.
        defaults = table.options
        // Tasks do not run on the server. Do not retain subscriptions during SSR.
        let current = table
        handle.queueTask(() => {
          if (signal.aborted) return
          let subscription = current.store.subscribe(() => {
            if (!syncing && !signal.aborted) void handle.update()
          })
          signal.addEventListener('abort', () => subscription.unsubscribe(), { once: true })
        })
      }
      // setOptions merges rather than replaces. Explicitly clear removed user options.
      let cleared = Object.fromEntries(
        Object.keys(previousOptions ?? {}).map((key) => [key, undefined]),
      )
      table.setOptions({ ...cleared, ...defaults, ...options, features: dataTableFeatures })
      previousOptions = options
      return table
    } finally {
      syncing = false
    }
  }
}

/** Column templates are render callbacks, not Remix component setup functions. */
export function renderDataTableTemplate<TProps>(
  template: string | ((props: TProps) => RemixNode) | undefined,
  props: TProps,
): RemixNode {
  return typeof template === 'function' ? template(props) : template
}
