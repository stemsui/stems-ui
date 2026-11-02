// Adapted from @remix-run/ui 0.13.0 (packages/ui/src/menu.test.tsx).
// https://github.com/remix-run/remix - Copyright (c) 2025 Shopify Inc. MIT License.

import { expect } from 'remix/assert'
import { describe, it } from 'remix/test'
import type { Handle } from 'remix/component'
import { render } from 'remix/component/test'

import * as menu from './menu.ts'
import { MenuSelectEvent, onMenuChange, onMenuSelect } from './menu.ts'
import type { MenuOpenChangeDetails } from './menu.ts'

type T = { after(fn: () => void): void }

function nextFrame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
}

async function waitFor(condition: () => boolean, timeout = 1000) {
  let start = performance.now()
  while (!condition()) {
    if (performance.now() - start > timeout) throw new Error('waitFor timed out')
    await nextFrame()
  }
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

function addStyle(t: T, css: string) {
  let style = document.createElement('style')
  style.textContent = css
  document.head.append(style)
  t.after(() => style.remove())
}

const BASE_CSS = `
  [data-test-trigger] { position: fixed; top: 40px; left: 100px; width: 80px; height: 30px;
    margin: 0; padding: 0; border: 0; box-sizing: border-box; }
  [role="menu"] { margin: 0; padding: 0; border: 0; width: 160px; }
  [role^="menuitem"] { display: block; height: 24px; }
`

function isShown(element: HTMLElement) {
  return element.matches(':popover-open')
}

function key(target: Element | null, value: string, init: KeyboardEventInit = {}) {
  let event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: value, ...init })
  ;(target ?? document.body).dispatchEvent(event)
  return event
}

function keyboardClick(target: Element) {
  target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 0 }))
}

/** A pointer click (`detail: 1`); `element.click()` reports `detail: 0`, like the keyboard. */
function mouseClick(target: Element) {
  pointer(target, 'pointerdown')
  pointer(target, 'pointerup')
  target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }))
}

function pointer(target: Element, type: string, init: PointerEventInit = {}) {
  target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: type !== 'pointerenter' && type !== 'pointerleave',
      pointerType: 'mouse',
      ...init,
    }),
  )
}

function hover(target: Element) {
  pointer(target, 'pointerenter')
  pointer(target, 'pointermove')
}

type HarnessProps = menu.MenuContextProps & {
  triggerOptions?: menu.MenuTriggerOptions
  popupOptions?: menu.MenuPopupOptions
  noArgs?: boolean
  itemCloseOnClick?: boolean
  checked?: boolean
  onCheckedChange?: menu.CheckboxItemContextProps['onCheckedChange']
  radioValue?: string
  onRadioChange?: menu.RadioGroupContextProps['onValueChange']
  submenu?: Partial<menu.SubmenuContextProps>
  submenuTriggerOptions?: menu.SubmenuTriggerOptions
  dir?: 'ltr' | 'rtl'
}

function Harness(handle: Handle<HarnessProps>) {
  return () => {
    let {
      triggerOptions,
      popupOptions,
      noArgs,
      itemCloseOnClick,
      checked,
      onCheckedChange,
      radioValue,
      onRadioChange,
      submenu,
      submenuTriggerOptions,
      dir,
      children: _children,
      ...props
    } = handle.props
    return (
      <div dir={dir}>
        <button id="before">Before</button>
        <menu.Context {...props}>
          <button
            id="trigger"
            data-test-trigger
            mix={noArgs ? menu.trigger() : menu.trigger(triggerOptions)}
          >
            View
          </button>
          <div id="popup" mix={noArgs ? menu.popup() : menu.popup(popupOptions)}>
            <div
              id="new"
              mix={
                noArgs ? menu.item() : menu.item({ value: 'new', closeOnClick: itemCloseOnClick })
              }
            >
              New file
            </div>
            <div id="open" mix={menu.item({ value: 'open' })}>
              Open
            </div>
            <div id="minimap" mix={menu.item({ disabled: true })}>
              Minimap
            </div>
            <div id="sep" mix={menu.separator()} />
            <menu.CheckboxItemContext
              checked={checked}
              defaultChecked={checked === undefined ? true : undefined}
              onCheckedChange={onCheckedChange}
            >
              <div
                id="wrap"
                mix={noArgs ? menu.checkboxItem() : menu.checkboxItem({ value: 'wrap' })}
              >
                <span id="wrap-indicator" mix={menu.checkboxItemIndicator()}>
                  ✓
                </span>
                Word wrap
              </div>
            </menu.CheckboxItemContext>
            <menu.RadioGroupContext
              value={radioValue}
              defaultValue={radioValue === undefined ? 'date' : undefined}
              onValueChange={onRadioChange}
            >
              <div id="sort" mix={menu.radioGroup()}>
                <div id="sort-label" mix={menu.groupLabel()}>
                  Sort
                </div>
                <menu.RadioItemContext value="date">
                  <div id="date" mix={menu.radioItem()}>
                    <span id="date-indicator" mix={menu.radioItemIndicator()}>
                      •
                    </span>
                    Date
                  </div>
                </menu.RadioItemContext>
                <menu.RadioItemContext value="name">
                  <div id="name" mix={menu.radioItem()}>
                    <span id="name-indicator" mix={menu.radioItemIndicator()}>
                      •
                    </span>
                    Name
                  </div>
                </menu.RadioItemContext>
              </div>
            </menu.RadioGroupContext>
            <menu.SubmenuContext {...submenu}>
              <div
                id="zoom"
                mix={noArgs ? menu.submenuTrigger() : menu.submenuTrigger(submenuTriggerOptions)}
              >
                Zoom
              </div>
              <div id="subpopup" mix={menu.popup()}>
                <div id="zoom-in" mix={menu.item({ value: 'zoom-in' })}>
                  Zoom in
                </div>
                <div id="zoom-out" mix={menu.item({ value: 'zoom-out' })}>
                  Zoom out
                </div>
              </div>
            </menu.SubmenuContext>
            <div mix={menu.group()} id="links">
              <div id="links-label" mix={menu.groupLabel()}>
                Links
              </div>
              <a id="docs" href="#docs" mix={menu.linkItem()}>
                Docs
              </a>
            </div>
          </div>
        </menu.Context>
        <button id="after">After</button>
        <div id="outside-area">Outside area</div>
      </div>
    )
  }
}

function setup(t: T, props: HarnessProps = {}) {
  addStyle(t, BASE_CSS)
  let result = render(<Harness {...props} />)
  t.after(result.cleanup)
  let get = (id: string) => result.$(`#${id}`) as HTMLElement
  return {
    ...result,
    trigger: get('trigger') as HTMLButtonElement,
    popup: get('popup'),
    subpopup: get('subpopup'),
    get,
  }
}

