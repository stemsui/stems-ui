import { expect } from 'remix/assert'
import { describe, it } from 'remix/test'
import { createElement } from 'remix/component'
import { renderToString } from 'remix/component/server'

import * as accordion from './accordion.tsx'

function item(value: string, extra: accordion.AccordionItemContextProps = {}) {
  return createElement(
    accordion.ItemContext,
    { value, ...extra },
    createElement(
      'div',
      { class: `item-${value}`, mix: accordion.item() },
      createElement(
        'h3',
        { class: `header-${value}`, mix: accordion.header() },
        createElement('button', { class: `trigger-${value}`, mix: accordion.trigger() }, value),
      ),
      createElement('div', { class: `panel-${value}`, mix: accordion.panel() }, `${value} content`),
    ),
  )
}

function renderAccordion(props: accordion.AccordionContextProps) {
  return renderToString(
    createElement(
      accordion.Context,
      props,
      createElement(
        'div',
        { class: 'root', mix: accordion.root() },
        item('a'),
        item('b', { disabled: true }),
        item('c'),
      ),
    ),
  )
}

function getTag(html: string, className: string) {
  let match = html.match(new RegExp(`<[a-z0-9]+[^>]*class="${className}"[^>]*>`))
  expect(match).not.toBe(null)
  return match![0]
}

describe('accordion (server render)', () => {
  it('renders open and closed items', async () => {
    let html = await renderAccordion({ defaultValue: ['c'] })

    let root = getTag(html, 'root')
    expect(root).toContain('data-orientation="vertical"')
    expect(root).not.toContain('data-disabled')

    let triggerA = getTag(html, 'trigger-a')
    expect(triggerA).toContain('type="button"')
    expect(triggerA).toContain('aria-expanded="false"')
    expect(triggerA).toContain('data-index="0"')
    expect(triggerA).not.toContain('data-panel-open')

    let panelA = getTag(html, 'panel-a')
    expect(panelA).toMatch(/\shidden(=""|\s|>)/)
    expect(panelA).toContain('data-closed=""')
    expect(panelA).toContain('role="region"')
    expect(panelA).toContain('data-index="0"')

    let triggerId = triggerA.match(/id="([^"]+)"/)?.[1]
    let panelId = panelA.match(/id="([^"]+)"/)?.[1]
    expect(triggerId).toBeTruthy()
    expect(panelId).toBeTruthy()
    expect(triggerA).toContain(`aria-controls="${panelId}"`)
    expect(panelA).toContain(`aria-labelledby="${triggerId}"`)

    let triggerC = getTag(html, 'trigger-c')
    expect(triggerC).toContain('aria-expanded="true"')
    expect(triggerC).toContain('data-panel-open=""')
    expect(triggerC).toContain('data-index="2"')

    let panelC = getTag(html, 'panel-c')
    expect(panelC).not.toContain('hidden')
    expect(panelC).toContain('data-open=""')
    expect(panelC).toContain('data-orientation="vertical"')

    expect(getTag(html, 'item-c')).toContain('data-open=""')
    expect(getTag(html, 'header-c')).toContain('data-open=""')
    expect(getTag(html, 'item-a')).not.toContain('data-open')
  })

  it('renders disabled items', async () => {
    let html = await renderAccordion({})

    let triggerB = getTag(html, 'trigger-b')
    expect(triggerB).toMatch(/\sdisabled(=""|\s|>)/)
    expect(triggerB).toContain('data-disabled=""')
    expect(getTag(html, 'item-b')).toContain('data-disabled=""')
    expect(getTag(html, 'panel-b')).toContain('data-disabled=""')
    expect(getTag(html, 'trigger-a')).not.toContain('disabled')
  })

  it('renders root options', async () => {
    let html = await renderAccordion({
      value: ['a', 'c'],
      multiple: true,
      disabled: true,
      orientation: 'horizontal',
      hiddenUntilFound: true,
    })

    let root = getTag(html, 'root')
    expect(root).toContain('data-orientation="horizontal"')
    expect(root).toContain('data-disabled=""')
    expect(getTag(html, 'trigger-a')).toContain('aria-expanded="true"')
    expect(getTag(html, 'trigger-c')).toContain('aria-expanded="true"')
    expect(getTag(html, 'panel-b')).toContain('hidden="until-found"')
    expect(getTag(html, 'panel-a')).not.toContain('hidden')
  })
})
