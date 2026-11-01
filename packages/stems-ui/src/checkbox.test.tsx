import { expect } from 'remix/assert'
import { describe, it } from 'remix/test'
import { renderToString } from 'remix/component/server'

import * as checkbox from './checkbox.ts'

function getTag(html: string, pattern: RegExp) {
  let match = html.match(pattern)
  expect(match).not.toBe(null)
  return match![0]
}

function getTags(html: string, pattern: RegExp) {
  return [...html.matchAll(new RegExp(pattern, 'g'))].map((match) => match[0])
}

describe('checkbox (server render)', () => {
  it('renders checked state on root, indicator, and hidden input', async () => {
    let html = await renderToString(
      <checkbox.Context defaultChecked name="terms" value="yes">
        <span aria-label="Accept" mix={checkbox.root()}>
          <span data-part="indicator" mix={checkbox.indicator()} />
        </span>
      </checkbox.Context>,
    )

    let root = getTag(html, /<span[^>]*role="checkbox"[^>]*>/)
    expect(root).toContain('aria-checked="true"')
    expect(root).toContain('data-checked=""')
    expect(root).not.toContain('data-unchecked')
    expect(root).toContain('tabindex="0"')

    let indicator = getTag(html, /<span[^>]*data-part="indicator"[^>]*>/)
    expect(indicator).toContain('data-checked=""')
    expect(indicator).not.toMatch(/\shidden/)

    let input = getTag(html, /<input[^>]*type="checkbox"[^>]*>/)
    expect(input).toContain('name="terms"')
    expect(input).toContain('value="yes"')
    expect(input).toMatch(/\schecked(=""|\s|>|\/)/)
    expect(input).toContain('aria-hidden="true"')
    expect(input).toContain('tabindex="-1"')
  })

  it('renders unchecked, mixed, disabled, read-only, and required attributes', async () => {
    let html = await renderToString(
      <div>
        <checkbox.Context>
          <button id="plain" aria-label="Plain" mix={checkbox.root()}>
            <span data-part="indicator" mix={checkbox.indicator()} />
          </button>
        </checkbox.Context>
        <checkbox.Context indeterminate disabled readOnly required>
          <button id="mixed" aria-label="Mixed" mix={checkbox.root()} />
        </checkbox.Context>
      </div>,
    )

    let plain = getTag(html, /<button[^>]*id="plain"[^>]*>/)
    expect(plain).toContain('role="checkbox"')
    expect(plain).toContain('type="button"')
    expect(plain).toContain('aria-checked="false"')
    expect(plain).toContain('data-unchecked=""')
    expect(plain).not.toContain('tabindex')

    let indicator = getTag(html, /<span[^>]*data-part="indicator"[^>]*>/)
    expect(indicator).toMatch(/\shidden/)
    expect(indicator).toContain('aria-hidden="true"')

    let mixed = getTag(html, /<button[^>]*id="mixed"[^>]*>/)
    expect(mixed).toContain('aria-checked="mixed"')
    expect(mixed).toContain('data-indeterminate=""')
    expect(mixed).not.toContain('data-checked')
    expect(mixed).not.toContain('data-unchecked')
    expect(mixed).toContain('data-disabled=""')
    expect(mixed).toContain('data-readonly=""')
    expect(mixed).toContain('data-required=""')
    expect(mixed).toContain('aria-readonly="true"')
    expect(mixed).toContain('aria-required="true"')
    expect(mixed).toMatch(/\sdisabled/)

    let inputs = getTags(html, /<input[^>]*type="checkbox"[^>]*>/)
    expect(inputs[1]).toMatch(/\sdisabled/)
    expect(inputs[1]).toMatch(/\srequired/)
  })

  it('renders uncheckedValue and keepMounted indicators', async () => {
    let html = await renderToString(
      <checkbox.Context name="marketing" value="yes" uncheckedValue="no">
        <span aria-label="Marketing" mix={checkbox.root()}>
          <span data-part="indicator" mix={checkbox.indicator({ keepMounted: true })} />
        </span>
      </checkbox.Context>,
    )

    let hidden = getTag(html, /<input[^>]*type="hidden"[^>]*>/)
    expect(hidden).toContain('name="marketing"')
    expect(hidden).toContain('value="no"')
    let indicator = getTag(html, /<span[^>]*data-part="indicator"[^>]*>/)
    expect(indicator).not.toMatch(/\shidden/)
    expect(indicator).toContain('data-unchecked=""')
  })
})
