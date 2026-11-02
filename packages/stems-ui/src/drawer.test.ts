import { expect } from 'remix/assert'
import { describe, it } from 'remix/test'
import { createElement } from 'remix/component'
import { renderToString } from 'remix/component/server'

import * as drawer from './drawer.ts'

function renderDrawer(props: drawer.DrawerContextProps) {
  return renderToString(
    createElement(
      drawer.Provider,
      {},
      createElement(
        'div',
        { class: 'indent', mix: drawer.indent() },
        createElement(
          drawer.Context,
          props,
          createElement('button', { class: 'trigger', mix: drawer.trigger() }, 'Open'),
          createElement('div', { class: 'area', mix: drawer.swipeArea() }),
          createElement('div', { class: 'backdrop', mix: drawer.backdrop() }),
          createElement(
            'dialog',
            { class: 'popup', mix: drawer.popup() },
            createElement(
              'div',
              { mix: drawer.content() },
              createElement('h2', { mix: drawer.title() }, 'Move goal'),
              createElement('p', { mix: drawer.description() }, 'Set your daily goal.'),
              createElement('button', { class: 'close', mix: drawer.close() }, 'Close'),
            ),
          ),
        ),
      ),
    ),
  )
}

function getTag(html: string, pattern: RegExp) {
  let match = html.match(pattern)
  expect(match).not.toBe(null)
  return match![0]
}

describe('drawer (server render)', () => {
  it('renders a closed drawer with swipe attributes and CSS variables', async () => {
    let html = await renderDrawer({})

    let popup = getTag(html, /<dialog[^>]*>/)
    expect(popup).toContain('data-closed=""')
    expect(popup).toContain('data-swipe-direction="down"')
    expect(popup).toContain('aria-modal="true"')
    expect(popup).toContain('--drawer-swipe-movement-y: 0px')
    expect(popup).toContain('--drawer-swipe-strength: 1')
    expect(popup).toContain('--nested-drawers: 0')
    expect(popup).toContain('--nested-dialogs: 0')
    expect(popup).toContain('touch-action: pan-x')
    expect(popup).not.toContain('data-swiping')

    let backdrop = getTag(html, /<div[^>]*class="backdrop"[^>]*>/)
    expect(backdrop).toMatch(/\shidden(=""|\s|>)/)
    expect(backdrop).toContain('--drawer-swipe-progress: 0')

    let indent = getTag(html, /<div[^>]*class="indent"[^>]*>/)
    expect(indent).not.toContain('data-active')
  })

  it('renders open state and other directions', async () => {
    let html = await renderDrawer({ defaultOpen: true, swipeDirection: 'left' })

    let popup = getTag(html, /<dialog[^>]*>/)
    expect(popup).toContain('data-open=""')
    expect(popup).toContain('data-swipe-direction="left"')
    expect(popup).toContain('touch-action: pan-y')
    expect(getTag(html, /<button[^>]*class="trigger"[^>]*>/)).toContain('aria-expanded="true"')
  })

  it('renders snap point state and the swipe area', async () => {
    let html = await renderDrawer({ snapPoints: ['148px', 1], defaultSnapPoint: 1 })
    let popup = getTag(html, /<dialog[^>]*>/)
    expect(popup).toContain('data-expanded=""')
    expect(popup).toContain('--drawer-snap-point-offset: 0px')
    expect(popup).not.toContain('--drawer-height')

    let collapsed = getTag(await renderDrawer({ snapPoints: ['148px', 1] }), /<dialog[^>]*>/)
    expect(collapsed).not.toContain('data-expanded')

    let area = getTag(html, /<div[^>]*class="area"[^>]*>/)
    expect(area).toContain('role="presentation"')
    expect(area).toContain('aria-hidden="true"')
    expect(area).toContain('data-closed=""')
    expect(area).toContain('data-swipe-direction="up"')
    expect(area).toContain('touch-action: pan-x')
    expect(area).not.toContain('data-swiping')

    let open = getTag(await renderDrawer({ defaultOpen: true }), /<div[^>]*class="area"[^>]*>/)
    expect(open).toContain('data-open=""')
    expect(open).toContain('pointer-events: none')
  })
})

describe('drawer detached triggers (server render)', () => {
  it('renders a detached trigger closed', async () => {
    let h = drawer.createHandle<string>()
    let html = await renderToString(
      createElement(
        'div',
        {},
        createElement('button', { mix: drawer.trigger({ handle: h, payload: 'x' }) }, 'Detached'),
        createElement(
          drawer.Context,
          { handle: h, defaultOpen: false },
          createElement('dialog', { class: 'popup', mix: drawer.popup() }, 'Body'),
        ),
      ),
    )
    let trigger = getTag(html, /<button[^>]*>Detached/)
    expect(trigger).toContain('type="button"')
    expect(trigger).toContain('aria-haspopup="dialog"')
    expect(trigger).toContain('aria-expanded="false"')
    expect(trigger).not.toContain('aria-controls')
    expect(trigger).not.toContain('data-popup-open')
    expect(getTag(html, /<dialog[^>]*class="popup"[^>]*>/)).toContain('data-closed=""')
  })
})
