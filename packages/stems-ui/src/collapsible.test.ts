import { expect } from 'remix/assert'
import { describe, it } from 'remix/test'
import { createElement } from 'remix/component'
import { renderToString } from 'remix/component/server'

import * as collapsible from './collapsible.ts'

function renderCollapsible(
  props: collapsible.CollapsibleContextProps,
  panelOptions?: collapsible.CollapsiblePanelOptions,
) {
  return renderToString(
    createElement(
      collapsible.Context,
      props,
      createElement(
        'div',
        { class: 'root', mix: collapsible.root() },
        createElement('button', { mix: collapsible.trigger() }, 'Toggle'),
        createElement('div', { class: 'panel', mix: collapsible.panel(panelOptions) }, 'Content'),
      ),
    ),
  )
}

function getTag(html: string, pattern: RegExp) {
  let match = html.match(pattern)
  expect(match).not.toBe(null)
  return match![0]
}

describe('collapsible (server render)', () => {
  it('renders a closed collapsible with a hidden panel', async () => {
    let html = await renderCollapsible({})

    let root = getTag(html, /<div[^>]*class="root"[^>]*>/)
    expect(root).toContain('data-closed=""')
    expect(root).not.toContain('data-open')

    let trigger = getTag(html, /<button[^>]*>/)
    expect(trigger).toContain('type="button"')
    expect(trigger).toContain('aria-expanded="false"')
    expect(trigger).not.toContain('data-panel-open')

    let panel = getTag(html, /<div[^>]*class="panel"[^>]*>/)
    expect(panel).toMatch(/\shidden(=""|\s|>)/)
    expect(panel).toContain('data-closed=""')
    expect(panel).not.toContain('data-open')
    expect(panel).not.toContain('data-starting-style')

    let id = panel.match(/id="([^"]+)"/)?.[1]
    expect(id).toBeTruthy()
    expect(trigger).toContain(`aria-controls="${id}"`)
  })

  it('renders an open collapsible with a visible panel', async () => {
    let html = await renderCollapsible({ defaultOpen: true })

    expect(getTag(html, /<div[^>]*class="root"[^>]*>/)).toContain('data-open=""')

    let trigger = getTag(html, /<button[^>]*>/)
    expect(trigger).toContain('aria-expanded="true"')
    expect(trigger).toContain('data-panel-open=""')

    let panel = getTag(html, /<div[^>]*class="panel"[^>]*>/)
    expect(panel).not.toContain('hidden')
    expect(panel).toContain('data-open=""')
    expect(panel).not.toContain('data-closed')
  })

  it('renders controlled state', async () => {
    let html = await renderCollapsible({ open: true, defaultOpen: false })
    expect(getTag(html, /<button[^>]*>/)).toContain('aria-expanded="true"')
  })

  it('renders hidden="until-found" for searchable closed panels', async () => {
    let html = await renderCollapsible({}, { hiddenUntilFound: true })
    expect(getTag(html, /<div[^>]*class="panel"[^>]*>/)).toContain('hidden="until-found"')
  })

  it('renders disabled state', async () => {
    let html = await renderCollapsible({ disabled: true })

    let trigger = getTag(html, /<button[^>]*>/)
    expect(trigger).toMatch(/\sdisabled(=""|\s|>)/)
    expect(trigger).toContain('data-disabled=""')
    expect(getTag(html, /<div[^>]*class="root"[^>]*>/)).toContain('data-disabled=""')
  })
})
