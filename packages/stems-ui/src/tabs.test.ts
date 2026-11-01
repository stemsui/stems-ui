import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import { createElement, type ElementProps, type RemixNode } from 'remix/component'
import { renderToString } from 'remix/component/server'

import * as tabs from './tabs.ts'

type TabSpec = { value: string; disabled?: boolean }

function example(contextProps: tabs.TabsContextProps, specs: TabSpec[]): RemixNode {
  let tabNodes = specs.map((spec) =>
    createElement(
      'button',
      { mix: tabs.tab({ value: spec.value, disabled: spec.disabled }) } as ElementProps,
      spec.value,
    ),
  )
  let panelNodes = specs.map((spec) =>
    createElement('div', { mix: tabs.panel({ value: spec.value }) } as ElementProps, spec.value),
  )

  return createElement(
    tabs.Context,
    contextProps,
    createElement(
      'div',
      { mix: tabs.root() } as ElementProps,
      createElement(
        'div',
        { mix: tabs.list() } as ElementProps,
        ...tabNodes,
        createElement('span', { mix: tabs.indicator() } as ElementProps),
      ),
      ...panelNodes,
    ),
  )
}

/** Returns the opening tag that contains `marker` (e.g. `>a</button>` → the `<button ...>`). */
function openingTag(html: string, pattern: RegExp): string {
  let match = html.match(pattern)
  assert.ok(match, `Expected ${pattern} in ${html}`)
  return match[0]
}

function tabTag(html: string, value: string) {
  return openingTag(html, new RegExp(`<button[^>]*>${value}</button>`))
}

function panelTag(html: string, value: string) {
  return openingTag(html, new RegExp(`<div[^>]*role="tabpanel"[^>]*>${value}</div>`))
}

describe('tabs (server render)', () => {
  it('renders the default tab and panel as active', async () => {
    let html = await renderToString(
      example({ defaultValue: 'b' }, [{ value: 'a' }, { value: 'b' }, { value: 'c' }]),
    )

    let a = tabTag(html, 'a')
    let b = tabTag(html, 'b')
    assert.match(a, /role="tab"/)
    assert.match(a, /aria-selected="false"/)
    assert.match(a, /tabindex="-1"/i)
    assert.doesNotMatch(a, /data-active/)
    assert.match(b, /aria-selected="true"/)
    assert.match(b, /tabindex="0"/i)
    assert.match(b, /data-active=""/)
    assert.match(b, /data-orientation="horizontal"/)
    assert.match(b, /data-activation-direction="none"/)
    assert.match(b, /type="button"/)

    let panelA = panelTag(html, 'a')
    let panelB = panelTag(html, 'b')
    assert.match(panelA, /\shidden/)
    assert.match(panelA, /\sinert/)
    assert.match(panelA, /data-hidden=""/)
    assert.match(panelA, /data-index="0"/)
    assert.doesNotMatch(panelB, /\shidden/)
    assert.doesNotMatch(panelB, /data-hidden/)
    assert.match(panelB, /tabindex="0"/i)
    assert.match(panelB, /data-index="1"/)
  })

  it('links tabs and panels with ids', async () => {
    let html = await renderToString(example({}, [{ value: 'one' }, { value: 'two' }]))
    let tabId = tabTag(html, 'one').match(/\sid="([^"]+)"/)?.[1]
    let controls = tabTag(html, 'one').match(/aria-controls="([^"]+)"/)?.[1]
    let panel = panelTag(html, 'one')

    assert.ok(tabId)
    assert.ok(controls)
    assert.match(panel, new RegExp(`\\sid="${controls}"`))
    assert.match(panel, new RegExp(`aria-labelledby="${tabId}"`))
  })

  it('selects the first enabled tab when there is no default', async () => {
    let html = await renderToString(
      example({}, [{ value: 'a', disabled: true }, { value: 'b' }, { value: 'c' }]),
    )

    let a = tabTag(html, 'a')
    assert.match(a, /\sdisabled/)
    assert.match(a, /data-disabled=""/)
    assert.match(a, /aria-selected="false"/)
    assert.match(tabTag(html, 'b'), /aria-selected="true"/)
    assert.match(panelTag(html, 'a'), /\shidden/)
    assert.doesNotMatch(panelTag(html, 'b'), /\shidden/)
  })

  it('renders no active tab for a null value', async () => {
    let html = await renderToString(example({ value: null }, [{ value: 'a' }, { value: 'b' }]))

    assert.match(tabTag(html, 'a'), /aria-selected="false"/)
    assert.match(tabTag(html, 'a'), /tabindex="0"/i)
    assert.match(tabTag(html, 'b'), /tabindex="-1"/i)
    assert.match(panelTag(html, 'a'), /\shidden/)
    assert.match(panelTag(html, 'b'), /\shidden/)
  })

  it('renders orientation attributes', async () => {
    let html = await renderToString(
      example({ defaultValue: 'a', orientation: 'vertical' }, [{ value: 'a' }]),
    )

    let list = openingTag(html, /<div[^>]*role="tablist"[^>]*>/)
    assert.match(list, /aria-orientation="vertical"/)
    assert.match(list, /data-orientation="vertical"/)
    assert.match(openingTag(html, /<div[^>]*>/), /data-orientation="vertical"/)
  })

  it('keeps the indicator hidden until it is measured on the client', async () => {
    let html = await renderToString(example({ defaultValue: 'a' }, [{ value: 'a' }]))
    let indicator = openingTag(html, /<span[^>]*>/)

    assert.match(indicator, /\shidden/)
    assert.match(indicator, /role="presentation"/)
    assert.doesNotMatch(indicator, /--active-tab/)
  })
})
