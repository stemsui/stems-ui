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
})
