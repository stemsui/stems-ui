// Adapted from @remix-run/ui 0.13.0 (packages/ui/src/menu.test.tsx, context menu cases).
// https://github.com/remix-run/remix - Copyright (c) 2025 Shopify Inc. MIT License.

import { expect } from 'remix/assert'
import { describe, it } from 'remix/test'
import type { Handle } from 'remix/component'
import { render } from 'remix/component/test'

import * as contextMenu from './context-menu.ts'
import { ContextMenuChangeEvent } from './context-menu.ts'

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
  [data-test-area] { position: fixed; top: 70px; left: 80px; width: 200px; height: 40px; }
  [data-test-area="2"] { top: 200px; }
  [role="menu"] { margin: 0; padding: 0; border: 0; width: 160px; height: 96px; }
  [role="menu"] [role="menu"] { height: 48px; }
  [role^="menuitem"] { display: block; height: 24px; }
`

function isShown(element: HTMLElement) {
  return element.matches(':popover-open')
}

function rightClick(target: Element, x: number, y: number) {
  let event = new PointerEvent('contextmenu', {
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
    button: 2,
    pointerType: 'mouse',
  })
  target.dispatchEvent(event)
  return event
}

function key(target: Element | null, value: string, init: KeyboardEventInit = {}) {
  let event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: value, ...init })
  ;(target ?? document.body).dispatchEvent(event)
  return event
}

function touch(target: Element, type: string, x = 120, y = 90) {
  target.dispatchEvent(
    new PointerEvent(type, { bubbles: true, pointerType: 'touch', clientX: x, clientY: y }),
  )
}

type HarnessProps = contextMenu.ContextMenuContextProps & { noArgs?: boolean; second?: boolean }

function Harness(handle: Handle<HarnessProps>) {
  return () => {
    let { noArgs, second, children: _children, ...props } = handle.props
    return (
      <div>
        <button id="before">Before</button>
        <contextMenu.Context {...props}>
          <div id="area" data-test-area tabIndex={0} mix={contextMenu.trigger()}>
            File.txt
          </div>
          <div id="popup" mix={noArgs ? contextMenu.popup() : contextMenu.popup({})}>
            <div id="rename" mix={contextMenu.item({ value: 'rename' })}>
              Rename
            </div>
            <div id="delete" mix={contextMenu.item({ value: 'delete' })}>
              Delete
            </div>
            <contextMenu.SubmenuContext>
              <div id="share" mix={contextMenu.submenuTrigger()}>
                Share
              </div>
              <div id="subpopup" mix={contextMenu.popup()}>
                <div id="email" mix={contextMenu.item({ value: 'email' })}>
                  Email
                </div>
              </div>
            </contextMenu.SubmenuContext>
          </div>
        </contextMenu.Context>
        {second ? (
          <contextMenu.Context>
            <div id="area2" data-test-area="2" mix={contextMenu.trigger()}>
              Other.txt
            </div>
            <div id="popup2" mix={contextMenu.popup()}>
              <div mix={contextMenu.item()}>Copy</div>
            </div>
          </contextMenu.Context>
        ) : null}
        <button id="outside">Outside</button>
      </div>
    )
  }
}

function setup(t: T, props: HarnessProps = {}) {
  addStyle(t, BASE_CSS)
  let result = render(<Harness {...props} />)
  t.after(result.cleanup)
  let get = (id: string) => result.$(`#${id}`) as HTMLElement
  return { ...result, area: get('area'), popup: get('popup'), get }
}

