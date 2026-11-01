import { expect } from 'remix/assert'
import { describe, it } from 'remix/test'
import { renderToString } from 'remix/component/server'

import * as checkbox from './checkbox.ts'
import * as checkboxGroup from './checkbox-group.ts'

function getTag(html: string, pattern: RegExp) {
  let match = html.match(pattern)
  expect(match).not.toBe(null)
  return match![0]
}

function getTags(html: string, pattern: RegExp) {
  return [...html.matchAll(new RegExp(pattern, 'g'))].map((match) => match[0])
}

describe('checkbox-group (server render)', () => {
  it('renders member and parent state from the group value', async () => {
    let html = await renderToString(
      <checkboxGroup.Context defaultValue={['b']} allValues={['a', 'b']} disabled>
        <div aria-label="Letters" mix={checkboxGroup.root()}>
          <checkbox.Context parent>
            <span data-name="parent" aria-label="All" mix={checkbox.root()} />
          </checkbox.Context>
          <checkbox.Context name="letter" value="a">
            <span data-name="a" aria-label="A" mix={checkbox.root()} />
          </checkbox.Context>
          <checkbox.Context name="letter" value="b">
            <span data-name="b" aria-label="B" mix={checkbox.root()} />
          </checkbox.Context>
        </div>
      </checkboxGroup.Context>,
    )

    let group = getTag(html, /<div[^>]*role="group"[^>]*>/)
    expect(group).toContain('data-disabled=""')

    let a = getTag(html, /<span[^>]*data-name="a"[^>]*>/)
    let b = getTag(html, /<span[^>]*data-name="b"[^>]*>/)
    expect(a).toContain('aria-checked="false"')
    expect(a).toContain('data-disabled=""')
    expect(b).toContain('aria-checked="true"')

    let aId = a.match(/\sid="([^"]+)"/)?.[1]
    let bId = b.match(/\sid="([^"]+)"/)?.[1]
    expect(aId).not.toBe(undefined)
    expect(bId).not.toBe(undefined)

    let parent = getTag(html, /<span[^>]*data-name="parent"[^>]*>/)
    expect(parent).toContain('aria-checked="mixed"')
    expect(parent).toContain('data-indeterminate=""')
    expect(parent).toContain(`aria-controls="${aId} ${bId}"`)

    let inputs = getTags(html, /<input[^>]*type="checkbox"[^>]*>/)
    expect(inputs[1]).not.toMatch(/\schecked/)
    expect(inputs[2]).toMatch(/\schecked/)
  })
})
