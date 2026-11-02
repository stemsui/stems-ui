import { expect } from 'remix/assert'
import { describe, it } from 'remix/test'
import { createRoot, type Handle } from 'remix/component'
import { render } from 'remix/component/test'

import * as menu from './menu.ts'
import * as menubar from './menubar.ts'

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

function key(target: Element | null, value: string, init: KeyboardEventInit = {}) {
  let event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: value, ...init })
  ;(target ?? document.body).dispatchEvent(event)
  return event
}

/** Pointer events carry a position: menus only switch on hover when the pointer moved. */
function pointer(target: Element, type: string, at: { x: number; y: number } = { x: 1, y: 1 }) {
  target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: type !== 'pointerenter' && type !== 'pointerleave',
      pointerType: 'mouse',
      clientX: at.x,
      clientY: at.y,
    }),
  )
}

function mouseClick(target: Element, at?: { x: number; y: number }) {
  pointer(target, 'pointerdown', at)
  pointer(target, 'pointerup', at)
  target.dispatchEvent(
    new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      detail: 1,
      clientX: at?.x ?? 1,
      clientY: at?.y ?? 1,
    }),
  )
}

function active() {
  return document.activeElement as HTMLElement | null
}

function addStyle(t: T, css: string) {
  let style = document.createElement('style')
  style.textContent = css
  document.head.append(style)
  t.after(() => style.remove())
}

const CSS = `
  [role="menu"] { margin: 0; padding: 0; border: 0; width: 120px; }
  [role^="menuitem"] { display: block; height: 24px; }
`

function trigger(name: string) {
  return document.querySelector(`[data-trigger="${name}"]`) as HTMLElement
}

function popup(name: string) {
  return document.querySelector(`[data-popup="${name}"]`) as HTMLElement
}

function isOpen(name: string) {
  return popup(name).matches(':popover-open') && popup(name).hasAttribute('data-open')
}

interface FileEditViewProps {
  menubar?: menubar.MenubarContextProps
  dir?: 'ltr' | 'rtl'
  editDisabled?: boolean
  onOpenChange?: (name: string, open: boolean, reason: string) => void
}

function FileEditView(handle: Handle<FileEditViewProps>) {
  return () => {
    let props = handle.props
    let report = (name: string) => (open: boolean, details: menu.MenuOpenChangeDetails) =>
      props.onOpenChange?.(name, open, details.reason)
    return (
      <div dir={props.dir}>
        <menubar.Context {...props.menubar}>
          <div aria-label="App" mix={menubar.root()}>
            <menu.Context onOpenChange={report('file')}>
              <button data-trigger="file" mix={menu.trigger()}>
                File
              </button>
              <div data-popup="file" mix={menu.popup()}>
                <div data-item="new" mix={menu.item()}>
                  New
                </div>
                <menu.SubmenuContext>
                  <div data-item="share" mix={menu.submenuTrigger()}>
                    Share
                  </div>
                  <div data-popup="share" mix={menu.popup()}>
                    <div data-item="email" mix={menu.item()}>
                      Email
                    </div>
                  </div>
                </menu.SubmenuContext>
                <div data-item="close" mix={menu.item()}>
                  Close
                </div>
              </div>
            </menu.Context>
            <menu.Context disabled={props.editDisabled} onOpenChange={report('edit')}>
              <button data-trigger="edit" mix={menu.trigger()}>
                Edit
              </button>
              <div data-popup="edit" mix={menu.popup()}>
                <div data-item="undo" mix={menu.item()}>
                  Undo
                </div>
                <div data-item="redo" mix={menu.item()}>
                  Redo
                </div>
              </div>
            </menu.Context>
            <menu.Context onOpenChange={report('view')}>
              <button data-trigger="view" mix={menu.trigger()}>
                View
              </button>
              <div data-popup="view" mix={menu.popup()}>
                <div data-item="zoom" mix={menu.item()}>
                  Zoom
                </div>
              </div>
            </menu.Context>
          </div>
        </menubar.Context>
        <button data-outside>Outside</button>
      </div>
    )
  }
}

