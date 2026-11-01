import { expect } from 'remix/assert'
import { describe, it } from 'remix/test'
import { renderToString } from 'remix/component/server'

import { toggleButton } from './toggle-button.ts'
import * as toggleButtonGroup from './toggle-button-group.ts'

function getTag(html: string, pattern: RegExp) {
  let match = html.match(pattern)
  expect(match).not.toBe(null)
  return match![0]
}

describe('toggle-button-group (server render)', () => {
  it('renders group attributes, pressed state, and a single tab stop', async () => {
    let html = await renderToString(
      <toggleButtonGroup.Context defaultValue={['b']} multiple orientation="vertical">
        <div aria-label="Letters" mix={toggleButtonGroup.root()}>
          {['a', 'b', 'c'].map((value) => (
            <button data-name={value} mix={toggleButton({ value })}>
              {value}
            </button>
          ))}
        </div>
      </toggleButtonGroup.Context>,
    )

    let group = getTag(html, /<div[^>]*role="group"[^>]*>/)
    expect(group).toContain('data-orientation="vertical"')
    expect(group).toContain('data-multiple=""')
    expect(group).not.toContain('data-disabled')

    let a = getTag(html, /<button[^>]*data-name="a"[^>]*>/)
    let b = getTag(html, /<button[^>]*data-name="b"[^>]*>/)
    let c = getTag(html, /<button[^>]*data-name="c"[^>]*>/)
    expect(a).toContain('aria-pressed="false"')
    expect(a).toContain('tabindex="0"')
    expect(b).toContain('aria-pressed="true"')
    expect(b).toContain('data-pressed=""')
    expect(b).toContain('tabindex="-1"')
    expect(c).toContain('tabindex="-1"')
  })

  it('renders a disabled group', async () => {
    let html = await renderToString(
      <toggleButtonGroup.Context disabled>
        <div aria-label="Letters" mix={toggleButtonGroup.root()}>
          <button mix={toggleButton({ value: 'a' })}>a</button>
        </div>
      </toggleButtonGroup.Context>,
    )

    expect(getTag(html, /<div[^>]*role="group"[^>]*>/)).toContain('data-disabled=""')
    let button = getTag(html, /<button[^>]*>/)
    expect(button).toMatch(/\sdisabled/)
    expect(button).toContain('data-disabled=""')
    expect(button).not.toContain('tabindex')
  })
})
