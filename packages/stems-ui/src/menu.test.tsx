import { expect } from 'remix/assert'
import { describe, it } from 'remix/test'
import { renderToString } from 'remix/component/server'

import * as menu from './menu.ts'
import * as contextMenu from './context-menu.ts'

function renderMenu(props: menu.MenuContextProps = {}, noArgs = false) {
  return renderToString(
    <menu.Context {...props}>
      <button class="trigger" mix={noArgs ? menu.trigger() : menu.trigger({ disabled: false })}>
        Open
      </button>
      <div mix={menu.backdrop()} class="backdrop" />
      <div class="popup" mix={noArgs ? menu.popup() : menu.popup({ side: 'top', align: 'end' })}>
        <span class="arrow" mix={menu.arrow()} />
        <div class="item" mix={noArgs ? menu.item() : menu.item({ disabled: true })}>
          Item
        </div>
        <a class="link" href="/x" mix={menu.linkItem()}>
          Link
        </a>
        <div class="sep" mix={menu.separator()} />
        <menu.CheckboxItemContext defaultChecked>
          <div class="checkbox" mix={menu.checkboxItem()}>
            <span class="checkbox-indicator" mix={menu.checkboxItemIndicator()} />
            Check
          </div>
        </menu.CheckboxItemContext>
        <menu.RadioGroupContext defaultValue="b">
          <div class="radio-group" mix={menu.radioGroup()}>
            <div class="group-label" id="radio-label" mix={menu.groupLabel()}>
              Radio
            </div>
            <menu.RadioItemContext value="a">
              <div class="radio-a" mix={menu.radioItem()}>
                <span class="radio-a-indicator" mix={menu.radioItemIndicator()} />A
              </div>
            </menu.RadioItemContext>
            <menu.RadioItemContext value="b">
              <div class="radio-b" mix={menu.radioItem()}>
                <span class="radio-b-indicator" mix={menu.radioItemIndicator()} />B
              </div>
            </menu.RadioItemContext>
          </div>
        </menu.RadioGroupContext>
        <div class="group" mix={menu.group()} />
        <menu.SubmenuContext>
          <div class="sub-trigger" mix={menu.submenuTrigger()}>
            More
          </div>
          <div class="sub-popup" mix={menu.popup()}>
            <div mix={menu.item()}>Nested</div>
          </div>
        </menu.SubmenuContext>
      </div>
    </menu.Context>,
  )
}

function getTag(html: string, pattern: RegExp) {
  let match = html.match(pattern)
  expect(match).not.toBe(null)
  return match![0]
}

