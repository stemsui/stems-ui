import { on, type Handle } from 'remix/component'
import { render } from 'remix/component/test'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

// The Remix browser-test server serves JS unchanged. Match the asset server's
// compile-time NODE_ENV definition for TanStack without changing production code.
Object.assign(globalThis, { process: { env: { NODE_ENV: 'test' } } })

import {
  createDataTable,
  createDataTableColumnHelper,
  DataTable,
  DataTableColumnHeader,
  DataTableFilter,
  DataTablePagination,
  DataTableSelectionCheckbox,
  DataTableViewOptions,
  type DataTableInstance,
  type DataTableOptions,
  type SortingState,
} from './data-table.tsx'

interface Person {
  id: string
  name: string
  age: number
}
const data: Person[] = [
  { id: 'charlie', name: 'Charlie', age: 30 },
  { id: 'alice', name: 'Alice', age: 20 },
  { id: 'bob', name: 'Bob', age: 40 },
]
const column = createDataTableColumnHelper<Person>()
const columns = column.columns([
  column.display({
    id: 'select',
    enableHiding: false,
    header: ({ table }) => <DataTableSelectionCheckbox table={table} />,
    cell: ({ table, row }) => (
      <DataTableSelectionCheckbox table={table} row={row} label={`Select ${row.original.name}`} />
    ),
  }),
  column.accessor('name', {
    header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
    filterFn: 'includesString',
    footer: 'Names',
  }),
  column.accessor('age', { header: 'Age', cell: ({ getValue }) => <strong>{getValue()}</strong> }),
])

function fixture(overrides: Partial<DataTableOptions<Person>> = {}) {
  let table: DataTableInstance<Person>
  let owner: Handle
  let options: DataTableOptions<Person> = {
    data,
    columns,
    getRowId: (row) => row.id,
    initialState: { pagination: { pageIndex: 0, pageSize: 2 } },
    ...overrides,
  }
  let loading = false
  let clicked = ''
  function Example(handle: Handle) {
    owner = handle
    let getTable = createDataTable(handle, () => options)
    return () => {
      table = getTable()
      return (
        <div>
          <DataTableFilter table={table} columnId="name" aria-label="Filter names" />
          <DataTableViewOptions table={table} />
          <DataTable
            table={table}
            loading={loading}
            tableProps={{ 'aria-label': 'People' }}
            showFooter
            rowProps={(row) => ({
              'data-id': row.id,
              mix: [
                on<HTMLTableRowElement, 'click'>('click', () => {
                  clicked = row.id
                }),
              ],
            })}
          />
          <DataTablePagination table={table} pageSizeOptions={[2, 5]} />
        </div>
      )
    }
  }
  let view = render(<Example />)
  return {
    ...view,
    table: () => table,
    clicked: () => clicked,
    refresh: () => owner.update(),
    setOptions: (next: Partial<DataTableOptions<Person>>) => {
      options = { ...options, ...next }
    },
    setLoading: (next: boolean) => {
      loading = next
    },
    names: () =>
      [...view.container.querySelectorAll('tbody tr')].map((row) => row.getAttribute('data-id')),
  }
}