async function openWithKeyboard(
  act: (fn: () => unknown) => Promise<unknown>,
  trigger: HTMLElement,
  arrow = 'ArrowDown',
) {
  trigger.focus()
  await act(() => key(trigger, arrow))
  await act(() => {})
}

describe('menu', () => {
  it('renders ARIA and closed state', (t) => {
    let { trigger, popup, get } = setup(t)

    expect(trigger.getAttribute('type')).toBe('button')
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu')
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(trigger.getAttribute('aria-controls')).toBe(popup.id)
    expect(trigger.hasAttribute('data-popup-open')).toBe(false)
    expect(trigger.hasAttribute('data-pressed')).toBe(false)

    expect(popup.getAttribute('role')).toBe('menu')
    expect(popup.getAttribute('popover')).toBe('manual')
    expect(popup.getAttribute('aria-labelledby')).toBe(trigger.id)
    expect(popup.hasAttribute('hidden')).toBe(true)
    expect(popup.getAttribute('data-closed')).toBe('')
    expect(popup.getAttribute('data-side')).toBe('bottom')
    expect(popup.getAttribute('data-align')).toBe('center')

    expect(get('new').getAttribute('role')).toBe('menuitem')
    expect(get('new').getAttribute('tabindex')).toBe('-1')
    expect(get('minimap').getAttribute('aria-disabled')).toBe('true')
    expect(get('minimap').getAttribute('data-disabled')).toBe('')
    expect(get('sep').getAttribute('role')).toBe('separator')

    let wrap = get('wrap')
    expect(wrap.getAttribute('role')).toBe('menuitemcheckbox')
    expect(wrap.getAttribute('aria-checked')).toBe('true')
    expect(wrap.getAttribute('data-checked')).toBe('')
    expect(get('wrap-indicator').getAttribute('aria-hidden')).toBe('true')
    expect(get('wrap-indicator').hasAttribute('hidden')).toBe(false)

    expect(get('date').getAttribute('role')).toBe('menuitemradio')
    expect(get('date').getAttribute('aria-checked')).toBe('true')
    expect(get('name').getAttribute('aria-checked')).toBe('false')
    expect(get('name').getAttribute('data-unchecked')).toBe('')
    expect(get('name-indicator').hasAttribute('hidden')).toBe(true)

    expect(get('sort').getAttribute('role')).toBe('group')
    expect(get('sort').getAttribute('aria-labelledby')).toBe(get('sort-label').id)
    expect(get('links').getAttribute('aria-labelledby')).toBe(get('links-label').id)

    let zoom = get('zoom')
    expect(zoom.getAttribute('role')).toBe('menuitem')
    expect(zoom.getAttribute('aria-haspopup')).toBe('menu')
    expect(zoom.getAttribute('aria-expanded')).toBe('false')
    expect(zoom.getAttribute('aria-controls')).toBe(get('subpopup').id)
    expect(get('subpopup').getAttribute('aria-labelledby')).toBe(zoom.id)
    expect(get('docs').getAttribute('role')).toBe('menuitem')
  })

  it('works with no-argument mixin calls', async (t) => {
    let { act, trigger, popup, get } = setup(t, { noArgs: true })
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu')
    expect(popup.getAttribute('role')).toBe('menu')
    expect(get('wrap').getAttribute('role')).toBe('menuitemcheckbox')

    await act(() => trigger.click())
    expect(isShown(popup)).toBe(true)
    await act(() => get('new').click())
    expect(trigger.getAttribute('aria-expanded')).toBe('false')

    await openWithKeyboard(act, trigger)
    key(get('new'), 'End')
    await act(() => {})
    expect(document.activeElement).toBe(get('docs'))
  })

  it('opens on click with focus on the popup, and toggles closed from the trigger', async (t) => {
    let { act, trigger, popup } = setup(t, { modal: false })

    await act(() => mouseClick(trigger))
    expect(isShown(popup)).toBe(true)
    expect(popup.getAttribute('data-open')).toBe('')
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(trigger.getAttribute('data-popup-open')).toBe('')
    expect(trigger.getAttribute('data-pressed')).toBe('')
    expect(document.activeElement).toBe(popup)
    expect(popup.querySelector('[data-highlighted]')).toBe(null)

    await act(() => trigger.click())
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(trigger)
    await waitFor(() => !isShown(popup))
  })

  it('is modal by default: locks scroll and makes outside content inert', async (t) => {
    let { act, trigger, popup, get } = setup(t)
    await act(() => trigger.click())
    expect(document.documentElement.style.overflow).toBe('hidden')
    expect(get('after').closest('[inert]')).not.toBe(null)
    expect(popup.closest('[inert]')).toBe(null)

    key(popup, 'Escape')
    await act(() => {})
    expect(document.documentElement.style.overflow).toBe('')
    expect(get('after').closest('[inert]')).toBe(null)
    expect(document.activeElement).toBe(trigger)
  })

  it('opens from ArrowDown / Enter with the first item focused and from ArrowUp on the last', async (t) => {
    let { act, trigger, popup, get } = setup(t)

    await openWithKeyboard(act, trigger)
    expect(document.activeElement).toBe(get('new'))
    expect(get('new').getAttribute('data-highlighted')).toBe('')

    key(document.activeElement, 'Escape')
    await act(() => {})
    await waitFor(() => !isShown(popup))

    await openWithKeyboard(act, trigger, 'ArrowUp')
    expect(document.activeElement).toBe(get('docs'))

    key(document.activeElement, 'Escape')
    await act(() => {})

    // Enter / Space on a button fire a click with detail 0.
    await act(() => keyboardClick(trigger))
    expect(document.activeElement).toBe(get('new'))
  })

  it('navigates with arrows, skips disabled items, loops, and supports Home / End', async (t) => {
    let { act, trigger, get } = setup(t)
    await openWithKeyboard(act, trigger)

    key(document.activeElement, 'ArrowDown')
    await act(() => {})
    expect(document.activeElement).toBe(get('open'))
    key(document.activeElement, 'ArrowDown')
    await act(() => {})
    // Minimap is disabled; the separator and group label are not items.
    expect(document.activeElement).toBe(get('wrap'))
    expect(get('open').hasAttribute('data-highlighted')).toBe(false)
    expect(get('wrap').getAttribute('data-highlighted')).toBe('')

    key(document.activeElement, 'End')
    await act(() => {})
    expect(document.activeElement).toBe(get('docs'))

    // loopFocus defaults to true.
    key(document.activeElement, 'ArrowDown')
    await act(() => {})
    expect(document.activeElement).toBe(get('new'))
    key(document.activeElement, 'ArrowUp')
    await act(() => {})
    expect(document.activeElement).toBe(get('docs'))

    key(document.activeElement, 'Home')
    await act(() => {})
    expect(document.activeElement).toBe(get('new'))
  })

  it('stops at the ends with loopFocus false', async (t) => {
    let { act, trigger, get } = setup(t, { loopFocus: false })
    await openWithKeyboard(act, trigger)
    key(document.activeElement, 'ArrowUp')
    await act(() => {})
    expect(document.activeElement).toBe(get('new'))
    key(document.activeElement, 'End')
    await act(() => {})
    key(document.activeElement, 'ArrowDown')
    await act(() => {})
    expect(document.activeElement).toBe(get('docs'))
  })

  it('uses Left / Right with orientation horizontal (mirrored in RTL)', async (t) => {
    let { act, trigger, popup, get } = setup(t, { orientation: 'horizontal' })
    expect(popup.getAttribute('aria-orientation')).toBe('horizontal')
    await act(() => keyboardClick(trigger))
    expect(document.activeElement).toBe(get('new'))
    key(document.activeElement, 'ArrowDown')
    await act(() => {})
    expect(document.activeElement).toBe(get('new'))
    key(document.activeElement, 'ArrowRight')
    await act(() => {})
    expect(document.activeElement).toBe(get('open'))
    key(document.activeElement, 'ArrowLeft')
    await act(() => {})
    expect(document.activeElement).toBe(get('new'))
  })

  it('moves to the matching item with typeahead', async (t) => {
    let { act, trigger, get } = setup(t)
    await openWithKeyboard(act, trigger)
    key(document.activeElement, 'z')
    await act(() => {})
    expect(document.activeElement).toBe(get('zoom'))
    // Disabled items are skipped by typeahead.
    key(document.activeElement, 'm')
    await act(() => {})
    expect(document.activeElement).toBe(get('zoom'))
    await sleep(800)
    key(document.activeElement, 'o')
    await act(() => {})
    expect(document.activeElement).toBe(get('open'))
    key(document.activeElement, 'n')
    await act(() => {})
    expect(document.activeElement).toBe(get('open'))
  })

  it('highlights on pointer move and clears the highlight when the pointer leaves for a non-item', async (t) => {
    let { act, trigger, popup, get } = setup(t)
    await act(() => trigger.click())

    pointer(get('open'), 'pointermove')
    await act(() => {})
    expect(get('open').getAttribute('data-highlighted')).toBe('')
    expect(document.activeElement).toBe(get('open'))

    pointer(get('open'), 'pointerleave', { relatedTarget: get('new') })
    await act(() => {})
    expect(get('open').getAttribute('data-highlighted')).toBe('')

    pointer(get('open'), 'pointerleave', { relatedTarget: get('sep') })
    await act(() => {})
    expect(get('open').hasAttribute('data-highlighted')).toBe(false)
    expect(document.activeElement).toBe(popup)

    // Disabled items don't highlight.
    pointer(get('minimap'), 'pointermove')
    await act(() => {})
    expect(get('minimap').hasAttribute('data-highlighted')).toBe(false)
  })

  it('keeps a keyboard highlight when a resting pointer leaves the item', async (t) => {
    let { act, trigger, get } = setup(t)
    await openWithKeyboard(act, trigger)
    expect(document.activeElement).toBe(get('new'))
    // e.g. the popup moved out from under the pointer while positioning.
    pointer(get('new'), 'pointerleave', { relatedTarget: document.body })
    await act(() => {})
    expect(get('new').getAttribute('data-highlighted')).toBe('')
    expect(document.activeElement).toBe(get('new'))
  })

  it('does not highlight on hover with highlightItemOnHover false', async (t) => {
    let { act, trigger, get } = setup(t, { highlightItemOnHover: false })
    await act(() => trigger.click())
    pointer(get('open'), 'pointermove')
    await act(() => {})
    expect(get('open').hasAttribute('data-highlighted')).toBe(false)
  })

  it('reports highlight changes with onItemHighlighted', async (t) => {
    let calls: Array<[string | undefined, string, string | undefined]> = []
    let { act, trigger } = setup(t, {
      onItemHighlighted: (item, details) => calls.push([item?.id, details.reason, details.label]),
    })
    await openWithKeyboard(act, trigger)
    key(document.activeElement, 'ArrowDown')
    await act(() => {})
    expect(calls).toEqual([
      ['new', 'keyboard', 'New file'],
      ['open', 'keyboard', 'Open'],
    ])
  })

  it('activates an item on click: dispatches stems:menu-select and closes the menu', async (t) => {
    let selections: MenuSelectEvent[] = []
    let reasons: string[] = []
    let { act, trigger, popup, get, container } = setup(t, {
      onOpenChange: (_open, d) => reasons.push(d.reason),
    })
    container.addEventListener('stems:menu-select', (event) => selections.push(event))

    await act(() => trigger.click())
    await act(() => get('open').click())
    expect(selections).toHaveLength(1)
    expect(selections[0]).toBeInstanceOf(MenuSelectEvent)
    expect(selections[0].item).toBe(get('open'))
    expect(selections[0].kind).toBe('item')
    expect(selections[0].label).toBe('Open')
    expect(selections[0].value).toBe('open')
    expect(selections[0].closeOnClick).toBe(true)
    expect(reasons).toEqual(['trigger-press', 'item-press'])
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(trigger)
    await waitFor(() => !isShown(popup))
  })

  it('activates the highlighted item with Enter and Space', async (t) => {
    let values: unknown[] = []
    let { act, trigger, get, container } = setup(t)
    container.addEventListener('stems:menu-select', (event) => values.push(event.value))

    await openWithKeyboard(act, trigger)
    key(document.activeElement, 'Enter')
    await act(() => {})
    expect(values).toEqual(['new'])
    expect(trigger.getAttribute('aria-expanded')).toBe('false')

    await openWithKeyboard(act, trigger)
    key(document.activeElement, 'ArrowDown')
    await act(() => {})
    key(document.activeElement, ' ')
    await act(() => {})
    expect(values).toEqual(['new', 'open'])
    expect(get('open').isConnected).toBe(true)
  })

  it('ignores clicks on disabled items', async (t) => {
    let selections: unknown[] = []
    let { act, trigger, get, container } = setup(t)
    container.addEventListener('stems:menu-select', (event) => selections.push(event))
    await act(() => trigger.click())
    await act(() => get('minimap').click())
    expect(selections).toEqual([])
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
  })

  it('keeps the menu open with closeOnClick false', async (t) => {
    let { act, trigger, get } = setup(t, { itemCloseOnClick: false })
    await act(() => trigger.click())
    await act(() => get('new').click())
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
  })

  it('keeps the menu open when the select event is canceled', async (t) => {
    let { act, trigger, get, container } = setup(t)
    container.addEventListener('stems:menu-select', (event) => event.preventDefault())
    await act(() => trigger.click())
    await act(() => get('open').click())
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
  })

  it('toggles an uncontrolled checkbox item and stays open (closeOnClick false)', async (t) => {
    let changes: boolean[] = []
    let selections: Array<boolean | undefined> = []
    let { act, trigger, get, container } = setup(t, {
      onCheckedChange: (checked) => changes.push(checked),
    })
    container.addEventListener('stems:menu-select', (event) => selections.push(event.checked))
    await act(() => trigger.click())

    let wrap = get('wrap')
    await act(() => wrap.click())
    expect(changes).toEqual([false])
    expect(selections).toEqual([false])
    expect(wrap.getAttribute('aria-checked')).toBe('false')
    expect(wrap.getAttribute('data-unchecked')).toBe('')
    expect(wrap.hasAttribute('data-checked')).toBe(false)
    let indicator = get('wrap-indicator')
    expect(indicator.getAttribute('data-unchecked')).toBe('')
    await waitFor(() => indicator.hasAttribute('hidden'))
    expect(trigger.getAttribute('aria-expanded')).toBe('true')

    await act(() => wrap.click())
    expect(wrap.getAttribute('aria-checked')).toBe('true')
    expect(get('wrap-indicator').hasAttribute('hidden')).toBe(false)
  })

  it('leaves a controlled checkbox item to its owner', async (t) => {
    let changes: boolean[] = []
    let { act, trigger, get } = setup(t, {
      checked: false,
      onCheckedChange: (checked) => changes.push(checked),
    })
    await act(() => trigger.click())
    await act(() => get('wrap').click())
    expect(changes).toEqual([true])
    expect(get('wrap').getAttribute('aria-checked')).toBe('false')
  })

  it('selects radio items in an uncontrolled group', async (t) => {
    let changes: unknown[] = []
    let selections: Array<[unknown, boolean | undefined]> = []
    let { act, trigger, get, container } = setup(t, {
      onRadioChange: (value) => changes.push(value),
    })
    container.addEventListener('stems:menu-select', (event) =>
      selections.push([event.value, event.checked]),
    )
    await act(() => trigger.click())
    await act(() => get('name').click())
    expect(changes).toEqual(['name'])
    expect(selections).toEqual([['name', true]])
    expect(get('name').getAttribute('aria-checked')).toBe('true')
    expect(get('date').getAttribute('aria-checked')).toBe('false')
    expect(get('name-indicator').hasAttribute('hidden')).toBe(false)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')

    // Selecting the current value again doesn't report a change.
    await act(() => get('name').click())
    expect(changes).toEqual(['name'])
  })

  it('leaves a controlled radio group to its owner', async (t) => {
    let changes: unknown[] = []
    let { act, trigger, get } = setup(t, {
      radioValue: 'date',
      onRadioChange: (value) => changes.push(value),
    })
    await act(() => trigger.click())
    await act(() => get('name').click())
    expect(changes).toEqual(['name'])
    expect(get('date').getAttribute('aria-checked')).toBe('true')
  })

  it('treats a link item as a menuitem that stays open by default', async (t) => {
    let selections: MenuSelectEvent[] = []
    let { act, trigger, get, container } = setup(t)
    container.addEventListener('stems:menu-select', (event) => {
      selections.push(event)
    })
    await act(() => trigger.click())
    await act(() => get('docs').click())
    expect(selections[0].kind).toBe('link-item')
    expect(selections[0].value).toBe('#docs')
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    location.hash = ''
  })

  it('closes on Escape and on outside press', async (t) => {
    let reasons: string[] = []
    let { act, trigger, get } = setup(t, {
      modal: false,
      onOpenChange: (_open, d) => reasons.push(d.reason),
    })
    await openWithKeyboard(act, trigger)
    key(document.activeElement, 'Escape')
    await act(() => {})
    expect(document.activeElement).toBe(trigger)

    await act(() => trigger.click())
    await act(() => get('outside-area').click())
    expect(reasons).toEqual(['trigger-press', 'escape-key', 'trigger-press', 'outside-press'])
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
  })

  it('closes on Tab and moves focus past the trigger', async (t) => {
    let reasons: string[] = []
    let { act, trigger, get } = setup(t, { onOpenChange: (_open, d) => reasons.push(d.reason) })
    await openWithKeyboard(act, trigger)
    let event = key(document.activeElement, 'Tab')
    await act(() => {})
    await act(() => {})
    expect(event.defaultPrevented).toBe(true)
    expect(reasons).toEqual(['trigger-press', 'focus-out'])
    await waitFor(() => document.activeElement === get('after'))

    await openWithKeyboard(act, trigger)
    key(document.activeElement, 'Tab', { shiftKey: true })
    await act(() => {})
    await waitFor(() => document.activeElement === trigger)
  })

  it('dispatches stems:menu-change from the trigger', async (t) => {
    let events: Array<[boolean, string]> = []
    function App() {
      return () => (
        <div
          mix={onMenuChange((event) => {
            events.push([event.open, event.reason])
          })}
        >
          <menu.Context modal={false}>
            <button id="t" mix={menu.trigger()}>
              Open
            </button>
            <div mix={menu.popup()}>
              <div
                mix={[
                  menu.item(),
                  onMenuSelect(() => {
                    events.push([false, 'select'])
                  }),
                ]}
              >
                One
              </div>
            </div>
          </menu.Context>
        </div>
      )
    }
    let result = render(<App />)
    t.after(result.cleanup)
    let button = result.$('#t') as HTMLElement
    await result.act(() => button.click())
    await result.act(() => (result.$('[role="menuitem"]') as HTMLElement).click())
    expect(events).toEqual([
      [true, 'trigger-press'],
      [false, 'select'],
      [false, 'item-press'],
    ])
  })

  describe('controlled', () => {
    function setupControlled(t: T, accept = true) {
      addStyle(t, BASE_CSS)
      let state = { open: false }
      let changes: Array<{ open: boolean; details: MenuOpenChangeDetails }> = []
      let owner: Handle | undefined
      function App(handle: Handle) {
        owner = handle
        return () => (
          <Harness
            open={state.open}
            onOpenChange={(open, details) => {
              changes.push({ open, details })
              if (accept) {
                state.open = open
                void handle.update()
              }
            }}
          />
        )
      }
      let result = render(<App />)
      t.after(result.cleanup)
      return {
        ...result,
        trigger: result.$('#trigger') as HTMLButtonElement,
        popup: result.$('#popup') as HTMLElement,
        get: (id: string) => result.$(`#${id}`) as HTMLElement,
        changes,
        async setOpen(open: boolean) {
          state.open = open
          await result.act(() => owner!.update())
        },
      }
    }

    it('follows the open prop and reports requests', async (t) => {
      let { act, trigger, popup, get, changes, setOpen } = setupControlled(t, false)
      await act(() => trigger.click())
      expect(changes.map((c) => [c.open, c.details.reason])).toEqual([[true, 'trigger-press']])
      expect(isShown(popup)).toBe(false)

      await setOpen(true)
      expect(isShown(popup)).toBe(true)
      expect(trigger.getAttribute('aria-expanded')).toBe('true')

      await act(() => get('open').click())
      expect(changes.at(-1)!.details.reason).toBe('item-press')
      expect(trigger.getAttribute('aria-expanded')).toBe('true')

      await setOpen(false)
      await waitFor(() => !isShown(popup))
    })

    it('can veto with details.cancel()', async (t) => {
      let { act, trigger, popup } = setup(t, {
        onOpenChange: (_open, details) => details.cancel(),
      })
      await act(() => trigger.click())
      expect(isShown(popup)).toBe(false)
      expect(trigger.getAttribute('aria-expanded')).toBe('false')
    })

    it('opens initially with defaultOpen', async (t) => {
      let { trigger, popup } = setup(t, { defaultOpen: true })
      expect(trigger.getAttribute('aria-expanded')).toBe('true')
      await waitFor(() => isShown(popup))
    })

    it('ignores the trigger when disabled', async (t) => {
      let { act, trigger, popup } = setup(t, { disabled: true })
      expect(trigger.disabled).toBe(true)
      expect(trigger.getAttribute('data-disabled')).toBe('')
      await act(() => trigger.click())
      expect(isShown(popup)).toBe(false)
    })
  })

  describe('trigger hover', () => {
    it('opens on hover after the delay, non-modally', async (t) => {
      let reasons: string[] = []
      let { act, trigger, popup } = setup(t, {
        triggerOptions: { openOnHover: true, delay: 20 },
        onOpenChange: (_open, d) => reasons.push(d.reason),
      })
      pointer(trigger, 'pointerenter')
      await sleep(40)
      await act(() => {})
      expect(reasons).toEqual(['trigger-hover'])
      expect(isShown(popup)).toBe(true)
      expect(document.documentElement.style.overflow).toBe('')
    })
  })

  describe('submenus', () => {
    it('opens with ArrowRight focusing the first item and closes with ArrowLeft', async (t) => {
      let { act, trigger, subpopup, get } = setup(t)
      await openWithKeyboard(act, trigger)
      key(document.activeElement, 'z')
      await act(() => {})
      let zoom = get('zoom')
      expect(document.activeElement).toBe(zoom)

      key(zoom, 'ArrowRight')
      await act(() => {})
      expect(isShown(subpopup)).toBe(true)
      expect(zoom.getAttribute('aria-expanded')).toBe('true')
      expect(zoom.getAttribute('data-popup-open')).toBe('')
      expect(subpopup.getAttribute('data-side')).toBe('inline-end')
      expect(subpopup.getAttribute('data-align')).toBe('start')
      expect(document.activeElement).toBe(get('zoom-in'))

      key(document.activeElement, 'ArrowDown')
      await act(() => {})
      expect(document.activeElement).toBe(get('zoom-out'))
      // Keys inside the submenu don't move the parent's highlight.
      expect(zoom.getAttribute('data-highlighted')).toBe('')

      key(document.activeElement, 'ArrowLeft')
      await act(() => {})
      expect(zoom.getAttribute('aria-expanded')).toBe('false')
      expect(document.activeElement).toBe(zoom)
      expect(zoom.getAttribute('data-highlighted')).toBe('')
      await waitFor(() => !isShown(subpopup))
    })

    it('mirrors the submenu keys in RTL', async (t) => {
      let { act, trigger, subpopup, get } = setup(t, { dir: 'rtl' })
      await openWithKeyboard(act, trigger)
      key(document.activeElement, 'z')
      await act(() => {})
      key(document.activeElement, 'ArrowRight')
      await act(() => {})
      expect(isShown(subpopup)).toBe(false)
      key(document.activeElement, 'ArrowLeft')
      await act(() => {})
      expect(isShown(subpopup)).toBe(true)
      expect(document.activeElement).toBe(get('zoom-in'))
      key(document.activeElement, 'ArrowRight')
      await act(() => {})
      expect(document.activeElement).toBe(get('zoom'))
    })

    it('opens with Enter on the trigger', async (t) => {
      let { act, trigger, subpopup, get } = setup(t)
      await openWithKeyboard(act, trigger)
      key(document.activeElement, 'z')
      await act(() => {})
      key(document.activeElement, 'Enter')
      await act(() => {})
      expect(isShown(subpopup)).toBe(true)
      expect(document.activeElement).toBe(get('zoom-in'))
    })

    it('opens on click without moving focus', async (t) => {
      let { act, trigger, subpopup, get } = setup(t)
      await act(() => mouseClick(trigger))
      await act(() => mouseClick(get('zoom')))
      expect(isShown(subpopup)).toBe(true)
      expect(document.activeElement).toBe(get('zoom'))
      expect(get('zoom').getAttribute('data-highlighted')).toBe('')
      // Clicking again keeps it open.
      await act(() => mouseClick(get('zoom')))
      expect(isShown(subpopup)).toBe(true)
    })

    it('Escape closes only the submenu', async (t) => {
      let { act, trigger, popup, subpopup, get } = setup(t)
      await openWithKeyboard(act, trigger)
      key(document.activeElement, 'z')
      await act(() => {})
      key(document.activeElement, 'ArrowRight')
      await act(() => {})
      key(document.activeElement, 'Escape')
      await act(() => {})
      expect(get('zoom').getAttribute('aria-expanded')).toBe('false')
      expect(trigger.getAttribute('aria-expanded')).toBe('true')
      expect(isShown(popup)).toBe(true)
      expect(document.activeElement).toBe(get('zoom'))
      await waitFor(() => !isShown(subpopup))

      key(document.activeElement, 'Escape')
      await act(() => {})
      expect(trigger.getAttribute('aria-expanded')).toBe('false')
      expect(document.activeElement).toBe(trigger)
    })

    it('Escape closes the whole tree with closeParentOnEsc', async (t) => {
      let { act, trigger, get } = setup(t, { submenu: { closeParentOnEsc: true } })
      await openWithKeyboard(act, trigger)
      key(document.activeElement, 'z')
      await act(() => {})
      key(document.activeElement, 'ArrowRight')
      await act(() => {})
      key(document.activeElement, 'Escape')
      await act(() => {})
      expect(get('zoom').getAttribute('aria-expanded')).toBe('false')
      expect(trigger.getAttribute('aria-expanded')).toBe('false')
      expect(document.activeElement).toBe(trigger)
    })

    it('activating a submenu item dispatches one select event and closes the whole tree', async (t) => {
      let selections: unknown[] = []
      let { act, trigger, popup, subpopup, get, container } = setup(t)
      container.addEventListener('stems:menu-select', (event) => selections.push(event.value))
      await openWithKeyboard(act, trigger)
      key(document.activeElement, 'z')
      await act(() => {})
      key(document.activeElement, 'ArrowRight')
      await act(() => {})
      key(document.activeElement, 'Enter')
      await act(() => {})
      expect(selections).toEqual(['zoom-in'])
      expect(get('zoom').getAttribute('aria-expanded')).toBe('false')
      expect(trigger.getAttribute('aria-expanded')).toBe('false')
      expect(document.activeElement).toBe(trigger)
      await waitFor(() => !isShown(popup) && !isShown(subpopup))
    })

    it('opens on hover after the delay and keeps focus in the parent', async (t) => {
      let reasons: string[] = []
      let { act, trigger, subpopup, get } = setup(t, {
        submenu: { onOpenChange: (_open, d) => reasons.push(d.reason) },
        submenuTriggerOptions: { delay: 20 },
      })
      await act(() => trigger.click())
      hover(get('zoom'))
      await act(() => {})
      expect(get('zoom').getAttribute('data-highlighted')).toBe('')
      await sleep(50)
      await act(() => {})
      expect(reasons).toEqual(['trigger-hover'])
      expect(isShown(subpopup)).toBe(true)
      expect(document.activeElement).toBe(get('zoom'))
    })

    it('does not open on hover with openOnHover false', async (t) => {
      let { act, trigger, subpopup, get } = setup(t, {
        submenuTriggerOptions: { openOnHover: false, delay: 10 },
      })
      await act(() => trigger.click())
      hover(get('zoom'))
      await sleep(40)
      await act(() => {})
      expect(isShown(subpopup)).toBe(false)
    })

    it('closes when another parent item is highlighted', async (t) => {
      let { act, trigger, subpopup, get } = setup(t)
      await act(() => trigger.click())
      await act(() => get('zoom').click())
      expect(isShown(subpopup)).toBe(true)
      pointer(get('zoom'), 'pointerleave', { relatedTarget: get('open') })
      pointer(get('open'), 'pointermove')
      await act(() => {})
      expect(get('zoom').getAttribute('aria-expanded')).toBe('false')
      expect(get('open').getAttribute('data-highlighted')).toBe('')
    })

    it('keeps the trigger highlighted while the pointer moves into the submenu', async (t) => {
      let { act, trigger, subpopup, get } = setup(t)
      await act(() => mouseClick(trigger))
      await act(() => mouseClick(get('zoom')))
      pointer(get('zoom'), 'pointerleave', { relatedTarget: subpopup })
      await act(() => {})
      expect(get('zoom').getAttribute('data-highlighted')).toBe('')
      pointer(get('zoom-out'), 'pointermove')
      await act(() => {})
      expect(document.activeElement).toBe(get('zoom-out'))
      expect(get('zoom-out').getAttribute('data-highlighted')).toBe('')
      expect(get('zoom').getAttribute('data-highlighted')).toBe('')
      expect(isShown(subpopup)).toBe(true)
    })

    it('an outside press closes the tree; a press in the parent closes only the submenu', async (t) => {
      let { act, trigger, popup, subpopup, get } = setup(t, { modal: false })
      await act(() => trigger.click())
      await act(() => get('zoom').click())
      expect(isShown(subpopup)).toBe(true)

      await act(() => get('sort-label').click())
      expect(get('zoom').getAttribute('aria-expanded')).toBe('false')
      expect(trigger.getAttribute('aria-expanded')).toBe('true')

      await act(() => get('zoom').click())
      await act(() => get('outside-area').click())
      expect(get('zoom').getAttribute('aria-expanded')).toBe('false')
      expect(trigger.getAttribute('aria-expanded')).toBe('false')
      await waitFor(() => !isShown(popup) && !isShown(subpopup))
    })

    it('closes with its parent', async (t) => {
      let { act, trigger, subpopup, get } = setup(t, { modal: false })
      await act(() => trigger.click())
      await act(() => get('zoom').click())
      await act(() => trigger.click())
      expect(get('zoom').getAttribute('aria-expanded')).toBe('false')
      await waitFor(() => !isShown(subpopup))
    })
  })
})