describe('menu (server render)', () => {
  it('renders a closed menu with correct state attributes', async () => {
    let html = await renderMenu()

    let trigger = getTag(html, /<button[^>]*class="trigger"[^>]*>/)
    expect(trigger).toContain('type="button"')
    expect(trigger).toContain('aria-haspopup="menu"')
    expect(trigger).toContain('aria-expanded="false"')
    expect(trigger).not.toContain('data-popup-open')
    let triggerId = trigger.match(/\sid="([^"]+)"/)?.[1]
    expect(triggerId).toBeTruthy()

    let popup = getTag(html, /<div[^>]*class="popup"[^>]*>/)
    expect(popup).toContain('role="menu"')
    expect(popup).toContain('popover="manual"')
    expect(popup).toMatch(/\shidden(=""|\s|>)/)
    expect(popup).toContain('data-closed=""')
    expect(popup).toContain('data-side="top"')
    expect(popup).toContain('data-align="end"')
    expect(popup).toContain(`aria-labelledby="${triggerId}"`)
    let popupId = popup.match(/\sid="([^"]+)"/)?.[1]
    expect(trigger).toContain(`aria-controls="${popupId}"`)

    let item = getTag(html, /<div[^>]*class="item"[^>]*>/)
    expect(item).toContain('role="menuitem"')
    expect(item).toContain('tabindex="-1"')
    expect(item).toContain('aria-disabled="true"')
    expect(item).toContain('data-disabled=""')
    expect(item).not.toContain('data-highlighted')

    expect(getTag(html, /<a[^>]*class="link"[^>]*>/)).toContain('role="menuitem"')
    expect(getTag(html, /<div[^>]*class="sep"[^>]*>/)).toContain('role="separator"')

    let checkbox = getTag(html, /<div[^>]*class="checkbox"[^>]*>/)
    expect(checkbox).toContain('role="menuitemcheckbox"')
    expect(checkbox).toContain('aria-checked="true"')
    expect(checkbox).toContain('data-checked=""')
    let checkboxIndicator = getTag(html, /<span[^>]*class="checkbox-indicator"[^>]*>/)
    expect(checkboxIndicator).toContain('data-checked=""')
    expect(checkboxIndicator).not.toMatch(/\shidden(=""|\s|>)/)

    let radioA = getTag(html, /<div[^>]*class="radio-a"[^>]*>/)
    expect(radioA).toContain('role="menuitemradio"')
    expect(radioA).toContain('aria-checked="false"')
    expect(radioA).toContain('data-unchecked=""')
    expect(getTag(html, /<span[^>]*class="radio-a-indicator"[^>]*>/)).toMatch(/\shidden(=""|\s|>)/)
    expect(getTag(html, /<div[^>]*class="radio-b"[^>]*>/)).toContain('aria-checked="true"')
    expect(getTag(html, /<div[^>]*class="radio-group"[^>]*>/)).toContain('role="group"')
    expect(getTag(html, /<div[^>]*class="group-label"[^>]*>/)).toContain('id="radio-label"')
    expect(getTag(html, /<div[^>]*class="group"[^>]*>/)).toContain('role="group"')

    let subTrigger = getTag(html, /<div[^>]*class="sub-trigger"[^>]*>/)
    expect(subTrigger).toContain('role="menuitem"')
    expect(subTrigger).toContain('aria-haspopup="menu"')
    expect(subTrigger).toContain('aria-expanded="false"')
    let subPopup = getTag(html, /<div[^>]*class="sub-popup"[^>]*>/)
    expect(subPopup).toContain('data-side="inline-end"')
    expect(subPopup).toContain('data-align="start"')

    let backdrop = getTag(html, /<div[^>]*class="backdrop"[^>]*>/)
    expect(backdrop).toContain('data-closed=""')
    expect(getTag(html, /<span[^>]*class="arrow"[^>]*>/)).toContain('aria-hidden="true"')
  })

  it('renders open state with defaultOpen', async () => {
    let html = await renderMenu({ defaultOpen: true })
    let trigger = getTag(html, /<button[^>]*class="trigger"[^>]*>/)
    expect(trigger).toContain('aria-expanded="true"')
    expect(trigger).toContain('data-popup-open=""')
    expect(trigger).toContain('data-pressed=""')
    let popup = getTag(html, /<div[^>]*class="popup"[^>]*>/)
    expect(popup).toContain('data-open=""')
    expect(popup).not.toMatch(/\shidden(=""|\s|>)/)
  })

  it('supports no-argument mixin calls', async () => {
    let html = await renderMenu({}, true)
    expect(getTag(html, /<button[^>]*class="trigger"[^>]*>/)).toContain('aria-haspopup="menu"')
    let popup = getTag(html, /<div[^>]*class="popup"[^>]*>/)
    expect(popup).toContain('role="menu"')
    expect(popup).toContain('data-side="bottom"')
    expect(popup).toContain('data-align="center"')
    expect(getTag(html, /<div[^>]*class="item"[^>]*>/)).not.toContain('aria-disabled')
  })

  it('renders a context menu', async () => {
    let html = await renderToString(
      <contextMenu.Context>
        <div class="area" mix={contextMenu.trigger()}>
          Area
        </div>
        <div class="popup" mix={contextMenu.popup()}>
          <div mix={contextMenu.item()}>Item</div>
        </div>
      </contextMenu.Context>,
    )
    let area = getTag(html, /<div[^>]*class="area"[^>]*>/)
    expect(area).not.toContain('data-popup-open')
    expect(area).not.toContain('aria-haspopup')
    let popup = getTag(html, /<div[^>]*class="popup"[^>]*>/)
    expect(popup).toContain('role="menu"')
    expect(popup).toContain('data-side="bottom"')
    expect(popup).toContain('data-align="start"')
  })
})
