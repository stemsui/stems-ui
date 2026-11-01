import { expect } from 'remix/assert'
import { describe, it } from 'remix/test'
import { renderToString } from 'remix/component/server'

import * as select from './select.tsx'

const ITEMS = [
  { value: 'apple', label: 'Apple' },
  { value: 'banana', label: 'Banana' },
  { value: 'cherry', label: 'Cherry' },
]

function renderSelect(props: select.SelectContextProps = {}, noArgs = false) {
  return renderToString(
    <form>
      <select.Context {...props}>
        <div class="label" mix={select.label()}>
          Fruit
        </div>
        <button class="trigger" mix={noArgs ? select.trigger() : select.trigger({})}>
          <span class="value" mix={select.value()}>
            <select.ValueText placeholder="Pick a fruit" />
          </span>
          <span class="icon" mix={select.icon()} />
        </button>
        <div mix={select.backdrop()} class="backdrop" />
        <div class="popup" mix={noArgs ? select.popup() : select.popup({ side: 'top' })}>
          <div class="up" mix={select.scrollUpArrow()} />
          <div class="list" mix={select.list()}>
            <div class="group" mix={select.group()}>
              <div class="group-label" mix={select.groupLabel()}>
                Fruits
              </div>
              {ITEMS.map((item) => (
                <select.ItemContext value={item.value} disabled={item.value === 'banana'}>
                  <div class={`item item-${item.value}`} mix={select.item()}>
                    <span mix={select.itemText()}>{item.label}</span>
                    <span
                      class={`indicator indicator-${item.value}`}
                      mix={select.itemIndicator()}
                    />
                  </div>
                </select.ItemContext>
              ))}
            </div>
            <div class="sep" mix={select.separator()} />
          </div>
          <div class="down" mix={select.scrollDownArrow()} />
          <div class="arrow" mix={select.arrow()} />
        </div>
      </select.Context>
    </form>,
  )
}

function getTag(html: string, pattern: RegExp) {
  let match = html.match(pattern)
  expect(match).not.toBe(null)
  return match![0]
}

function attr(tag: string, name: string) {
  return tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1]
}

const HIDDEN = /\shidden(=""|\s|>)/