describe('context menu', () => {
  it('renders the trigger area without button semantics', (t) => {
    let { area, popup } = setup(t)
    expect(area.getAttribute('role')).toBe(null)
    expect(area.getAttribute('aria-haspopup')).toBe(null)
    expect(area.hasAttribute('data-popup-open')).toBe(false)
    expect(popup.getAttribute('role')).toBe('menu')
    expect(popup.getAttribute('data-side')).toBe('bottom')
    expect(popup.getAttribute('data-align')).toBe('start')
  })

  it('opens at the pointer on right click', async (t) => {
    let reasons: string[] = []
    let { act, area, popup } = setup(t, { onOpenChange: (_o, d) => reasons.push(d.reason) })
    let event = rightClick(area, 220, 140)
    await act(() => {})
    expect(event.defaultPrevented).toBe(true)
    expect(reasons).toEqual(['trigger-press'])
    expect(isShown(popup)).toBe(true)
    expect(popup.style.left).toBe('220px')
    expect(popup.style.top).toBe('140px')
    expect(area.getAttribute('data-popup-open')).toBe('')
    expect(area.getAttribute('data-pressed')).toBe('')
    expect(document.activeElement).toBe(popup)
    // Non-modal by default.
    expect(document.documentElement.style.overflow).toBe('')
  })

  it('repositions when right-clicked again', async (t) => {
    let { act, area, popup } = setup(t)
    rightClick(area, 220, 140)
    await act(() => {})
    // A right press focuses the (focusable) area before the contextmenu event.
    area.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, button: 2, pointerType: 'mouse' }),
    )
    area.focus()
    rightClick(area, 260, 180)
    await act(() => {})
    await act(() => {})
    expect(isShown(popup)).toBe(true)
    expect(document.activeElement).toBe(popup)
    expect(popup.style.left).toBe('260px')
    expect(popup.style.top).toBe('180px')
  })

  it('opens from Shift+F10 / ContextMenu at the area with the first item focused', async (t) => {
    let { act, area, popup, get } = setup(t)
    area.focus()
    let event = key(area, 'F10', { shiftKey: true })
    await act(() => {})
    expect(event.defaultPrevented).toBe(true)
    expect(isShown(popup)).toBe(true)
    expect(popup.style.left).toBe('80px')
    expect(popup.style.top).toBe('110px')
    expect(document.activeElement).toBe(get('rename'))

    key(document.activeElement, 'Escape')
    await act(() => {})
    expect(document.activeElement).toBe(area)

    key(area, 'ContextMenu')
    await act(() => {})
    expect(isShown(popup)).toBe(true)
  })

  it('opens on a touch long press, and a moving touch cancels it', async (t) => {
    let { act, area, popup } = setup(t)
    touch(area, 'pointerdown')
    touch(area, 'pointermove', 140, 110)
    await sleep(600)
    await act(() => {})
    expect(isShown(popup)).toBe(false)

    touch(area, 'pointerdown', 120, 90)
    await sleep(600)
    await act(() => {})
    expect(isShown(popup)).toBe(true)
    expect(popup.style.left).toBe('120px')
    expect(popup.style.top).toBe('90px')

    // Lifting the finger cancels the compatibility mouse events and click, so focus stays in
    // the menu and the release isn't an outside press.
    touch(area, 'pointerup')
    let release = new TouchEvent('touchend', { bubbles: true, cancelable: true })
    area.dispatchEvent(release)
    expect(release.defaultPrevented).toBe(true)
    await act(() => {})
    expect(isShown(popup)).toBe(true)

    // A later touchend (a normal tap) is left alone.
    let tap = new TouchEvent('touchend', { bubbles: true, cancelable: true })
    area.dispatchEvent(tap)
    expect(tap.defaultPrevented).toBe(false)
  })

  it('returns focus to the previously focused element on Escape', async (t) => {
    let { act, area, popup, get } = setup(t)
    get('before').focus()
    rightClick(area, 220, 140)
    await act(() => {})
    expect(document.activeElement).toBe(popup)
    key(popup, 'Escape')
    await act(() => {})
    expect(document.activeElement).toBe(get('before'))
  })

  it('activates items and closes', async (t) => {
    let values: unknown[] = []
    let { act, area, popup, get, container } = setup(t)
    container.addEventListener('stems:menu-select', (event) => values.push(event.value))
    rightClick(area, 220, 140)
    await act(() => {})
    await act(() => get('delete').click())
    expect(values).toEqual(['delete'])
    expect(area.hasAttribute('data-popup-open')).toBe(false)
    await waitFor(() => !isShown(popup))
  })

  it('supports submenus', async (t) => {
    let { act, area, get } = setup(t)
    area.focus()
    key(area, 'ContextMenu')
    await act(() => {})
    key(document.activeElement, 'End')
    await act(() => {})
    expect(document.activeElement).toBe(get('share'))
    key(document.activeElement, 'ArrowRight')
    await act(() => {})
    expect(isShown(get('subpopup'))).toBe(true)
    expect(get('subpopup').getAttribute('data-side')).toBe('inline-end')
    expect(document.activeElement).toBe(get('email'))
  })

  it('prevents the native context menu inside the popup', async (t) => {
    let { act, area, get } = setup(t)
    rightClick(area, 220, 140)
    await act(() => {})
    expect(rightClick(get('rename'), 230, 150).defaultPrevented).toBe(true)
  })

  it('closes other open context menus when one opens', async (t) => {
    let { act, area, popup, get } = setup(t, { second: true })
    rightClick(area, 220, 140)
    await act(() => {})
    rightClick(get('area2'), 220, 220)
    await act(() => {})
    expect(area.hasAttribute('data-popup-open')).toBe(false)
    expect(isShown(get('popup2'))).toBe(true)
    await waitFor(() => !isShown(popup))
  })

  it('dispatches stems:context-menu-change and works with no-argument popup()', async (t) => {
    let events: Array<[boolean, string]> = []
    let { act, area, container } = setup(t, { noArgs: true })
    container.addEventListener('stems:context-menu-change', (event) => {
      expect(event).toBeInstanceOf(ContextMenuChangeEvent)
      events.push([event.open, event.reason])
    })
    rightClick(area, 220, 140)
    await act(() => {})
    key(document.activeElement, 'Escape')
    await act(() => {})
    expect(events).toEqual([
      [true, 'trigger-press'],
      [false, 'escape-key'],
    ])
  })

  it('ignores right clicks when disabled', async (t) => {
    let { act, area, popup } = setup(t, { disabled: true })
    let event = rightClick(area, 220, 140)
    await act(() => {})
    expect(event.defaultPrevented).toBe(false)
    expect(isShown(popup)).toBe(false)
  })
})