describe('styled data table in Remix', () => {
  it('redraws the table and pagination when TanStack state changes', async (t) => {
    let view = fixture()
    t.after(view.cleanup)
    assert.deepEqual(view.names(), ['charlie', 'alice'])
    await view.act(() => view.table().setSorting([{ id: 'age', desc: true }]))
    assert.deepEqual(view.names(), ['bob', 'charlie'])
    assert.equal(view.$('th[aria-sort="descending"]')?.textContent, 'Age')
    await view.act(() =>
      (view.$('button[aria-label="Go to next page"]') as HTMLButtonElement).click(),
    )
    assert.deepEqual(view.names(), ['alice'])
    assert.equal(view.$('[data-slot="data-table-page-count"]')!.textContent, 'Page 2 of 2')
    assert.equal(
      (view.$('button[aria-label="Go to next page"]') as HTMLButtonElement).disabled,
      true,
    )
    await view.act(() =>
      (view.$('button[aria-label="Go to first page"]') as HTMLButtonElement).click(),
    )
    assert.deepEqual(view.names(), ['bob', 'charlie'])
  })

  it('filters text, resets pagination, and renders an empty state', async (t) => {
    let view = fixture()
    t.after(view.cleanup)
    await view.act(() => view.table().nextPage())
    let input = view.$('input[aria-label="Filter names"]') as HTMLInputElement
    await view.act(() => {
      input.value = 'Alice'
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    // TanStack resets the page after the new filtered row model is read.
    await view.act(() => {})
    assert.deepEqual(view.names(), ['alice'])
    assert.equal(view.table().atoms.pagination.get().pageIndex, 0)
    await view.act(() => {
      input.value = 'No match'
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    assert.equal(view.$('tbody [role="status"]')!.textContent, 'No results.')
    assert.equal(view.$('tbody td')!.getAttribute('colspan'), '3')
  })

  it('supports page-scoped selection, mixed state, and persistence across pages', async (t) => {
    let view = fixture()
    t.after(view.cleanup)
    let header = () => view.$('thead [role="checkbox"]') as HTMLElement
    await view.act(() => (view.$('[aria-label="Select Charlie"]') as HTMLElement).click())
    assert.equal(header().getAttribute('aria-checked'), 'mixed')
    assert.equal(view.$('tr[data-id="charlie"]')!.getAttribute('data-selected'), '')
    await view.act(() => header().click())
    assert.equal(header().getAttribute('aria-checked'), 'true')
    assert.deepEqual(Object.keys(view.table().atoms.rowSelection.get()).sort(), [
      'alice',
      'charlie',
    ])
    await view.act(() => view.table().nextPage())
    assert.equal(header().getAttribute('aria-checked'), 'false')
    assert.match(view.$('[data-slot="data-table-selection-count"]')!.textContent!, /2 of 3/)
    await view.act(() => view.table().firstPage())
    assert.equal(header().getAttribute('aria-checked'), 'true')
    await view.act(() => header().click())
    assert.deepEqual(Object.keys(view.table().atoms.rowSelection.get()), [])
  })

  it('skips disabled records when selecting the page', async (t) => {
    let view = fixture({ enableRowSelection: (row) => row.id !== 'charlie' })
    t.after(view.cleanup)
    assert.equal(view.$('[aria-label="Select Charlie"]')!.getAttribute('aria-disabled'), 'true')
    await view.act(() => (view.$('thead [role="checkbox"]') as HTMLElement).click())
    assert.deepEqual(Object.keys(view.table().atoms.rowSelection.get()), ['alice'])
    assert.equal(view.$('thead [role="checkbox"]')!.getAttribute('aria-checked'), 'true')
  })

  it('keeps rows, footers, and empty colspans aligned with visible columns', async (t) => {
    let view = fixture()
    t.after(view.cleanup)
    await view.act(() => view.table().getColumn('age')!.toggleVisibility(false))
    assert.equal(view.container.querySelectorAll('tbody tr:first-child td').length, 2)
    assert.equal(view.container.querySelectorAll('tfoot td').length, 2)
    await view.act(() => view.table().setGlobalFilter('not found'))
    assert.equal(view.$('tbody td')!.getAttribute('colspan'), '2')
  })

  it('updates controlled sorting and new records through the owner render', async (t) => {
    let sorting: SortingState = []
    let view = fixture({
      state: { sorting },
      onSortingChange: (updater) => {
        sorting = typeof updater === 'function' ? updater(sorting) : updater
        view.setOptions({ state: { sorting } })
        void view.refresh()
      },
    })
    t.after(view.cleanup)
    let instance = view.table()
    await view.act(() => view.table().getColumn('name')!.toggleSorting(false))
    assert.deepEqual(view.names(), ['alice', 'bob'])
    await view.act(() => {
      view.setOptions({ data: [{ id: 'new', name: 'New person', age: 50 }] })
      void view.refresh()
    })
    assert.equal(view.table(), instance)
    assert.deepEqual(view.names(), ['new'])
  })

  it('forwards row mixins and switches to a loading state', async (t) => {
    let view = fixture()
    t.after(view.cleanup)
    await view.act(() => (view.$('tr[data-id="charlie"]') as HTMLElement).click())
    assert.equal(view.clicked(), 'charlie')
    await view.act(() => {
      view.setLoading(true)
      void view.refresh()
    })
    assert.equal(view.$('table')!.getAttribute('aria-busy'), 'true')
    assert.equal(view.$('tbody [role="status"]')!.textContent, 'Loading…')
  })
})
