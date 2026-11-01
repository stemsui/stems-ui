import { expect } from 'remix/assert'
import { describe, it } from 'remix/test'
import { createElement } from 'remix/component'
import { renderToString } from 'remix/component/server'

import { toggleButton, type ToggleButtonOptions } from './toggle-button.ts'

function renderToggle(options: ToggleButtonOptions, host: 'button' | 'span' = 'button') {
  return renderToString(createElement(host, { mix: toggleButton(options) }, 'Bold'))
}

describe('toggleButton (server render)', () => {
  it('renders pressed state attributes', async () => {
    let html = await renderToggle({ defaultPressed: true })
    expect(html).toContain('type="button"')
    expect(html).toContain('aria-pressed="true"')
    expect(html).toContain('data-pressed=""')
    expect(html).not.toContain('data-disabled')
  })

  it('renders unpressed, controlled state', async () => {
    let html = await renderToggle({ pressed: false, defaultPressed: true })
    expect(html).toContain('aria-pressed="false"')
    expect(html).not.toContain('data-pressed')
  })

  it('renders disabled state', async () => {
    let html = await renderToggle({ disabled: true })
    expect(html).toMatch(/\sdisabled(=""|\s|>)/)
    expect(html).toContain('data-disabled=""')
  })

  it('renders button semantics on non-button hosts', async () => {
    let html = await renderToggle({ pressed: true }, 'span')
    expect(html).toContain('role="button"')
    expect(html).toContain('tabindex="0"')
    expect(html).toContain('aria-pressed="true"')
    expect(html).not.toContain('type=')
  })
})