describe('menubar', () => {
  it('renders menubar semantics and a single tab stop across the triggers', (t) => {
    let { $, cleanup } = render(<FileEditView />)
    t.after(cleanup)

    let root = $('[role="menubar"]') as HTMLElement
    expect(root.getAttribute('aria-orientation')).toBe('horizontal')
    expect(root.getAttribute('data-orientation')).toBe('horizontal')
    expect(root.getAttribute('data-modal')).toBe('')
    expect(root.hasAttribute('data-has-submenu-open')).toBe(false)

    let file = trigger('file')
    expect(file.getAttribute('role')).toBe('menuitem')
    expect(file.getAttribute('aria-haspopup')).toBe('menu')
    expect(file.getAttribute('aria-expanded')).toBe('false')
    expect(['file', 'edit', 'view'].map((name) => trigger(name).getAttribute('tabindex'))).toEqual([
      '0',
      '-1',
      '-1',
    ])
  })

  it('moves between triggers with Left/Right (looping), Home, End, skipping disabled', async (t) => {
    let { act, cleanup } = render(<FileEditView editDisabled />)
    t.after(cleanup)

    expect((trigger('edit') as HTMLButtonElement).disabled).toBe(true)
    await act(() => trigger('file').focus())
    expect(key(trigger('file'), 'ArrowRight').defaultPrevented).toBe(true)
    expect(active()).toBe(trigger('view'))
    key(trigger('view'), 'ArrowRight')
    expect(active()).toBe(trigger('file'))
    key(trigger('file'), 'ArrowLeft')
    expect(active()).toBe(trigger('view'))
    key(trigger('view'), 'Home')
    expect(active()).toBe(trigger('file'))
    key(trigger('file'), 'End')
    expect(active()).toBe(trigger('view'))
    await act(() => {})
    expect(trigger('view').getAttribute('tabindex')).toBe('0')
    expect(trigger('file').getAttribute('tabindex')).toBe('-1')
    expect(isOpen('view')).toBe(false)
  })

  it('mirrors Left/Right in RTL', async (t) => {
    let { act, cleanup } = render(<FileEditView dir="rtl" />)
    t.after(cleanup)

    await act(() => trigger('file').focus())
    key(trigger('file'), 'ArrowLeft')
    expect(active()).toBe(trigger('edit'))
    key(trigger('edit'), 'ArrowRight')
    expect(active()).toBe(trigger('file'))
  })

  it('opens with ArrowDown / ArrowUp and moves to the adjacent menu with Left/Right', async (t) => {
    addStyle(t, CSS)
    let changes: string[] = []
    let { $, act, cleanup } = render(
      <FileEditView
        onOpenChange={(name, open, reason) => void changes.push(`${name}:${open}:${reason}`)}
      />,
    )
    t.after(cleanup)
    let root = $('[role="menubar"]') as HTMLElement

    await act(() => trigger('file').focus())
    await act(() => key(trigger('file'), 'ArrowDown'))
    await waitFor(() => active()?.dataset.item === 'new')
    expect(isOpen('file')).toBe(true)
    expect(root.hasAttribute('data-has-submenu-open')).toBe(true)

    await act(() => key(active(), 'ArrowRight'))
    await waitFor(() => active()?.dataset.item === 'undo')
    expect(isOpen('edit')).toBe(true)
    await waitFor(() => !isOpen('file'))
    expect(root.hasAttribute('data-has-submenu-open')).toBe(true)
    // The open menu's trigger is the tab stop.
    expect(trigger('edit').getAttribute('tabindex')).toBe('0')
    expect(trigger('file').getAttribute('tabindex')).toBe('-1')

    await act(() => key(active(), 'ArrowLeft'))
    await waitFor(() => active()?.dataset.item === 'new')
    await waitFor(() => !isOpen('edit'))

    // ArrowLeft from the first menu loops to the last.
    await act(() => key(active(), 'ArrowLeft'))
    await waitFor(() => active()?.dataset.item === 'zoom')

    expect(changes).toEqual([
      'file:true:trigger-press',
      'file:false:none',
      'edit:true:list-navigation',
      'edit:false:none',
      'file:true:list-navigation',
      'file:false:none',
      'view:true:list-navigation',
    ])

    // Escape closes the menu and returns focus to its trigger.
    await act(() => key(active(), 'Escape'))
    await waitFor(() => !isOpen('view'))
    expect(active()).toBe(trigger('view'))
    expect(root.hasAttribute('data-has-submenu-open')).toBe(false)

    await act(() => key(trigger('view'), 'ArrowUp'))
    await waitFor(() => active()?.dataset.item === 'zoom')
  })

  it('opens submenus with ArrowRight and switches menus from inside a submenu', async (t) => {
    addStyle(t, CSS)
    let { act, cleanup } = render(<FileEditView />)
    t.after(cleanup)

    await act(() => trigger('file').focus())
    await act(() => key(trigger('file'), 'ArrowDown'))
    await waitFor(() => active()?.dataset.item === 'new')
    await act(() => key(active(), 'ArrowDown'))
    expect(active()?.dataset.item).toBe('share')

    await act(() => key(active(), 'ArrowRight'))
    await waitFor(() => active()?.dataset.item === 'email')
    expect(isOpen('file')).toBe(true)

    // ArrowLeft closes only the submenu.
    await act(() => key(active(), 'ArrowLeft'))
    await waitFor(() => active()?.dataset.item === 'share')
    expect(isOpen('file')).toBe(true)

    await act(() => key(active(), 'ArrowRight'))
    await waitFor(() => active()?.dataset.item === 'email')
    // ArrowRight on an item without a submenu moves to the next menubar menu.
    await act(() => key(active(), 'ArrowRight'))
    await waitFor(() => active()?.dataset.item === 'undo')
    await waitFor(() => !isOpen('file') && !isOpen('share'))
  })

  it('moves to the adjacent menu with Left/Right from a pointer-opened menu', async (t) => {
    addStyle(t, CSS)
    let { act, cleanup } = render(<FileEditView />)
    t.after(cleanup)
    let at = { x: 10, y: 5 }

    // Opened with the pointer: focus is on the popup, nothing is highlighted.
    await act(() => mouseClick(trigger('file'), at))
    await waitFor(() => isOpen('file') && active() === popup('file'))

    await act(() => key(active(), 'ArrowRight'))
    // The browser sends boundary events to the trigger under the resting pointer when the
    // layout changes. They must not switch back to that trigger's menu.
    await act(() => pointer(trigger('file'), 'pointerenter', at))
    await waitFor(() => active()?.dataset.item === 'undo')
    await waitFor(() => !isOpen('file'))
    expect(isOpen('edit')).toBe(true)
    expect(trigger('file').getAttribute('aria-expanded')).toBe('false')

    // ArrowLeft mirrors it, also from a pointer-opened menu.
    await act(() => key(active(), 'Escape'))
    await waitFor(() => !isOpen('edit'))
    await act(() => mouseClick(trigger('edit'), at))
    await waitFor(() => isOpen('edit') && active() === popup('edit'))
    await act(() => key(active(), 'ArrowLeft'))
    await act(() => pointer(trigger('edit'), 'pointerenter', at))
    await waitFor(() => active()?.dataset.item === 'new')
    await waitFor(() => !isOpen('edit'))
    expect(isOpen('file')).toBe(true)
  })

  it('moves between pointer-opened menus with RTL-mirrored arrows', async (t) => {
    addStyle(t, CSS)
    let { act, cleanup } = render(<FileEditView dir="rtl" />)
    t.after(cleanup)

    await act(() => mouseClick(trigger('file')))
    await waitFor(() => isOpen('file') && active() === popup('file'))
    await act(() => key(active(), 'ArrowLeft'))
    await waitFor(() => active()?.dataset.item === 'undo')
    await waitFor(() => !isOpen('file'))
    await act(() => key(active(), 'ArrowRight'))
    await waitFor(() => active()?.dataset.item === 'new')
    await waitFor(() => !isOpen('edit'))
  })

  it('switches menus on hover while one is open', async (t) => {
    addStyle(t, CSS)
    let { act, cleanup } = render(<FileEditView />)
    t.after(cleanup)

    // Without an open menu, hovering does nothing.
    await act(() => pointer(trigger('edit'), 'pointerenter', { x: 60, y: 5 }))
    expect(isOpen('edit')).toBe(false)

    await act(() => mouseClick(trigger('file'), { x: 10, y: 5 }))
    await waitFor(() => isOpen('file'))
    await act(() => pointer(trigger('edit'), 'pointerenter', { x: 60, y: 5 }))
    await waitFor(() => isOpen('edit'))
    await waitFor(() => !isOpen('file'))
    expect(active()).toBe(trigger('edit'))
    expect(trigger('edit').getAttribute('aria-expanded')).toBe('true')

    // A hover-opened menu stays open when the pointer leaves its popup.
    await act(() => pointer(popup('edit'), 'pointerenter'))
    await act(() => pointer(popup('edit'), 'pointerleave'))
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(isOpen('edit')).toBe(true)

    // Left / Right on a trigger with a menu open open the adjacent menu, keeping focus there.
    await act(() => key(trigger('edit'), 'ArrowRight'))
    await waitFor(() => isOpen('view'))
    await waitFor(() => !isOpen('edit'))
    expect(active()).toBe(trigger('view'))

    // ArrowDown moves into the open menu.
    await act(() => key(trigger('view'), 'ArrowDown'))
    await waitFor(() => active()?.dataset.item === 'zoom')
  })

  it('makes outside content inert while a menu is open (modal by default)', async (t) => {
    addStyle(t, CSS)
    let { $, act, cleanup } = render(<FileEditView />)
    t.after(cleanup)
    let outside = $('[data-outside]') as HTMLElement
    let root = $('[role="menubar"]') as HTMLElement

    await act(() => mouseClick(trigger('file')))
    await waitFor(() => isOpen('file'))
    expect(outside.closest('[inert]')).not.toBe(null)
    expect(root.closest('[inert]')).toBe(null)

    await act(() => key(active(), 'Escape'))
    await waitFor(() => !isOpen('file'))
    expect(outside.closest('[inert]')).toBe(null)
  })

  it('reflects a menu that starts open once mounted', async (t) => {
    addStyle(t, CSS)
    let { $, cleanup } = render(
      <div>
        <menubar.Context>
          <div mix={menubar.root()}>
            <menu.Context defaultOpen>
              <button data-trigger="file" mix={menu.trigger()}>
                File
              </button>
              <div data-popup="file" mix={menu.popup()}>
                <div mix={menu.item()}>New</div>
              </div>
            </menu.Context>
          </div>
        </menubar.Context>
        <button data-outside>Outside</button>
      </div>,
    )
    t.after(cleanup)
    await waitFor(() => isOpen('file'))
    expect(($('[role="menubar"]') as HTMLElement).hasAttribute('data-has-submenu-open')).toBe(true)
    expect(($('[data-outside]') as HTMLElement).closest('[inert]')).not.toBe(null)
  })

  it('leaves outside content alone when modal is false', async (t) => {
    addStyle(t, CSS)
    let { $, act, cleanup } = render(<FileEditView menubar={{ modal: false }} />)
    t.after(cleanup)
    expect(($('[role="menubar"]') as HTMLElement).hasAttribute('data-modal')).toBe(false)

    await act(() => mouseClick(trigger('file')))
    await waitFor(() => isOpen('file'))
    expect(($('[data-outside]') as HTMLElement).closest('[inert]')).toBe(null)
  })

  it('uses Up/Down between triggers and opens to the side when vertical', async (t) => {
    addStyle(t, CSS)
    let { $, act, cleanup } = render(
      <FileEditView menubar={{ orientation: 'vertical', loopFocus: false }} />,
    )
    t.after(cleanup)
    expect(($('[role="menubar"]') as HTMLElement).getAttribute('aria-orientation')).toBe('vertical')

    await act(() => trigger('file').focus())
    key(trigger('file'), 'ArrowUp')
    expect(active()).toBe(trigger('file'))
    key(trigger('file'), 'ArrowDown')
    expect(active()).toBe(trigger('edit'))
    expect(isOpen('edit')).toBe(false)

    await act(() => key(trigger('edit'), 'ArrowRight'))
    await waitFor(() => active()?.dataset.item === 'undo')
    await waitFor(() => popup('edit').getAttribute('data-side') === 'inline-end')

    // ArrowLeft closes the menu and returns to its trigger.
    await act(() => key(active(), 'ArrowLeft'))
    await waitFor(() => !isOpen('edit'))
    expect(active()).toBe(trigger('edit'))
  })

  it('disables every menu when the menubar is disabled', async (t) => {
    let { act, cleanup } = render(<FileEditView menubar={{ disabled: true }} />)
    t.after(cleanup)

    let file = trigger('file') as HTMLButtonElement
    expect(file.disabled).toBe(true)
    expect(file.getAttribute('data-disabled')).toBe('')
    await act(() => file.click())
    expect(isOpen('file')).toBe(false)
  })

  it('leaves menus outside a menubar unchanged', (t) => {
    let { $, cleanup } = render(
      <menu.Context>
        <button data-trigger="solo" mix={menu.trigger()}>
          Solo
        </button>
        <div mix={menu.popup()} />
      </menu.Context>,
    )
    t.after(cleanup)
    let solo = $('[data-trigger="solo"]') as HTMLElement
    expect(solo.hasAttribute('role')).toBe(false)
    expect(solo.hasAttribute('tabindex')).toBe(false)
  })

  it('throws a helpful error for root() outside a Context', (t) => {
    let container = document.createElement('div')
    document.body.append(container)
    let root = createRoot(container)
    let errors: unknown[] = []
    root.addEventListener('error', (event) => void errors.push((event as ErrorEvent).error))
    t.after(() => {
      root.dispose()
      container.remove()
    })

    root.render(<div mix={menubar.root()} />)
    root.flush()
    expect(String(errors[0])).toMatch(
      /menubar\.root\(\) must be rendered inside <menubar\.Context>/,
    )
  })
})
