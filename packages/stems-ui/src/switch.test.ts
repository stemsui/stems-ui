import { expect } from 'remix/assert'
import { describe, it } from 'remix/test'
import { createElement } from 'remix/component'
import { renderToString } from 'remix/component/server'

import * as switch_ from './switch.ts'

function renderSwitch(props: switch_.SwitchContextProps, host: 'span' | 'button' = 'span') {
  return renderToString(
    createElement(
      switch_.Context,
      props,
      createElement(
        host,
        { 'aria-label': 'Notifications', mix: switch_.root() },
        createElement('span', { mix: switch_.thumb() }),
      ),
    ),
  )
}

function getTag(html: string, pattern: RegExp) {
  let match = html.match(pattern)
  expect(match).not.toBe(null)
  return match![0]
}

describe('switch (server render)', () => {
  it('renders checked state attributes on root, thumb, and hidden input', async () => {
    let html = await renderSwitch({ defaultChecked: true, name: 'notifications', value: 'yes' })

    let root = getTag(html, /<span[^>]*role="switch"[^>]*>/)
    expect(root).toContain('aria-checked="true"')
    expect(root).toContain('data-checked=""')
    expect(root).not.toContain('data-unchecked')
    expect(root).toContain('tabindex="0"')

    let thumb = getTag(html, /<span(?![^>]*role=)[^>]*data-checked[^>]*>/)
    expect(thumb).not.toContain('data-unchecked')

    let input = getTag(html, /<input[^>]*type="checkbox"[^>]*>/)
    expect(input).toContain('name="notifications"')
    expect(input).toContain('value="yes"')
    expect(input).toMatch(/\schecked(=""|\s|>|\/)/)
    expect(input).toContain('aria-hidden="true"')
    expect(input).toContain('tabindex="-1"')
  })

  it('renders unchecked, disabled, read-only, and required attributes', async () => {
    let html = await renderSwitch({ disabled: true, readOnly: true, required: true }, 'button')

    let root = getTag(html, /<button[^>]*>/)
    expect(root).toContain('role="switch"')
    expect(root).toContain('type="button"')
    expect(root).toContain('aria-checked="false"')
    expect(root).toContain('data-unchecked=""')
    expect(root).not.toContain('data-checked')
    expect(root).toContain('data-disabled=""')
    expect(root).toContain('data-readonly=""')
    expect(root).toContain('data-required=""')
    expect(root).toContain('aria-readonly="true"')
    expect(root).toContain('aria-required="true"')
    expect(root).toMatch(/\sdisabled(=""|\s|>)/)

    let thumb = getTag(html, /<button[^>]*>\s*<span[^>]*>/)
    expect(thumb).toContain('data-unchecked=""')
    expect(thumb).toContain('data-disabled=""')

    let input = getTag(html, /<input[^>]*type="checkbox"[^>]*>/)
    expect(input).not.toMatch(/\schecked/)
    expect(input).toMatch(/\sdisabled/)
    expect(input).toMatch(/\srequired/)
  })

  it('renders the uncheckedValue input only while unchecked', async () => {
    let off = await renderSwitch({ name: 'mode', value: 'dark', uncheckedValue: 'light' })
    let hidden = getTag(off, /<input[^>]*type="hidden"[^>]*>/)
    expect(hidden).toContain('name="mode"')
    expect(hidden).toContain('value="light"')

    let on = await renderSwitch({
      name: 'mode',
      value: 'dark',
      uncheckedValue: 'light',
      defaultChecked: true,
    })
    expect(on).not.toContain('type="hidden"')
  })
})