describe('menu detached triggers', () => {
  const DETACHED_CSS = `
    .detached { position: fixed; top: 40px; width: 80px; height: 30px; margin: 0; padding: 0;
      border: 0; box-sizing: border-box; }
    #m1 { left: 20px; } #m2 { left: 300px; }
    [role="menu"] { margin: 0; padding: 0; border: 0; width: 160px; }
    [role^="menuitem"] { display: block; height: 24px; }
  `

  function setupDetached(t: T, props: menu.MenuContextProps<string> = {}) {
    addStyle(t, DETACHED_CSS)
    let h = menu.createHandle<string>()
    let selected: string[] = []
    let result = render(
      <div>
        <button id="m1" class="detached" mix={menu.trigger({ handle: h, payload: 'row-1' })}>
          Row 1
        </button>
        <button id="m2" class="detached" mix={menu.trigger({ handle: h, payload: 'row-2' })}>
          Row 2
        </button>
        <menu.Context handle={h} {...props}>
          {({ payload }) => (
            <div id="popup" mix={menu.popup()}>
              <div
                id="edit"
                mix={[menu.item(), onMenuSelect(() => void selected.push(`edit:${payload}`))]}
              >
                Edit {payload}
              </div>
              <div id="delete" mix={menu.item()}>
                Delete
              </div>
            </div>
          )}
        </menu.Context>
        <button id="outside">Outside</button>
      </div>,
    )
    t.after(result.cleanup)
    let get = (id: string) => result.$(`#${id}`) as HTMLElement
    return { ...result, h, get, m1: get('m1'), m2: get('m2'), selected }
  }

  it('wires menu ARIA to the detached triggers', async (t) => {
    let { m1, get, act } = setupDetached(t)
    await act(() => {})
    expect(m1.getAttribute('aria-haspopup')).toBe('menu')
    expect(m1.getAttribute('aria-expanded')).toBe('false')
    expect(m1.getAttribute('aria-controls')).toBe(get('popup').id)
    expect(m1.id).toBe('m1')
  })

  it('opens from the pressed trigger, anchors to it and passes its payload', async (t) => {
    let { m1, m2, get, act, selected } = setupDetached(t)
    await act(() => mouseClick(m2))
    let popup = get('popup')
    expect(isShown(popup)).toBe(true)
    expect(m2.getAttribute('aria-expanded')).toBe('true')
    expect(m2.hasAttribute('data-pressed')).toBe(true)
    expect(m1.getAttribute('aria-expanded')).toBe('false')
    expect(popup.getAttribute('aria-labelledby')).toBe('m2')
    expect(get('edit').textContent).toBe('Edit row-2')
    await waitFor(() => Math.round(popup.getBoundingClientRect().left) === 260)
    expect(Math.round(popup.getBoundingClientRect().top)).toBe(70)

    await act(() => get('edit').click())
    expect(selected).toEqual(['edit:row-2'])
    await waitFor(() => !isShown(popup))
    expect(m2.getAttribute('aria-expanded')).toBe('false')
    expect(m2.hasAttribute('data-pressed')).toBe(false)

    await act(() => mouseClick(m1))
    expect(get('edit').textContent).toBe('Edit row-1')
    await waitFor(() => Math.round(popup.getBoundingClientRect().left) === 5)
  })

  it('opens with ArrowDown from a detached trigger and returns focus on Escape', async (t) => {
    let { m1, get, act } = setupDetached(t)
    m1.focus()
    await act(() => key(m1, 'ArrowDown'))
    await act(() => {})
    expect(isShown(get('popup'))).toBe(true)
    expect(document.activeElement).toBe(get('edit'))
    key(document.activeElement, 'Escape')
    await act(() => {})
    expect(document.activeElement).toBe(m1)
    expect(m1.getAttribute('aria-expanded')).toBe('false')
  })

  it('opens and closes with the handle', async (t) => {
    let { h, m2, get, act } = setupDetached(t)
    await act(() => h.open('m2'))
    await act(() => {})
    expect(h.isOpen).toBe(true)
    expect(isShown(get('popup'))).toBe(true)
    expect(m2.getAttribute('aria-expanded')).toBe('true')
    expect(get('edit').textContent).toBe('Edit row-2')
    await act(() => h.close())
    expect(h.isOpen).toBe(false)
  })
})