describe('select (server render)', () => {
  it('renders a closed select with ARIA and a placeholder', async () => {
    let html = await renderSelect()

    let trigger = getTag(html, /<button[^>]*class="trigger"[^>]*>/)
    expect(trigger).toContain('type="button"')
    expect(trigger).toContain('role="combobox"')
    expect(trigger).toContain('aria-haspopup="listbox"')
    expect(trigger).toContain('aria-expanded="false"')
    expect(trigger).toContain('data-placeholder=""')
    expect(trigger).not.toContain('data-popup-open')

    let label = getTag(html, /<div[^>]*class="label"[^>]*>/)
    expect(attr(trigger, 'aria-labelledby')).toBe(attr(label, 'id'))

    let list = getTag(html, /<div[^>]*class="list"[^>]*>/)
    expect(list).toContain('role="listbox"')
    expect(attr(trigger, 'aria-controls')).toBe(attr(list, 'id'))
    expect(list).not.toContain('aria-multiselectable')

    let value = getTag(html, /<span[^>]*class="value"[^>]*>[^<]*/)
    expect(value).toContain('data-placeholder=""')
    expect(value).toContain('>Pick a fruit')

    expect(getTag(html, /<span[^>]*class="icon"[^>]*>/)).toContain('aria-hidden="true"')

    let popup = getTag(html, /<div[^>]*class="popup"[^>]*>/)
    expect(popup).toContain('popover="manual"')
    expect(popup).toMatch(HIDDEN)
    expect(popup).toContain('data-closed=""')
    expect(popup).toContain('data-side="top"')
    expect(popup).not.toContain('role=')

    let backdrop = getTag(html, /<div[^>]*class="backdrop"[^>]*>/)
    expect(backdrop).toMatch(HIDDEN)
    expect(getTag(html, /<div[^>]*class="up"[^>]*>/)).toContain('data-direction="up"')
    expect(getTag(html, /<div[^>]*class="down"[^>]*>/)).toMatch(HIDDEN)
    expect(getTag(html, /<div[^>]*class="arrow"[^>]*>/)).toContain('aria-hidden="true"')
    expect(getTag(html, /<div[^>]*class="group"[^>]*>/)).toContain('role="group"')
    expect(getTag(html, /<div[^>]*class="sep"[^>]*>/)).toContain('role="separator"')

    let apple = getTag(html, /<div[^>]*class="item item-apple"[^>]*>/)
    expect(apple).toContain('role="option"')
    expect(apple).toContain('aria-selected="false"')
    expect(apple).toContain('tabindex="-1"')
    expect(apple).not.toContain('data-selected')
    expect(apple).not.toContain('data-highlighted')
    let banana = getTag(html, /<div[^>]*class="item item-banana"[^>]*>/)
    expect(banana).toContain('aria-disabled="true"')
    expect(banana).toContain('data-disabled=""')
  })

  it('renders the selected label from items and the selected state', async () => {
    let html = await renderSelect({ defaultValue: 'cherry', items: ITEMS, name: 'fruit' })

    let trigger = getTag(html, /<button[^>]*class="trigger"[^>]*>/)
    expect(trigger).not.toContain('data-placeholder')
    let value = getTag(html, /<span[^>]*class="value"[^>]*>[^<]*/)
    expect(value).not.toContain('data-placeholder')
    expect(value).toContain('>Cherry')

    let cherry = getTag(html, /<div[^>]*class="item item-cherry"[^>]*>/)
    expect(cherry).toContain('aria-selected="true"')
    expect(cherry).toContain('data-selected=""')
    expect(getTag(html, /<span[^>]*class="indicator indicator-cherry"[^>]*>/)).not.toMatch(HIDDEN)
    expect(getTag(html, /<span[^>]*class="indicator indicator-apple"[^>]*>/)).toMatch(HIDDEN)

    let input = getTag(html, /<input[^>]*name="fruit"[^>]*>/)
    expect(input).toContain('value="cherry"')
    expect(input).toContain('aria-hidden="true"')
    expect(input).toContain('tabindex="-1"')
  })

  it('falls back to the raw value without items on the server', async () => {
    let html = await renderSelect({ defaultValue: 'apple' })
    expect(getTag(html, /<span[^>]*class="value"[^>]*>[^<]*/)).toContain('>apple')
  })

  it('renders required, disabled, and readOnly state', async () => {
    let html = await renderSelect({ required: true, readOnly: true, name: 'fruit' })
    let trigger = getTag(html, /<button[^>]*class="trigger"[^>]*>/)
    expect(trigger).toContain('aria-required="true"')
    expect(trigger).toContain('data-required=""')
    expect(trigger).toContain('aria-readonly="true"')
    expect(trigger).toContain('data-readonly=""')
    expect(getTag(html, /<input[^>]*name="fruit"[^>]*>/)).toMatch(/\srequired(=""|\s|>)/)

    let disabled = await renderSelect({ disabled: true, name: 'fruit' })
    let disabledTrigger = getTag(disabled, /<button[^>]*class="trigger"[^>]*>/)
    expect(disabledTrigger).toMatch(/\sdisabled(=""|\s|>)/)
    expect(disabledTrigger).toContain('data-disabled=""')
    expect(getTag(disabled, /<input[^>]*name="fruit"[^>]*>/)).toMatch(/\sdisabled(=""|\s|>)/)
  })

  it('renders multiple selection with one input per value', async () => {
    let html = await renderSelect({
      multiple: true,
      defaultValue: ['apple', 'cherry'],
      items: ITEMS,
      name: 'fruits',
    })
    expect(getTag(html, /<div[^>]*class="list"[^>]*>/)).toContain('aria-multiselectable="true"')
    expect(getTag(html, /<span[^>]*class="value"[^>]*>.*?<\/span>/)).toContain('Apple, Cherry')
    let inputs = html.match(/<input[^>]*name="fruits"[^>]*>/g) ?? []
    expect(inputs.length).toBe(2)
    expect(inputs[0]).toContain('type="hidden"')
    expect(inputs[0]).toContain('value="apple"')
    expect(inputs[1]).toContain('value="cherry"')
  })

  it('renders an open popup with defaultOpen', async () => {
    let html = await renderSelect({ defaultOpen: true })
    let trigger = getTag(html, /<button[^>]*class="trigger"[^>]*>/)
    expect(trigger).toContain('aria-expanded="true"')
    expect(trigger).toContain('data-popup-open=""')
    let popup = getTag(html, /<div[^>]*class="popup"[^>]*>/)
    expect(popup).toContain('data-open=""')
    expect(popup).not.toMatch(HIDDEN)
  })

  it('works with no-argument mixin calls', async () => {
    let html = await renderSelect({}, true)
    expect(getTag(html, /<button[^>]*class="trigger"[^>]*>/)).toContain('role="combobox"')
    expect(getTag(html, /<div[^>]*class="popup"[^>]*>/)).toContain('data-side="bottom"')
  })
})
