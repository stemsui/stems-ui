# Data Table

A styled table that uses TanStack Table v9 for data and state.
It does not depend on React or Remix's database package, `remix/data-table`.
The adapter and components are copied into your application through the registry.

## Usage

Install the component with `npx shadcn add @stemsui/data-table`.
This also installs `@tanstack/table-core@^9.3.1`, Table, Button, Checkbox, Dropdown Menu, Input, Select, and their dependencies.
The `stems-ui` headless package does not depend on TanStack.

In the application's `createAssetServer` configuration, allow TanStack and define its build-time environment value:

```ts
allowPackages: ['remix', 'stems-ui', 'cn', '@tanstack/table-core'],
scripts: {
  define: { 'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'development') },
},
```

Merge these entries with your existing configuration.
The asset server also allows TanStack's declared dependencies.
The definition replaces TanStack's development guards without adding a browser `process` global.

Call `createDataTable` once during component setup.
Call its returned getter during every render.
The getter updates the table's data, columns, and controlled state without replacing the instance.

```tsx
import { clientEntry, type Handle } from 'remix/component'
import {
  createDataTable,
  createDataTableColumnHelper,
  DataTable,
  DataTableColumnHeader,
  DataTableFilter,
  DataTablePagination,
  DataTableSelectionCheckbox,
  DataTableViewOptions,
} from '#app/ui/data-table.tsx'

type Payment = { id: string; email: string; amount: number }

const column = createDataTableColumnHelper<Payment>()
const columns = column.columns([
  column.display({
    id: 'select',
    header: ({ table }) => <DataTableSelectionCheckbox table={table} />,
    cell: ({ table, row }) => <DataTableSelectionCheckbox table={table} row={row} />,
    enableSorting: false,
    enableHiding: false,
  }),
  column.accessor('email', {
    header: ({ column }) => <DataTableColumnHeader column={column} title="Email" />,
    filterFn: 'includesString',
    meta: { label: 'Email' },
  }),
  column.accessor('amount', {
    header: 'Amount',
    cell: ({ getValue }) => `$${getValue().toFixed(2)}`,
    meta: { label: 'Amount', cellClass: 'text-end' },
  }),
])

export const Payments = clientEntry(
  import.meta.url,
  function Payments(handle: Handle<{ data: Payment[] }>) {
    let getTable = createDataTable(handle, () => ({
      data: handle.props.data,
      columns,
      getRowId: (row) => row.id,
    }))

    return () => {
      let table = getTable()
      return (
        <div class="flex flex-col gap-4">
          <div class="flex items-center gap-2">
            <DataTableFilter table={table} columnId="email" aria-label="Filter emails" />
            <DataTableViewOptions table={table} />
          </div>
          <DataTable table={table} caption="Recent payments" />
          <DataTablePagination table={table} />
        </div>
      )
    }
  },
)
```

Keep columns outside the component when they do not depend on props.
Keep the data array reference stable until the records change.
Define column callbacks inside the client entry module, not in serialized server props.
Callbacks return Remix nodes directly. They are not Remix component setup functions.

## Features and composition

