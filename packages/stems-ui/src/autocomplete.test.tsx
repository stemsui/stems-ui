import { expect } from 'remix/assert'
import { describe, it } from 'remix/test'
import { renderToString } from 'remix/component/server'

import * as autocomplete from './autocomplete.tsx'

const TAGS = ['feature', 'fix', 'bug']

function renderAutocomplete(props: autocomplete.AutocompleteContextProps = {}, noArgs = false) {
  return renderToString(
    <autocomplete.Context items={TAGS} {...props}>
      <div class="group" mix={autocomplete.inputGroup()}>
        <input class="input" mix={autocomplete.input()} />
        <button class="clear" mix={noArgs ? autocomplete.clear() : autocomplete.clear({})} />
        <button class="trigger" mix={noArgs ? autocomplete.trigger() : autocomplete.trigger({})}>
          <span class="icon" mix={autocomplete.icon()} />
        </button>
      </div>
      <span class="value">
        <autocomplete.ValueText />
      </span>
      <div class="popup" mix={noArgs ? autocomplete.popup() : autocomplete.popup({})}>
        <div class="empty" mix={autocomplete.empty()}>
          <autocomplete.EmptyText>Nothing</autocomplete.EmptyText>
        </div>
        <div class="list" mix={autocomplete.list()}>
          <autocomplete.Collection>
            {(tag: string) => (
              <div class={`item item-${tag}`} mix={autocomplete.item({ value: tag })}>
                {tag}
              </div>
            )}
          </autocomplete.Collection>
        </div>
      </div>
    </autocomplete.Context>,
  )
}

function getTag(html: string, pattern: RegExp) {
  let match = html.match(pattern)
  expect(match).not.toBe(null)
  return match![0]
}

const HIDDEN = /\shidden(=""|\s|>)/

describe('autocomplete (server render)', () => {
  it('renders a closed autocomplete with ARIA', async () => {
    let html = await renderAutocomplete()
    let input = getTag(html, /<input[^>]*class="input"[^>]*>/)
    expect(input).toContain('role="combobox"')
    expect(input).toContain('aria-autocomplete="list"')
    expect(input).toContain('aria-expanded="false"')
    expect(input).toContain('value=""')
    expect(getTag(html, /<button[^>]*class="clear"[^>]*>/)).toMatch(HIDDEN)
    let popup = getTag(html, /<div[^>]*class="popup"[^>]*>/)
    expect(popup).toContain('popover="manual"')
    expect(popup).toMatch(HIDDEN)
    expect(html.match(/role="option"/g)?.length).toBe(3)
    expect(getTag(html, /<div[^>]*class="group"[^>]*>/)).not.toContain('data-placeholder')
  })

  it('works with no-argument mixin calls', async () => {
    let html = await renderAutocomplete({}, true)
    expect(getTag(html, /<button[^>]*class="trigger"[^>]*>/)).toContain('aria-haspopup="listbox"')
  })

  it('renders the text, the filtered items, and the form attributes', async () => {
    let html = await renderAutocomplete({
      defaultValue: 'fi',
      name: 'tag',
      required: true,
      mode: 'both',
    })
    let input = getTag(html, /<input[^>]*class="input"[^>]*>/)
    expect(input).toContain('value="fi"')
    expect(input).toContain('name="tag"')
    expect(input).toMatch(/\srequired(=""|\s|>)/)
    expect(input).toContain('aria-autocomplete="both"')
    expect(getTag(html, /<span[^>]*class="value"[^>]*>[^<]*/)).toContain('>fi')
    expect(html.match(/role="option"/g)?.length).toBe(1)
    expect(html).toContain('class="item item-fix"')
    expect(getTag(html, /<button[^>]*class="clear"[^>]*>/)).not.toMatch(HIDDEN)
  })

  it('does not filter in mode="none" and renders the empty state otherwise', async () => {
    let none = await renderAutocomplete({ defaultValue: 'zzz', mode: 'none' })
    expect(none.match(/role="option"/g)?.length).toBe(3)
    let list = await renderAutocomplete({ defaultValue: 'zzz' })
    expect(list).not.toContain('role="option"')
    expect(getTag(list, /<div[^>]*class="popup"[^>]*>/)).toContain('data-empty=""')
    expect(getTag(list, /<div[^>]*class="empty"[^>]*>[^<]*/)).toContain('Nothing')
  })
})
