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
} from '@stemsui/registry/ui/data-table.tsx'
import { buttonVariants } from '@stemsui/registry/ui/button.tsx'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  onMenuSelect,
} from '@stemsui/registry/ui/dropdown-menu.tsx'

interface Payment {
  id: string
  amount: number
  status: 'pending' | 'processing' | 'success' | 'failed'
  email: string
}

const payments: Payment[] = [
  { id: 'pay_01', amount: 316, status: 'success', email: 'ken99@example.com' },
  { id: 'pay_02', amount: 242, status: 'success', email: 'abe45@example.com' },
  { id: 'pay_03', amount: 837, status: 'processing', email: 'monserrat44@example.com' },
  { id: 'pay_04', amount: 874, status: 'success', email: 'silas22@example.com' },
  { id: 'pay_05', amount: 721, status: 'failed', email: 'carmella@example.com' },
  { id: 'pay_06', amount: 125, status: 'pending', email: 'alex@example.com' },
  { id: 'pay_07', amount: 430, status: 'success', email: 'jules@example.com' },
  { id: 'pay_08', amount: 98, status: 'processing', email: 'riley@example.com' },
  { id: 'pay_09', amount: 560, status: 'success', email: 'sam@example.com' },
  { id: 'pay_10', amount: 275, status: 'pending', email: 'taylor@example.com' },
  { id: 'pay_11', amount: 640, status: 'failed', email: 'morgan@example.com' },
  { id: 'pay_12', amount: 180, status: 'success', email: 'devon@example.com' },
]

const column = createDataTableColumnHelper<Payment>()
const columns = column.columns([
  column.display({
    id: 'select',
    header: ({ table }) => <DataTableSelectionCheckbox table={table} />,
    cell: ({ table, row }) => (
      <DataTableSelectionCheckbox table={table} row={row} label={`Select ${row.original.email}`} />
    ),
    enableSorting: false,
    enableHiding: false,
  }),
  column.accessor('status', {
    header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
    meta: { label: 'Status', cellClass: 'capitalize' },
  }),
  column.accessor('email', {
    header: ({ column }) => <DataTableColumnHeader column={column} title="Email" />,
    filterFn: 'includesString',
    meta: { label: 'Email' },
  }),
  column.accessor('amount', {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Amount" class="justify-end" />
    ),
    cell: ({ getValue }) =>
      new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(getValue()),
    meta: { label: 'Amount', cellClass: 'text-end font-medium' },
  }),
  column.display({
    id: 'actions',
    enableHiding: false,
    cell: ({ row }) => (
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`Actions for ${row.original.email}`}
          class={buttonVariants({ variant: 'ghost', size: 'icon-sm' })}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <circle cx="5" cy="12" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="19" cy="12" r="2" />
          </svg>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" class="w-44">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuItem value={`copy:${row.original.id}`}>Copy payment ID</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem value={`view:${row.original.id}`}>
            View payment details
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  }),
])

export const DataTableDemo = clientEntry(import.meta.url, function DataTableDemo(handle: Handle) {
  let result = ''
  let getTable = createDataTable(handle, () => ({
    data: payments,
    columns,
    getRowId: (row) => row.id,
    initialState: { pagination: { pageIndex: 0, pageSize: 5 } },
  }))

  return () => {
    let table = getTable()
    return (
      <div
        class="flex w-full min-w-0 flex-col gap-4"
        mix={onMenuSelect(async (event) => {
          if (event.kind !== 'item' || typeof event.value !== 'string') return
          let [action, id] = event.value.split(':')
          if (action !== 'copy' && action !== 'view') return
          if (action === 'copy') {
            try {
              await navigator.clipboard.writeText(id!)
              result = `Copied ${id}`
            } catch {
              result = `Payment ID: ${id}`
            }
          } else result = `Viewing ${id}`
          void handle.update()
        })}
      >
        <div class="flex flex-wrap items-center gap-2">
          <DataTableFilter
            table={table}
            columnId="email"
            aria-label="Filter emails"
            placeholder="Filter emails…"
          />
          <DataTableViewOptions table={table} />
        </div>
        <DataTable table={table} tableProps={{ 'aria-label': 'Payments' }} />
        <DataTablePagination table={table} pageSizeOptions={[5, 10, 20, 50]} />
        <p role="status" data-testid="payment-action" class="min-h-5 text-sm text-muted-foreground">
          {result}
        </p>
      </div>
    )
  }
})
