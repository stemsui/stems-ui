import { expect } from 'remix/assert'
import { describe, it } from 'remix/test'
import { renderToString } from 'remix/component/server'

import * as popover from './popover.ts'

function renderPopover(props: popover.PopoverContextProps = {}, noArgs = false) {
  return renderToString(
    <popover.Context {...props}>
      <button mix={noArgs ? popover.trigger() : popover.trigger({ disabled: false })}>Open</button>
      <div mix={popover.backdrop()} class="backdrop" />
      <div
        class="popup"
        mix={noArgs ? popover.popup() : popover.popup({ side: 'top', align: 'end' })}
      >
        <span class="arrow" mix={popover.arrow()} />
        <h2 mix={popover.title()}>Title</h2>
        <p mix={popover.description()}>Description</p>
        <button class="close" mix={popover.close()}>
          Close
        </button>
      </div>
    </popover.Context>,
  )
}

function getTag(html: string, pattern: RegExp) {
  let match = html.match(pattern)
  expect(match).not.toBe(null)
  return match![0]
}

describe('popover (server render)', () => {
  it('renders a closed popover with a hidden manual popup', async () => {
    let html = await renderPopover()

    let trigger = getTag(html, /<button[^>]*>Open/)
    expect(trigger).toContain('type="button"')
    expect(trigger).toContain('aria-haspopup="dialog"')
    expect(trigger).toContain('aria-expanded="false"')
    expect(trigger).not.toContain('data-popup-open')

    let popup = getTag(html, /<div[^>]*class="popup"[^>]*>/)
    expect(popup).toContain('popover="manual"')
    expect(popup).toContain('role="dialog"')
    expect(popup).toMatch(/\shidden(=""|\s|>)/)
    expect(popup).toContain('data-closed=""')
    expect(popup).not.toContain('data-open')
    expect(popup).toContain('data-side="top"')
    expect(popup).toContain('data-align="end"')
    expect(popup).not.toContain('data-starting-style')

    let id = popup.match(/\sid="([^"]+)"/)?.[1]
    expect(id).toBeTruthy()
    expect(trigger).toContain(`aria-controls="${id}"`)

    let backdrop = getTag(html, /<div[^>]*class="backdrop"[^>]*>/)
    expect(backdrop).toContain('popover="manual"')
    expect(backdrop).toMatch(/\shidden(=""|\s|>)/)
    expect(backdrop).toContain('data-closed=""')

    let arrow = getTag(html, /<span[^>]*class="arrow"[^>]*>/)
    expect(arrow).toContain('aria-hidden="true"')
    expect(arrow).toContain('data-side="top"')

    expect(getTag(html, /<h2[^>]*>/)).toMatch(/\sid="[^"]+"/)
    expect(getTag(html, /<p[^>]*>/)).toMatch(/\sid="[^"]+"/)
    expect(getTag(html, /<button[^>]*class="close"[^>]*>/)).toContain('type="button"')
  })

  it('renders open state with defaultOpen', async () => {
    let html = await renderPopover({ defaultOpen: true })

    let trigger = getTag(html, /<button[^>]*>Open/)
    expect(trigger).toContain('aria-expanded="true"')
    expect(trigger).toContain('data-popup-open=""')

    let popup = getTag(html, /<div[^>]*class="popup"[^>]*>/)
    expect(popup).not.toMatch(/\shidden(=""|\s|>)/)
    expect(popup).toContain('data-open=""')
    expect(popup).not.toContain('data-closed')
  })

  it('renders controlled and modal state', async () => {
    let html = await renderPopover({ open: true, defaultOpen: false, modal: true })
    expect(getTag(html, /<button[^>]*>Open/)).toContain('aria-expanded="true"')
    expect(getTag(html, /<div[^>]*class="popup"[^>]*>/)).toContain('aria-modal="true"')
  })

  it('renders with no-argument mixin calls', async () => {
    let html = await renderPopover({}, true)
    let popup = getTag(html, /<div[^>]*class="popup"[^>]*>/)
    expect(popup).toContain('role="dialog"')
    expect(popup).toContain('data-side="bottom"')
    expect(popup).toContain('data-align="center"')
  })
})

describe('popover detached triggers (server render)', () => {
  it('renders a detached trigger closed and the payload function', async () => {
    let h = popover.createHandle<string>()
    let html = await renderToString(
      <div>
        <button mix={popover.trigger({ handle: h, payload: 'one' })}>Detached</button>
        <popover.Context handle={h}>
          {({ payload }) => (
            <div class="popup" mix={popover.popup()}>
              payload:{payload ?? 'none'}
            </div>
          )}
        </popover.Context>
      </div>,
    )
    let trigger = getTag(html, /<button[^>]*>Detached/)
    expect(trigger).toContain('type="button"')
    expect(trigger).toContain('aria-haspopup="dialog"')
    expect(trigger).toContain('aria-expanded="false"')
    expect(trigger).not.toContain('data-popup-open')
    expect(trigger).not.toContain('aria-controls')
    expect(html).toContain('payload:none')
    expect(getTag(html, /<div[^>]*class="popup"[^>]*>/)).toContain('data-closed=""')
  })

  it('renders an open Context with a payload from a trigger inside it', async () => {
    let html = await renderToString(
      <popover.Context defaultOpen>
        {({ payload }) => (
          <>
            <button mix={popover.trigger({ payload: 'inside' })}>Open</button>
            <div class="popup" mix={popover.popup()}>
              payload:{String(payload)}
            </div>
          </>
        )}
      </popover.Context>,
    )
    expect(getTag(html, /<button[^>]*>Open/)).toContain('aria-expanded="true"')
    expect(getTag(html, /<div[^>]*class="popup"[^>]*>/)).toContain('data-open=""')
  })
})
