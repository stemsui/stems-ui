import { expect } from 'remix/assert'
import { describe, it } from 'remix/test'
import { renderToString } from 'remix/component/server'

import { toggleButton } from './toggle-button.ts'
import * as toggleButtonGroup from './toggle-button-group.ts'
import * as toolbar from './toolbar.ts'

function getTag(html: string, pattern: RegExp) {
  let match = html.match(pattern)
  expect(match).not.toBe(null)
  return match![0]
}

describe('toolbar (server render)', () => {
  it('renders toolbar attributes and a single tab stop', async () => {
    let html = await renderToString(
      <toolbar.Context orientation="vertical">
        <div aria-label="Tools" mix={toolbar.root()}>
          <button
            data-name="a"
            mix={toolbar.button({ disabled: true, focusableWhenDisabled: false })}
          >
            A
          </button>
          <button data-name="b" mix={toolbar.button()}>
            B
          </button>
          <div mix={toolbar.separator()} />
          <toolbar.GroupContext disabled>
            <div data-name="group" mix={toolbar.group()}>
              <button data-name="c" mix={toolbar.button()}>
                C
              </button>
            </div>
          </toolbar.GroupContext>
          <a data-name="link" href="#x" mix={toolbar.link()}>
            X
          </a>
          <input data-name="input" mix={toolbar.input({ disabled: true })} />
        </div>
      </toolbar.Context>,
    )

    let root = getTag(html, /<div[^>]*role="toolbar"[^>]*>/)
    expect(root).toContain('aria-orientation="vertical"')
    expect(root).toContain('data-orientation="vertical"')
    expect(root).not.toContain('data-disabled')

    let a = getTag(html, /<button[^>]*data-name="a"[^>]*>/)
    expect(a).toMatch(/\sdisabled/)
    expect(a).toContain('tabindex="-1"')
    expect(a).not.toContain('data-focusable')

    let b = getTag(html, /<button[^>]*data-name="b"[^>]*>/)
    expect(b).toContain('tabindex="0"')
    expect(b).toContain('type="button"')
    expect(b).toContain('data-orientation="vertical"')
    expect(b).toContain('data-focusable=""')

    let separator = getTag(html, /<div[^>]*role="separator"[^>]*>/)
    expect(separator).toContain('data-orientation="horizontal"')

    let group = getTag(html, /<div[^>]*data-name="group"[^>]*>/)
    expect(group).toContain('role="group"')
    expect(group).toContain('data-disabled=""')

    let c = getTag(html, /<button[^>]*data-name="c"[^>]*>/)
    expect(c).toContain('aria-disabled="true"')
    expect(c).toContain('data-disabled=""')
    expect(c).toContain('tabindex="-1"')

    expect(getTag(html, /<a[^>]*data-name="link"[^>]*>/)).toContain('tabindex="-1"')

    let input = getTag(html, /<input[^>]*data-name="input"[^>]*>/)
    expect(input).toContain('aria-disabled="true"')
    expect(input).toMatch(/\sreadonly/)
    expect(input).toContain('data-disabled=""')
  })

  it('renders a disabled toolbar and toggle buttons as toolbar items', async () => {
    let html = await renderToString(
      <toolbar.Context disabled>
        <div mix={toolbar.root()}>
          <toggleButtonGroup.Context defaultValue={['b']}>
            <div mix={toggleButtonGroup.root()}>
              <button data-name="a" mix={[toolbar.item(), toggleButton({ value: 'a' })]}>
                A
              </button>
              <button data-name="b" mix={[toolbar.item(), toggleButton({ value: 'b' })]}>
                B
              </button>
            </div>
          </toggleButtonGroup.Context>
        </div>
      </toolbar.Context>,
    )

    expect(getTag(html, /<div[^>]*role="toolbar"[^>]*>/)).toContain('data-disabled=""')
    let a = getTag(html, /<button[^>]*data-name="a"[^>]*>/)
    let b = getTag(html, /<button[^>]*data-name="b"[^>]*>/)
    // The toolbar owns the tab stop (the group would pick the pressed button).
    expect(a).toContain('tabindex="0"')
    expect(b).toContain('tabindex="-1"')
    expect(b).toContain('aria-pressed="true"')
  })
})