The default feature set covers the surface of [shadcn Data Table](https://ui.shadcn.com/docs/components/base/data-table).
It includes basic rendering, custom cells, row actions, pagination, sorting, column filtering, column visibility, and row selection.
It also includes global search, grouped headers, optional footers, loading states, and empty states.

`DataTable` renders the table only.
Place filters, view controls, pagination, and application-specific actions beside it.
This lets an application choose its layout without adding flags for every possible toolbar.

| Export                                       | Purpose                                                                                                                              |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `createDataTable(handle, getOptions)`        | Returns a getter for one table instance. Connects state changes to the Remix owner and removes subscriptions on disposal.            |
| `createDataTableColumnHelper<TData>()`       | Creates typed accessor, display, and group columns. Use `.columns([...])` to combine different value types.                          |
| `DataTable`                                  | Renders header groups and visible cells from a `table` instance.                                                                     |
| `DataTableColumnHeader`                      | Accepts `column` and `title`. Provides ascending, descending, clear-sort, and hide actions.                                          |
| `DataTableFilter`                            | Accepts `table` and optional `columnId`. Filters a string column, or searches globally when `columnId` is absent.                    |
| `DataTableViewOptions`                       | Accepts `table` and optional `labels`. Toggles hideable accessor columns, including grouped leaf columns.                            |
| `DataTableSelectionCheckbox`                 | Accepts `table`, optional `row`, optional `label`, and `class`. Selects a row or the current page.                                   |
| `DataTablePagination`                        | Accepts `table`, `pageSizeOptions`, and `showSelectionCount`. Provides page size, page count, and first/previous/next/last controls. |
| `renderDataTableTemplate(template, context)` | Renders a string or a callback when you build custom table markup.                                                                   |
| `dataTableFeatures`                          | The registered v9 feature set, including built-in sorting and filtering functions.                                                   |

`DataTableFeatures`, `DataTableInstance<TData>`, `DataTableColumnDef<TData, TValue>`, `DataTableColumnMeta`, and `DataTableOptions<TData>` are exported types.
The adapter file also exports the sorting, filtering, pagination, visibility, selection, and updater state types.

## Table props and styling

`DataTable` accepts native `<div>` props for its bordered container.
Use `tableProps` for native `<table>` props, such as an accessible name or a custom mixin.
Use `rowProps(row)` for row attributes and mixins.

| Prop             | Default       | Purpose                                                              |
| ---------------- | ------------- | -------------------------------------------------------------------- |
| `table`          | Required      | The instance returned by the getter.                                 |
| `caption`        | None          | A native table caption.                                              |
| `empty`          | `No results.` | Content when the row model is empty.                                 |
| `loading`        | `false`       | Replaces body rows with loading content and sets `aria-busy="true"`. |
| `loadingContent` | `Loading…`    | Content while loading.                                               |
| `showFooter`     | `false`       | Renders column footer callbacks.                                     |
| `tableProps`     | None          | Native table attributes, classes, and mixins.                        |
| `rowProps`       | None          | A callback that returns native row props.                            |

Use column metadata to set `label`, `headerClass`, `cellClass`, and `footerClass`.
View labels resolve from `labels[column.id]`, then `meta.label`, a string header, and finally the column ID.
The empty and loading rows span the visible leaf columns, not the original column count.

All controls expose `data-slot="data-table-…"` attributes.
Table parts use the slots documented on [Table](/components/table).
Selected rows expose `data-selected=""` in both server and client output.
Styles use shadcn theme variables and logical text alignment for RTL.

## Row actions

Add a display column with `column.display({ id: 'actions', cell: ... })`.
The cell callback receives `row.original`, which contains the source record.
Render a Dropdown Menu, links, buttons, or another Remix component from that callback.
The live demo above includes copy-ID and view-details actions.

Set `enableHiding: false` on action and selection columns that must remain visible.
Use a stable database ID through `getRowId` so selection survives sorting and data updates.
Without it, TanStack uses row indexes as IDs.

## Sorting, filtering, and pagination

Use `DataTableColumnHeader` for a ready-made sort menu.
For a different interaction, call `column.toggleSorting()` or `table.setSorting()` from your own control.
TanStack also supports multiple sort columns through `table.setSorting([...])`.
The renderer sets `aria-sort` on sortable leaf headers.

`DataTableFilter` is a text filter.
For number ranges, status choices, or custom filters, build a control with `column.setFilterValue(value)` and a suitable `filterFn`.
Use `table.setColumnFilters([])` to clear column filters and `table.setGlobalFilter('')` to clear global search.
Client-side sorting and filtering run before pagination.

The initial page size is 10.
Set `initialState.pagination` to change it.
`DataTablePagination.pageSizeOptions` defaults to `[10, 20, 25, 30, 40, 50]` and also includes the current size.
It shows page 0 of 0 for empty results and disables the last-page control when the server reports an unknown page count.

## Selection

Without a `row` prop, `DataTableSelectionCheckbox` selects the current page, not every page.
The checkbox shows a mixed state when only some selectable rows are selected.
Use `enableRowSelection: (row) => ...` to prevent selection of specific records.
The header control skips those records and disables itself when no visible row is selectable.

Selection persists by row ID across pages.
Use `table.getFilteredSelectedRowModel()` to access selected loaded records after filtering.
For an application-wide bulk action, use `table.atoms.rowSelection.get()` to read all selected IDs.
With server pagination, selected IDs can include records that are not loaded.
The default counter explicitly counts loaded rows so it does not claim to represent all server records.
Pass `showSelectionCount={false}` and render your own counter when you have global totals.

## Controlled state and server data

TanStack manages state internally unless the application supplies it.
Use `initialState` for starting values only.
For controlled state, pair each `state` value with its `on…Change` callback.
Callbacks receive either the next value or an updater function.

```tsx
import type { PaginationState, SortingState } from '#app/lib/data-table.ts'

// Inside component setup:
let sorting: SortingState = []
let pagination: PaginationState = { pageIndex: 0, pageSize: 25 }
let getTable = createDataTable(handle, () => ({
  columns,
  data: handle.props.rows,
  rowCount: handle.props.total,
  getRowId: (row) => row.id,
  manualSorting: true,
  manualFiltering: true,
  manualPagination: true,
  state: { sorting, pagination },
  onSortingChange: (updater) => {
    sorting = typeof updater === 'function' ? updater(sorting) : updater
    pagination = { ...pagination, pageIndex: 0 }
    // Request the new records through the application's data layer.
    void handle.update()
  },
  onPaginationChange: (updater) => {
    pagination = typeof updater === 'function' ? updater(pagination) : updater
    // Request the new records through the application's data layer.
    void handle.update()
  },
}))
```

Manual modes tell TanStack not to process server results again.
Pass `rowCount` or `pageCount` when the total is known. Pass `pageCount: -1` when it is unknown.
Use the same controlled pattern for `columnFilters`, `globalFilter`, `columnVisibility`, and `rowSelection`.
The application owns requests, URL parameters, cancellation, errors, and loading state.
Do not combine client sorting or filtering with server pagination unless processing only the loaded page is intentional.

TanStack v9 also accepts external atoms through `atoms`.
An external atom owns one state value and overrides the matching `state` value.
Keep `atoms`, `initialState`, and the feature set fixed for the lifetime of an instance, as TanStack requires.

## Accessibility and limits

Give each table a caption or an accessible name.
Selection checkboxes, filter inputs, menus, and pagination controls have default accessible names that applications can customize where exposed.
Use `label` on row checkboxes when a record name is clearer than its ID.
Menus support keyboard navigation through the existing Stems menu and select primitives.
Table rows remain native table rows, not an ARIA grid with spreadsheet keyboard behavior.

The default wrapper does not implement virtualization, column resizing, drag reordering, grouping rows, or cell editing.
These features are outside the shadcn Data Table guide's default surface.
Use TanStack Core directly for a different feature set, or extend the copied adapter and renderer.
The v8 `useReactTable`, `getCoreRowModel`, and `onStateChange` examples do not apply to this v9 adapter.
