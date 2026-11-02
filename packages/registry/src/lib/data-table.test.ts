import * as fs from 'node:fs'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import {
  createDataTable,
  createDataTableColumnHelper,
  renderDataTableTemplate,
  type DataTableOptions,
  type SortingState,
} from './data-table.ts'

interface Person {
  id: string
  name: string
  age: number
}

const data: Person[] = [
  { id: 'a', name: 'Charlie', age: 30 },
  { id: 'b', name: 'Alice', age: 20 },
  { id: 'c', name: 'Bob', age: 40 },
]
const column = createDataTableColumnHelper<Person>()
const columns = column.columns([
  column.accessor('name', { filterFn: 'includesString' }),
  column.accessor('age', {}),
])

function setup(overrides: Partial<DataTableOptions<Person>> = {}) {
  let controller = new AbortController()
  let updates = 0
  let options: DataTableOptions<Person> = {
    data,
    columns,
    getRowId: (row) => row.id,
    ...overrides,
  }
  let getTable = createDataTable(
    {
      signal: controller.signal,
      update: async () => {
        updates++
        return controller.signal
      },
      queueTask: (task) => task(controller.signal),
    },
    () => options,
  )
  let table = getTable()
  return {
    table,
    getTable,
    controller,
    updates: () => updates,
    setOptions: (next: DataTableOptions<Person>) => {
      options = next
      getTable()
    },
  }
}

describe('TanStack v9 Remix adapter', () => {
  it('keeps one instance and updates the owner for internal state changes', () => {
    let fixture = setup()
    assert.equal(fixture.getTable(), fixture.table)
    assert.equal(fixture.updates(), 0)
    fixture.table.setSorting([{ id: 'age', desc: true }])
    assert.equal(fixture.updates(), 1)
    assert.deepEqual(
      fixture.table.getRowModel().rows.map((row) => row.id),
      ['c', 'a', 'b'],
    )
    fixture.controller.abort()
  })

  it('sorts, filters, paginates, hides columns, and selects stable row ids', () => {
    let { table, controller } = setup({
      initialState: { pagination: { pageIndex: 0, pageSize: 2 } },
    })
    table.setSorting([{ id: 'name', desc: false }])
    assert.deepEqual(
      table.getRowModel().rows.map((row) => row.id),
      ['b', 'c'],
    )
    table.nextPage()
    assert.deepEqual(
      table.getRowModel().rows.map((row) => row.id),
      ['a'],
    )
    table.firstPage()
    table.getColumn('name')!.setFilterValue('li')
    assert.deepEqual(
      table.getRowModel().rows.map((row) => row.id),
      ['b', 'a'],
    )
    table.toggleAllPageRowsSelected(true)
    assert.deepEqual({ ...table.atoms.rowSelection.get() }, { a: true, b: true })
    table.getColumn('age')!.toggleVisibility(false)
    assert.deepEqual(
      table.getVisibleLeafColumns().map((col) => col.id),
      ['name'],
    )
    table.setColumnFilters([])
    table.setGlobalFilter('Bob')
    assert.deepEqual(
      table.getRowModel().rows.map((row) => row.id),
      ['c'],
    )
    controller.abort()
  })

  it('supports controlled state and returns to internal state when control is removed', () => {
    let sorting: SortingState = []
    let fixture = setup({
      state: { sorting },
      onSortingChange: (updater) => {
        sorting = typeof updater === 'function' ? updater(sorting) : updater
      },
    })
    fixture.table.setSorting([{ id: 'age', desc: true }])
    assert.deepEqual(sorting, [{ id: 'age', desc: true }])
    assert.deepEqual(fixture.table.atoms.sorting.get(), [])
    fixture.setOptions({ data, columns, state: { sorting } })
    assert.deepEqual(fixture.table.atoms.sorting.get(), sorting)
    assert.equal(fixture.updates(), 0, 'syncing render options does not schedule another render')
    fixture.setOptions({ data, columns })
    fixture.table.setSorting([{ id: 'name', desc: false }])
    assert.deepEqual(fixture.table.atoms.sorting.get(), [{ id: 'name', desc: false }])
    fixture.controller.abort()
  })

  it('updates data and columns without resetting selection', () => {
    let fixture = setup()
    fixture.table.getRow('b')!.toggleSelected(true)
    fixture.setOptions({
      data: [data[1]!],
      columns: column.columns([columns[0]!]),
      getRowId: (row) => row.id,
    })
    assert.deepEqual(
      fixture.table.getRowModel().rows.map((row) => row.id),
      ['b'],
    )
    assert.equal(fixture.table.getRow('b')!.getIsSelected(), true)
    assert.equal(fixture.table.getVisibleLeafColumns().length, 1)
    fixture.controller.abort()
  })

  it('does not process server-paginated, filtered, or sorted records again', () => {
    let { table, controller } = setup({
      manualPagination: true,
      manualSorting: true,
      manualFiltering: true,
      rowCount: 100,
      initialState: {
        pagination: { pageIndex: 2, pageSize: 2 },
        sorting: [{ id: 'age', desc: true }],
        columnFilters: [{ id: 'name', value: 'not found' }],
      },
    })
    assert.deepEqual(
      table.getRowModel().rows.map((row) => row.id),
      ['a', 'b', 'c'],
    )
    assert.equal(table.getPageCount(), 50)
    assert.equal(table.getCanLastPage(), true)
    controller.abort()
  })

  it('unsubscribes when the Remix owner is disposed', () => {
    let fixture = setup()
    fixture.table.setGlobalFilter('a')
    let before = fixture.updates()
    fixture.controller.abort()
    fixture.table.setGlobalFilter('b')
    assert.equal(fixture.updates(), before)
  })

  it('renders strings and Remix render callbacks without treating callbacks as components', () => {
    assert.equal(renderDataTableTemplate('Name', {}), 'Name')
    assert.equal(
      renderDataTableTemplate(({ value }: { value: number }) => `Age ${value}`, { value: 20 }),
      'Age 20',
    )
    assert.equal(renderDataTableTemplate(undefined, {}), undefined)
  })

  it('ships the adapter and declares all registry dependencies without adding React', () => {
    let registry = JSON.parse(
      fs.readFileSync(new URL('../../registry.json', import.meta.url), 'utf8'),
    )
    let item = registry.items.find((item: { name: string }) => item.name === 'data-table')
    assert.deepEqual(item.dependencies, ['@tanstack/table-core@^9.3.1'])
    assert.ok(item.files.some((file: { path: string }) => file.path === 'src/lib/data-table.ts'))
    for (let name of ['table', 'button', 'checkbox', 'dropdown-menu', 'input', 'select', 'utils']) {
      assert.ok(item.registryDependencies.includes(`@stemsui/${name}`), name)
    }
    let headless = JSON.parse(
      fs.readFileSync(new URL('../../../stems-ui/package.json', import.meta.url), 'utf8'),
    )
    assert.equal(headless.dependencies?.['@tanstack/table-core'], undefined)
  })
})
