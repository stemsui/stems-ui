import * as fs from 'node:fs'

import { cn as packageCn } from 'cn'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { buttonVariants } from '../ui/button.tsx'
import { cn } from './utils.ts'

describe('registry class merging', () => {
  it('re-exports cn without changing the helper import path', () => {
    assert.equal(cn, packageCn)
  })

  it('accepts conditional classes, objects, and nested arrays', () => {
    assert.equal(
      cn('px-2 py-1', false, null, undefined, 0, { 'text-white': true, hidden: false }, [
        'px-4',
        ['hover:bg-red-500'],
      ]),
      'py-1 text-white px-4 hover:bg-red-500',
    )
  })

  it('keeps directional padding and replaces conflicting classes', () => {
    assert.equal(cn('p-4', 'px-6'), 'p-4 px-6')
    assert.equal(cn('px-6', 'p-4'), 'p-4')
    assert.equal(cn('size-8', 'w-10'), 'size-8 w-10')
    assert.equal(cn('w-10', 'size-8'), 'size-8')
  })

  it('merges state variants and arbitrary values separately from base classes', () => {
    assert.equal(
      cn(
        'bg-background data-open:bg-red-500 focus-visible:ring-[3px] w-(--anchor-width)',
        'data-open:bg-blue-500 focus-visible:ring-2 w-64',
      ),
      'bg-background data-open:bg-blue-500 focus-visible:ring-2 w-64',
    )
  })

  it('lets caller classes override styled button defaults', () => {
    let classes = buttonVariants({ class: 'rounded-full px-6 h-12' }).split(' ')
    for (let value of ['rounded-full', 'px-6', 'h-12', 'bg-primary', 'text-primary-foreground']) {
      assert.ok(classes.includes(value), value)
    }
    for (let value of ['rounded-md', 'px-2.5', 'h-9']) {
      assert.ok(!classes.includes(value), value)
    }
  })

  it('installs cn through the shared utils registry item', () => {
    let registry = JSON.parse(
      fs.readFileSync(new URL('../../registry.json', import.meta.url), 'utf8'),
    )
    let utils = registry.items.find((item: { name: string }) => item.name === 'utils')
    assert.deepEqual(utils.dependencies, ['cn'])
  })
})