describe('menu filtering', () => {
  type FilterHarnessProps = menu.MenuFilterProviderProps & {
    noArgs?: boolean
    onSelect?: (value: unknown) => void
  }

  function FilterHarness(handle: Handle<FilterHarnessProps>) {
    return () => {
      let { noArgs, onSelect, children: _children, ...filterProps } = handle.props
      return (
        <div mix={onMenuSelect((event) => onSelect?.(event.value))}>
          <menu.FilterProvider {...filterProps}>
            <menu.Context modal={false}>
              <button id="trigger" data-test-trigger mix={menu.trigger()}>
                Actions
              </button>
              <div id="popup" mix={menu.popup()}>
                <input id="input" aria-label="Filter actions" mix={menu.input()} />
                <button id="clear" mix={noArgs ? menu.clear() : menu.clear({})}>
                  Clear
                </button>
                <div id="empty" mix={menu.empty()}>
                  <menu.EmptyText>No results.</menu.EmptyText>
                </div>
                <div id="list" mix={menu.list()}>
                  <div id="files" mix={menu.group()}>
                    <div id="label" mix={menu.groupLabel()}>
                      Files
                    </div>
                    <div id="rename" mix={menu.item({ value: 'rename' })}>
                      Rename
                    </div>
                    <div id="resume" mix={menu.item({ value: 'resume', label: 'Résumé export' })}>
                      Export
                    </div>
                    <div id="delete" mix={menu.item({ value: 'delete', disabled: true })}>
                      Delete
                    </div>
                  </div>
                  <div id="share" mix={menu.item({ value: 'share' })}>
                    Share
                  </div>
                  <menu.SubmenuContext>
                    <div id="move" mix={menu.submenuTrigger()}>
                      Move to
                    </div>
                    <div id="subpopup" mix={menu.popup()}>
                      <div id="inbox" mix={menu.item({ value: 'inbox' })}>
                        Inbox
                      </div>
                    </div>
                  </menu.SubmenuContext>
                </div>
              </div>
            </menu.Context>
          </menu.FilterProvider>
        </div>
      )
    }
  }

  function setupFilter(t: T, props: FilterHarnessProps = {}) {
    addStyle(t, BASE_CSS)
    let result = render(<FilterHarness {...props} />)
    t.after(result.cleanup)
    let get = (id: string) => document.getElementById(id) as HTMLElement
    return {
      ...result,
      get,
      trigger: get('trigger'),
      popup: get('popup'),
      input: get('input') as HTMLInputElement,
    }
  }

  function type(input: HTMLInputElement, value: string) {
    input.value = value
    input.dispatchEvent(new Event('input', { bubbles: true }))
  }

  it('renders dialog / searchbox / menu ARIA', async (t) => {
    let { trigger, popup, input, get } = setupFilter(t, { noArgs: true })
    let list = get('list')
    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog')
    expect(popup.getAttribute('role')).toBe('dialog')
    expect(list.getAttribute('role')).toBe('menu')
    // The host id wins over the default `${popup.id}-list`.
    expect(list.id).toBe('list')
    expect(list.getAttribute('aria-labelledby')).toBe('trigger')
    expect(input.getAttribute('role')).toBe('searchbox')
    expect(input.getAttribute('aria-controls')).toBe(list.id)
    expect(input.getAttribute('autocomplete')).toBe('off')
    expect(get('clear').hidden).toBe(true)
    expect(get('clear').getAttribute('aria-hidden')).toBe('true')
    expect(get('clear').tabIndex).toBe(-1)
    let empty = get('empty')
    expect(empty.getAttribute('role')).toBe('status')
    expect(empty.getAttribute('aria-live')).toBe('polite')
    expect(empty.hasAttribute('data-empty')).toBe(false)
    expect(empty.textContent).toBe('')
  })

  it('focuses the input on a click open and filters items as you type', async (t) => {
    let changes: Array<[string, string]> = []
    let events: string[] = []
    function App() {
      return () => (
        <div mix={menu.onMenuFilterChange((event) => void events.push(event.value))}>
          <FilterHarness
            onValueChange={(value, details) => changes.push([value, details.reason])}
          />
        </div>
      )
    }
    addStyle(t, BASE_CSS)
    let result = render(<App />)
    t.after(result.cleanup)
    let get = (id: string) => document.getElementById(id) as HTMLElement
    let input = get('input') as HTMLInputElement

    await result.act(() => mouseClick(get('trigger')))
    expect(isShown(get('popup'))).toBe(true)
    await waitFor(() => document.activeElement === input)
    await waitFor(() => input.hasAttribute('data-highlighted'))

    await result.act(() => type(input, 're'))
    expect(changes).toEqual([['re', 'input-change']])
    expect(events).toEqual(['re'])
    // "Rename", "Résumé export" (its label, ignoring accents) and "Share" match.
    expect(get('rename').hidden).toBe(false)
    expect(get('resume').hidden).toBe(false)
    expect(get('delete').hidden).toBe(true)
    expect(get('share').hidden).toBe(false)
    expect(get('move').hidden).toBe(true)
    expect(get('files').hidden).toBe(false)
    expect(get('clear').hidden).toBe(false)
    // The unfiltered submenu keeps its items.
    expect(get('inbox').hidden).toBe(false)

    await result.act(() => type(input, 'SHA'))
    expect(get('files').hidden).toBe(true)
    expect(get('share').hidden).toBe(false)

    await result.act(() => type(input, ''))
    expect(changes.at(-1)).toEqual(['', 'input-clear'])
    expect(get('delete').hidden).toBe(false)
    expect(get('files').hidden).toBe(false)
  })

  it('moves a virtual highlight with the arrow keys and activates it with Enter', async (t) => {
    let selected: unknown[] = []
    let { act, trigger, popup, input, get } = setupFilter(t, {
      onSelect: (value) => selected.push(value),
    })

    await act(() => mouseClick(trigger))
    await waitFor(() => document.activeElement === input)
    await act(() => type(input, 'e'))
    // Rename, Résumé export, Delete (disabled), Share, Move to all contain "e".
    await act(() => key(input, 'ArrowDown'))
    expect(get('rename').getAttribute('data-highlighted')).toBe('')
    expect(document.activeElement).toBe(input)
    expect(input.getAttribute('aria-activedescendant')).toBe('rename')
    expect(input.hasAttribute('data-highlighted')).toBe(false)

    await act(() => key(input, 'ArrowDown'))
    expect(input.getAttribute('aria-activedescendant')).toBe('resume')
    await act(() => key(input, 'ArrowDown'))
    // Skips the disabled item.
    expect(input.getAttribute('aria-activedescendant')).toBe('share')
    await act(() => key(input, 'ArrowUp'))
    expect(input.getAttribute('aria-activedescendant')).toBe('resume')
    expect(document.activeElement).toBe(input)

    // Characters edit the input: no typeahead.
    let typed = key(input, 's')
    expect(typed.defaultPrevented).toBe(false)
    expect(input.getAttribute('aria-activedescendant')).toBe('resume')

    await act(() => key(input, 'Enter'))
    expect(selected).toEqual(['resume'])
    expect(popup.getAttribute('data-closed')).toBe('')
  })

  it('opens from the keyboard with the input focused and the first item highlighted', async (t) => {
    let { act, trigger, input, get } = setupFilter(t)
    await act(() => key(trigger, 'ArrowDown'))
    await waitFor(() => document.activeElement === input)
    expect(get('rename').getAttribute('data-highlighted')).toBe('')
    expect(input.getAttribute('aria-activedescendant')).toBe('rename')
  })

  it('opens a highlighted submenu with ArrowRight and keeps the caret keys otherwise', async (t) => {
    let { act, trigger, input, get } = setupFilter(t)
    await act(() => mouseClick(trigger))
    await waitFor(() => document.activeElement === input)
    await act(() => type(input, 'mo'))
    let left = key(input, 'ArrowLeft')
    expect(left.defaultPrevented).toBe(false)
    await act(() => key(input, 'ArrowDown'))
    expect(input.getAttribute('aria-activedescendant')).toBe('move')
    await act(() => key(input, 'ArrowRight'))
    await waitFor(() => isShown(get('subpopup')))
    await waitFor(() => document.activeElement === get('inbox'))
  })

  it('shows the empty state and clears the query', async (t) => {
    let changes: Array<[string, string]> = []
    let { act, trigger, input, get } = setupFilter(t, {
      onValueChange: (value, details) => changes.push([value, details.reason]),
    })
    await act(() => mouseClick(trigger))
    await waitFor(() => document.activeElement === input)

    await act(() => type(input, 'zzz'))
    let empty = get('empty')
    expect(empty.getAttribute('data-empty')).toBe('')
    await waitFor(() => empty.textContent === 'No results.')

    let clear = get('clear')
    let down = new MouseEvent('mousedown', { bubbles: true, cancelable: true })
    clear.dispatchEvent(down)
    expect(down.defaultPrevented).toBe(true)
    await act(() => clear.click())
    expect(changes.at(-1)).toEqual(['', 'clear-press'])
    expect(input.value).toBe('')
    expect(document.activeElement).toBe(input)
    expect(empty.hasAttribute('data-empty')).toBe(false)
    await waitFor(() => empty.textContent === '')
    expect(clear.hidden).toBe(true)
  })

  it('resets the query after closing unless cancelled', async (t) => {
    let changes: Array<[string, string]> = []
    let keep = false
    let { act, trigger, input, get } = setupFilter(t, {
      onValueChange: (value, details) => {
        changes.push([value, details.reason])
        if (keep && details.reason === 'popup-close') details.cancel()
      },
    })
    await act(() => mouseClick(trigger))
    await waitFor(() => document.activeElement === input)
    await act(() => type(input, 'sh'))
    await act(() => key(input, 'Escape'))
    await waitFor(() => changes.at(-1)?.[1] === 'popup-close')
    expect(changes.at(-1)).toEqual(['', 'popup-close'])
    await waitFor(() => input.value === '')
    expect(get('rename').hidden).toBe(false)

    keep = true
    await act(() => mouseClick(trigger))
    await waitFor(() => document.activeElement === input)
    await act(() => type(input, 'sh'))
    await act(() => key(input, 'Escape'))
    await waitFor(() => changes.filter(([, reason]) => reason === 'popup-close').length === 2)
    expect(input.value).toBe('sh')
    expect(get('rename').hidden).toBe(true)
  })

  it('auto-highlights the first match', async (t) => {
    let { act, trigger, input, get } = setupFilter(t, { autoHighlight: true })
    await act(() => mouseClick(trigger))
    await waitFor(() => document.activeElement === input)
    expect(get('popup').querySelector('[data-highlighted]:not(input)')).toBe(null)
    await act(() => type(input, 'sha'))
    await waitFor(() => input.getAttribute('aria-activedescendant') === 'share')
    // A highlight the filter hides is dropped.
    await act(() => type(input, 'ren'))
    await waitFor(() => input.getAttribute('aria-activedescendant') === 'rename')
    expect(get('share').hasAttribute('data-highlighted')).toBe(false)
  })

  it('supports a custom filter, external filtering, and a controlled query', async (t) => {
    let starts = setupFilter(t, {
      filter: (text, query) => text.toLowerCase().startsWith(query.toLowerCase()),
    })
    await starts.act(() => mouseClick(starts.trigger))
    await waitFor(() => document.activeElement === starts.input)
    await starts.act(() => type(starts.input, 'e'))
    expect(starts.get('rename').hidden).toBe(true)
    expect(starts.get('resume').hidden).toBe(true)
    await starts.act(() => type(starts.input, 'r'))
    expect(starts.get('rename').hidden).toBe(false)
    expect(starts.get('resume').hidden).toBe(false)
    starts.cleanup()

    let external = setupFilter(t, { filter: null, value: 'zzz' })
    expect(external.input.value).toBe('zzz')
    expect(external.get('rename').hidden).toBe(false)
    expect(external.get('clear').hidden).toBe(false)
    external.cleanup()

    let controlled = setupFilter(t, { value: 'sh', onValueChange: () => {} })
    await controlled.act(() => mouseClick(controlled.trigger))
    await waitFor(() => document.activeElement === controlled.input)
    expect(controlled.get('rename').hidden).toBe(true)
    // Not updated by the owner: the input shows the controlled value again.
    await controlled.act(() => type(controlled.input, 'shx'))
    expect(controlled.input.value).toBe('sh')
    expect(controlled.get('share').hidden).toBe(false)
  })
})
