import { expect } from 'remix/assert'
import { describe, it } from 'remix/test'
import { renderToString } from 'remix/component/server'

import * as tooltip from './tooltip.ts'

function getTag(html: string, pattern: RegExp) {
  let match = html.match(pattern)
  expect(match).not.toBe(null)
  return match![0]
}

function renderTooltip(props: tooltip.TooltipContextProps = {}, noArgs = false) {
  return renderToString(
    <tooltip.Provider>
      <tooltip.Context {...props}>
        <button aria-label="Bold" mix={noArgs ? tooltip.trigger() : tooltip.trigger({})}>
          B
        </button>
        <div class="popup" mix={noArgs ? tooltip.popup() : tooltip.popup({ align: 'start' })}>
          <span class="arrow" mix={tooltip.arrow()} />
          Bold
        </div>
      </tooltip.Context>
    </tooltip.Provider>,
  )
}

describe('tooltip (server render)', () => {
  it('renders a closed tooltip with a hidden manual popup', async () => {
    let html = await renderTooltip()

    let trigger = getTag(html, /<button[^>]*>/)
    expect(trigger).not.toContain('aria-haspopup')
    expect(trigger).not.toContain('aria-expanded')
    expect(trigger).not.toContain('aria-describedby')
    expect(trigger).not.toContain('type=')
    expect(trigger).not.toContain('data-popup-open')
    expect(trigger).not.toContain('data-trigger-disabled')

    let popup = getTag(html, /<div[^>]*class="popup"[^>]*>/)
    expect(popup).toContain('role="tooltip"')
    expect(popup).toContain('popover="manual"')
    expect(popup).toMatch(/\shidden(=""|\s|>)/)
    expect(popup).toContain('data-closed=""')
    expect(popup).not.toContain('data-open')
    expect(popup).toContain('data-side="top"')
    expect(popup).toContain('data-align="start"')
    expect(popup).not.toContain('data-instant')

    let arrow = getTag(html, /<span[^>]*class="arrow"[^>]*>/)
    expect(arrow).toContain('aria-hidden="true"')
    expect(arrow).toContain('data-closed=""')
    expect(arrow).toContain('data-side="top"')
  })

  it('renders the open state with defaultOpen', async () => {
    let html = await renderTooltip({ defaultOpen: true })
    let trigger = getTag(html, /<button[^>]*>/)
    expect(trigger).toContain('data-popup-open=""')
    let popup = getTag(html, /<div[^>]*class="popup"[^>]*>/)
    expect(popup).toContain('data-open=""')
    expect(popup).not.toMatch(/\shidden(=""|\s|>)/)
    expect(popup).not.toContain('data-starting-style')
  })

  it('marks disabled triggers', async () => {
    let html = await renderTooltip({ disabled: true })
    let trigger = getTag(html, /<button[^>]*>/)
    expect(trigger).toContain('data-trigger-disabled=""')
    expect(trigger).not.toMatch(/\sdisabled(=""|\s|>)/)
  })

  it('works with no-argument mixin calls', async () => {
    let html = await renderTooltip({}, true)
    let popup = getTag(html, /<div[^>]*class="popup"[^>]*>/)
    expect(popup).toContain('role="tooltip"')
    expect(popup).toContain('data-side="top"')
    expect(popup).toContain('data-align="center"')
  })
})
