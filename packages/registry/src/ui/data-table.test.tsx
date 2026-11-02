import { type Handle } from 'remix/component'
import { renderToString } from 'remix/component/server'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import {
  createDataTable,
  createDataTableColumnHelper,
  DataTable,
  DataTableColumnHeader,
  DataTablePagination,
  DataTableSelectionCheckbox,
} from './data-table.tsx'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from './table.tsx'

const data = [
  { id: 'a', name: 'Alice', amount: 12 },
  { id: 'b', name: 'Bob', amount: 34 },
]
const column = createDataTableColumnHelper<(typeof data)[number]>()
const columns = column.columns([
  column.display({
    id: 'select',
    header: ({ table }) => <DataTableSelectionCheckbox table={table} />,
    cell: ({ table, row }) => <DataTableSelectionCheckbox table={table} row={row} />,
    enableHiding: false,
  }),
  column.group({
    id: 'payment',
    header: 'Payment',
    columns: column.columns([
      column.accessor('name', {
        header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
        footer: 'Total',
      }),
      column.accessor('amount', {
        header: 'Amount',
        cell: ({ getValue }) => `$${getValue()}`,
        footer: '$46',
        meta: { cellClass: 'text-end' },
      }),
    ]),
  }),
])

describe('data table server rendering', () => {
  it('renders grouped headers, custom cells, footers, sort and selection state before hydration', async () => {
    function Example(handle: Handle) {
      let getTable = createDataTable(handle, () => ({
        data,
        columns,
        getRowId: (row) => row.id,
        initialState: { sorting: [{ id: 'name', desc: true }], rowSelection: { b: true } },
      }))
      return () => {
        let table = getTable()
        return (
          <>
            <DataTable
              table={table}
              caption="Payments"
              showFooter
              tableProps={{ 'aria-label': 'Payments' }}
            />
            <DataTablePagination table={table} />
          </>
        )
      }
    }
    let html = await renderToString(<Example />)
    assert.match(html, /<caption[^>]*>Payments<\/caption>/)
    assert.match(html, /scope="colgroup"/)
    assert.match(html, /colspan="2"/)
    assert.match(html, /aria-sort="descending"/)
    assert.match(html, /data-selected=""/)
    assert.match(html, /aria-checked="mixed"/)
    assert.match(html, /\$34/)
    assert.match(html, /<tfoot/)
    assert.match(html, /\$46/)
    assert.match(html, /aria-busy="false"/)
    assert.ok(html.indexOf('$34') < html.indexOf('$12'))
    assert.match(html, /1 of 2 loaded row\(s\) selected/)
  })

  for (let loading of [false, true]) {
    it(`renders the ${loading ? 'loading' : 'empty'} state with the visible column count`, async () => {
      function Example(handle: Handle) {
        let getTable = createDataTable(handle, () => ({
          data: [],
          columns,
          initialState: { columnVisibility: { amount: false } },
        }))
        return () => (
          <DataTable
            table={getTable()}
            loading={loading}
            empty="Nothing found"
            loadingContent="Fetching payments"
          />
        )
      }
      let html = await renderToString(<Example />)
      assert.match(html, /colspan="2"/)
      assert.ok(html.includes(loading ? 'Fetching payments' : 'Nothing found'))
      assert.ok(html.includes(`aria-busy="${loading}"`))
      assert.match(html, /role="status"/)
    })
  }

  it('handles zero pages and an unknown server-side page count', async () => {
    function Example(handle: Handle) {
      let empty = createDataTable(handle, () => ({ data: [], columns }))
      let unknown = createDataTable(handle, () => ({
        data,
        columns,
        manualPagination: true,
        pageCount: -1,
      }))
      return () => (
        <>
          <DataTablePagination table={empty()} />
          <DataTablePagination table={unknown()} />
        </>
      )
    }
    let html = await renderToString(<Example />)
    assert.match(html, /Page 0 of 0/)
    assert.ok(!html.includes('of -1'))
    let lastButtons = [...html.matchAll(/<button[^>]*aria-label="Go to last page"[^>]*>/g)]
    assert.equal(lastButtons.length, 2)
    assert.ok(lastButtons.every(([tag]) => /\sdisabled(?:\s|=|>)/.test(tag)))
  })

  it('preserves native table parts, host attributes, mixins, and caller classes', async () => {
    let html = await renderToString(
      <Table id="invoices" class="text-base">
        <TableCaption>Invoices</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead scope="row" class="h-12">
              Invoice
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow data-selected="">
            <TableCell class="p-4">INV001</TableCell>
          </TableRow>
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell>Total</TableCell>
          </TableRow>
        </TableFooter>
      </Table>,
    )
    assert.match(html, /id="invoices"/)
    assert.match(html, /scope="row"/)
    assert.match(html, /class="[^"]*h-12/)
    assert.match(html, /class="[^"]*p-4/)
    assert.ok(!html.includes('p-2 p-4'))
    for (let tag of ['table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption'])
      assert.ok(html.includes(`<${tag}`))
  })
})
