import { expect } from 'remix/assert'
import { describe, it } from 'remix/test'
import { renderToString } from 'remix/component/server'

import * as combobox from './combobox.tsx'

const ITEMS = [
  { value: 'apple', label: 'Apple' },
  { value: 'banana', label: 'Banana' },
  { value: 'cherry', label: 'Cherry' },
]

function renderCombobox(props: combobox.ComboboxContextProps = {}, noArgs = false) {
  return renderToString(
    <form>
      <combobox.Context {...props}>
        <div class="group" mix={combobox.inputGroup()}>
          {props.multiple ? (
            <div class="chips" mix={combobox.chips()}>
              <combobox.ValueText>
                {(values: string[]) =>
                  values.map((value) => (
                    <span class={`chip chip-${value}`} mix={combobox.chip({ value })}>
                      {value}
                      <button class="remove" mix={combobox.chipRemove()} />
                    </span>
                  ))
                }
              </combobox.ValueText>
            </div>
          ) : null}
          <input class="input" mix={combobox.input()} />
          <button class="clear" mix={noArgs ? combobox.clear() : combobox.clear({})} />
          <button class="trigger" mix={noArgs ? combobox.trigger() : combobox.trigger({})}>
            <span class="icon" mix={combobox.icon()} />
          </button>
        </div>
        <span class="value" mix={combobox.value()}>
          <combobox.ValueText placeholder="None" />
        </span>
        <div class="popup" mix={noArgs ? combobox.popup() : combobox.popup({ side: 'top' })}>
          <div class="status" mix={combobox.status()} />
          <div class="empty" mix={combobox.empty()}>
            <combobox.EmptyText>No results</combobox.EmptyText>
          </div>
          <div class="list" mix={combobox.list()}>
            <div class="grp" mix={combobox.group()}>
              <div class="grp-label" mix={combobox.groupLabel()}>
                Fruits
              </div>
              {ITEMS.map((item) => (
                <combobox.ItemContext value={item.value} label={item.label}>
                  <div class={`item item-${item.value}`} mix={combobox.item()}>
                    {item.label}
                    <span
                      class={`indicator indicator-${item.value}`}
                      mix={combobox.itemIndicator()}
                    />
                  </div>
                </combobox.ItemContext>
              ))}
            </div>
            <div class="sep" mix={combobox.separator()} />
          </div>
          <div class="arrow" mix={combobox.arrow()} />
        </div>
      </combobox.Context>
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

describe('combobox (server render)', () => {
  it('renders a closed combobox with ARIA', async () => {
    let html = await renderCombobox()

    let input = getTag(html, /<input[^>]*class="input"[^>]*>/)
    expect(input).toContain('role="combobox"')
    expect(input).toContain('aria-autocomplete="list"')
    expect(input).toContain('aria-haspopup="listbox"')
    expect(input).toContain('aria-expanded="false"')
    expect(input).toContain('autocomplete="off"')
    expect(input).not.toContain('aria-activedescendant')
    expect(input).not.toContain('data-popup-open')

    let list = getTag(html, /<div[^>]*class="list"[^>]*>/)
    expect(list).toContain('role="listbox"')
    expect(attr(input, 'aria-controls')).toBe(attr(list, 'id'))

    let group = getTag(html, /<div[^>]*class="group"[^>]*>/)
    expect(group).toContain('role="group"')
    expect(group).toContain('data-placeholder=""')

    let trigger = getTag(html, /<button[^>]*class="trigger"[^>]*>/)
    expect(trigger).toContain('type="button"')
    expect(trigger).toContain('aria-expanded="false"')
    expect(trigger).toContain('data-placeholder=""')
    expect(getTag(html, /<button[^>]*class="clear"[^>]*>/)).toMatch(HIDDEN)
    expect(getTag(html, /<span[^>]*class="icon"[^>]*>/)).toContain('aria-hidden="true"')
    expect(getTag(html, /<span[^>]*class="value"[^>]*>[^<]*/)).toContain('>None')

    let popup = getTag(html, /<div[^>]*class="popup"[^>]*>/)
    expect(popup).toContain('popover="manual"')
    expect(popup).toMatch(HIDDEN)
    expect(popup).toContain('data-closed=""')
    expect(popup).toContain('data-side="top"')
    expect(popup).not.toContain('data-empty')

    expect(getTag(html, /<div[^>]*class="status"[^>]*>/)).toContain('role="status"')
    let empty = getTag(html, /<div[^>]*class="empty"[^>]*>[^<]*/)
    expect(empty).toContain('aria-live="polite"')
    expect(empty).not.toContain('No results')
    expect(getTag(html, /<div[^>]*class="grp"[^>]*>/)).toContain('role="group"')
    expect(getTag(html, /<div[^>]*class="sep"[^>]*>/)).toContain('role="separator"')
    expect(getTag(html, /<div[^>]*class="arrow"[^>]*>/)).toContain('aria-hidden="true"')

    let apple = getTag(html, /<div[^>]*class="item item-apple"[^>]*>/)
    expect(apple).toContain('role="option"')
    expect(apple).toContain('aria-selected="false"')
    expect(apple).not.toMatch(HIDDEN)
  })

  it('works with no-argument mixin calls', async () => {
    let html = await renderCombobox({}, true)
    expect(getTag(html, /<button[^>]*class="trigger"[^>]*>/)).toContain('aria-haspopup="listbox"')
    expect(getTag(html, /<div[^>]*class="popup"[^>]*>/)).toContain('popover="manual"')
  })

  it('renders the selected label in the input and the form value', async () => {
    let html = await renderCombobox({ defaultValue: 'cherry', items: ITEMS, name: 'fruit' })
    let input = getTag(html, /<input[^>]*class="input"[^>]*>/)
    expect(input).toContain('value="Cherry"')
    expect(getTag(html, /<div[^>]*class="group"[^>]*>/)).not.toContain('data-placeholder')
    expect(getTag(html, /<span[^>]*class="value"[^>]*>[^<]*/)).toContain('>Cherry')
    expect(getTag(html, /<button[^>]*class="clear"[^>]*>/)).not.toMatch(HIDDEN)

    let cherry = getTag(html, /<div[^>]*class="item item-cherry"[^>]*>/)
    expect(cherry).toContain('aria-selected="true"')
    expect(cherry).toContain('data-selected=""')
    expect(getTag(html, /<span[^>]*class="indicator indicator-cherry"[^>]*>/)).not.toMatch(HIDDEN)
    expect(getTag(html, /<span[^>]*class="indicator indicator-apple"[^>]*>/)).toMatch(HIDDEN)

    let hidden = getTag(html, /<input[^>]*name="fruit"[^>]*>/)
    expect(hidden).toContain('value="cherry"')
    expect(hidden).toContain('aria-hidden="true"')
  })

  it('filters by defaultInputValue in the server HTML', async () => {
    let html = await renderCombobox({ defaultInputValue: 'an' })
    expect(getTag(html, /<input[^>]*class="input"[^>]*>/)).toContain('value="an"')
    expect(getTag(html, /<div[^>]*class="item item-banana"[^>]*>/)).not.toMatch(HIDDEN)
    expect(getTag(html, /<div[^>]*class="item item-apple"[^>]*>/)).toMatch(HIDDEN)
  })

  it('renders the empty state for items with no match', async () => {
    let html = await renderCombobox({ items: ITEMS, defaultInputValue: 'zzz' })
    expect(getTag(html, /<div[^>]*class="popup"[^>]*>/)).toContain('data-empty=""')
    expect(getTag(html, /<div[^>]*class="list"[^>]*>/)).toContain('data-empty=""')
    expect(getTag(html, /<input[^>]*class="input"[^>]*>/)).toContain('data-list-empty=""')
    expect(getTag(html, /<div[^>]*class="empty"[^>]*>[^<]*/)).toContain('No results')
  })

  it('renders chips and one hidden input per value when multiple', async () => {
    let html = await renderCombobox({
      multiple: true,
      name: 'fruits',
      defaultValue: ['apple', 'cherry'],
      items: ITEMS,
    })
    expect(getTag(html, /<div[^>]*class="list"[^>]*>/)).toContain('aria-multiselectable="true"')
    expect(getTag(html, /<input[^>]*class="input"[^>]*>/)).toContain('value=""')
    let chip = getTag(html, /<span[^>]*class="chip chip-apple"[^>]*>/)
    expect(chip).toContain('tabindex="-1"')
    expect(getTag(html, /<button[^>]*class="remove"[^>]*>/)).toContain('type="button"')
    expect(html).toContain('class="chip chip-cherry"')
    let hidden = html.match(/<input[^>]*type="hidden"[^>]*>/g) ?? []
    expect(hidden.length).toBe(2)
    expect(hidden[0]).toContain('name="fruits"')
    expect(hidden[0]).toContain('value="apple"')
    expect(hidden[1]).toContain('value="cherry"')
  })

  it('renders disabled, readOnly, and required state', async () => {
    let html = await renderCombobox({ disabled: true, readOnly: true, required: true, name: 'f' })
    let input = getTag(html, /<input[^>]*class="input"[^>]*>/)
    expect(input).toMatch(/\sdisabled(=""|\s|>)/)
    expect(input).toMatch(/\sreadonly(=""|\s|>)/)
    expect(input).toContain('aria-required="true"')
    expect(input).toContain('data-disabled=""')
    expect(input).toContain('data-readonly=""')
    expect(input).toContain('data-required=""')
    expect(getTag(html, /<button[^>]*class="trigger"[^>]*>/)).toMatch(/\sdisabled(=""|\s|>)/)
    expect(getTag(html, /<input[^>]*name="f"[^>]*>/)).toMatch(/\srequired(=""|\s|>)/)
  })
})
