import { expect } from 'remix/assert'
import { describe, it } from 'remix/test'
import { createRoot, on } from 'remix/component'
import { render } from 'remix/component/test'

import * as menu from './menu.ts'
import { toggleButton } from './toggle-button.ts'
import * as toggleButtonGroup from './toggle-button-group.ts'
import * as toolbar from './toolbar.ts'

function key(target: Element | null, value: string, init: KeyboardEventInit = {}) {
  let event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: value, ...init })
  ;(target ?? document.body).dispatchEvent(event)
  return event
}

function active() {
  return document.activeElement as HTMLElement | null
}

/** `label:tabindex` for every toolbar item, in order. */
function stops(container: Element) {
  return [...container.querySelectorAll<HTMLElement>('[data-item]')].map(
    (node) => `${node.dataset.item}:${node.getAttribute('tabindex')}`,
  )
}

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

describe('toolbar', () => {
  it('renders toolbar semantics, data attributes, and a single tab stop', (t) => {
    let { $, container, cleanup } = render(
      <toolbar.Context>
        <div aria-label="Formatting" mix={toolbar.root()}>
          <button data-item="bold" mix={toolbar.button()}>
            Bold
          </button>
          <div aria-label="Numbers" mix={toolbar.group()}>
            <button data-item="currency" mix={toolbar.button()}>
              $
            </button>
          </div>
          <div mix={toolbar.separator()} />
          <a data-item="link" href="#edited" mix={toolbar.link()}>
            Edited
          </a>
          <input data-item="input" aria-label="Search" mix={toolbar.input()} />
          <span data-item="custom" mix={toolbar.item()}>
            Custom
          </span>
        </div>
      </toolbar.Context>,
    )
    t.after(cleanup)

    let root = $('[role="toolbar"]') as HTMLElement
    expect(root.getAttribute('aria-orientation')).toBe('horizontal')
    expect(root.getAttribute('data-orientation')).toBe('horizontal')
    expect(root.hasAttribute('data-disabled')).toBe(false)

    expect(stops(container)).toEqual(['bold:0', 'currency:-1', 'link:-1', 'input:-1', 'custom:-1'])

    let bold = $('[data-item="bold"]') as HTMLElement
    expect(bold.getAttribute('type')).toBe('button')
    expect(bold.getAttribute('data-orientation')).toBe('horizontal')
    expect(bold.getAttribute('data-focusable')).toBe('')
    expect(bold.hasAttribute('data-disabled')).toBe(false)

    let group = $('[role="group"]') as HTMLElement
    expect(group.getAttribute('data-orientation')).toBe('horizontal')
    expect(group.hasAttribute('data-disabled')).toBe(false)

    let separator = $('[role="separator"]') as HTMLElement
    expect(separator.getAttribute('aria-orientation')).toBe('vertical')
    expect(separator.getAttribute('data-orientation')).toBe('vertical')

    expect(($('[data-item="link"]') as HTMLElement).getAttribute('data-orientation')).toBe(
      'horizontal',
    )
    let input = $('[data-item="input"]') as HTMLElement
    expect(input.getAttribute('data-orientation')).toBe('horizontal')
    expect(input.getAttribute('data-focusable')).toBe('')
    expect(input.hasAttribute('data-disabled')).toBe(false)
  })

  it('moves focus with Left/Right (looping), Home, and End and moves the tab stop', async (t) => {
    let { $, act, container, cleanup } = render(
      <toolbar.Context>
        <div mix={toolbar.root()}>
          <button data-item="a" mix={toolbar.button()}>
            A
          </button>
          <button data-item="b" mix={toolbar.button()}>
            B
          </button>
          <a data-item="c" href="#c" mix={toolbar.link()}>
            C
          </a>
        </div>
      </toolbar.Context>,
    )
    t.after(cleanup)

    let a = $('[data-item="a"]') as HTMLElement
    let b = $('[data-item="b"]') as HTMLElement
    let c = $('[data-item="c"]') as HTMLElement

    await act(() => a.focus())
    let event = key(a, 'ArrowRight')
    expect(event.defaultPrevented).toBe(true)
    expect(active()).toBe(b)
    await act(() => {})
    expect(stops(container)).toEqual(['a:-1', 'b:0', 'c:-1'])

    key(b, 'ArrowRight')
    expect(active()).toBe(c)
    key(c, 'ArrowRight')
    expect(active()).toBe(a)
    key(a, 'ArrowLeft')
    expect(active()).toBe(c)
    key(c, 'Home')
    expect(active()).toBe(a)
    key(a, 'End')
    expect(active()).toBe(c)

    // Up / Down do nothing in a horizontal toolbar.
    let down = key(c, 'ArrowDown')
    expect(down.defaultPrevented).toBe(false)
    expect(active()).toBe(c)

    // Modifier keys are left alone.
    key(c, 'ArrowLeft', { ctrlKey: true })
    expect(active()).toBe(c)
  })

  it('stops at the ends without loopFocus and uses Up/Down when vertical', async (t) => {
    let { $, act, cleanup } = render(
      <toolbar.Context orientation="vertical" loopFocus={false}>
        <div mix={toolbar.root()}>
          <button data-item="a" mix={toolbar.button()}>
            A
          </button>
          <div mix={toolbar.separator()} />
          <button data-item="b" mix={toolbar.button()}>
            B
          </button>
        </div>
      </toolbar.Context>,
    )
    t.after(cleanup)

    let root = $('[role="toolbar"]') as HTMLElement
    expect(root.getAttribute('aria-orientation')).toBe('vertical')
    let separator = $('[role="separator"]') as HTMLElement
    expect(separator.getAttribute('data-orientation')).toBe('horizontal')
    expect(separator.hasAttribute('aria-orientation')).toBe(false)

    let a = $('[data-item="a"]') as HTMLElement
    let b = $('[data-item="b"]') as HTMLElement
    expect(a.getAttribute('data-orientation')).toBe('vertical')
    await act(() => a.focus())
    key(a, 'ArrowUp')
    expect(active()).toBe(a)
    key(a, 'ArrowRight')
    expect(active()).toBe(a)
    key(a, 'ArrowDown')
    expect(active()).toBe(b)
    key(b, 'ArrowDown')
    expect(active()).toBe(b)
  })

  it('mirrors Left/Right in RTL', async (t) => {
    let { $, act, cleanup } = render(
      <div dir="rtl">
        <toolbar.Context>
          <div mix={toolbar.root()}>
            <button data-item="a" mix={toolbar.button()}>
              A
            </button>
            <button data-item="b" mix={toolbar.button()}>
              B
            </button>
          </div>
        </toolbar.Context>
      </div>,
    )
    t.after(cleanup)

    let a = $('[data-item="a"]') as HTMLElement
    let b = $('[data-item="b"]') as HTMLElement
    await act(() => a.focus())
    key(a, 'ArrowLeft')
    expect(active()).toBe(b)
    key(b, 'ArrowRight')
    expect(active()).toBe(a)
  })

  it('keeps disabled buttons focusable by default and skips the others', async (t) => {
    let clicks: string[] = []
    let { $, act, container, cleanup } = render(
      <toolbar.Context>
        <div mix={toolbar.root()}>
          <button
            data-item="a"
            mix={[toolbar.button({ disabled: true }), on('click', () => void clicks.push('a'))]}
          >
            A
          </button>
          <button
            data-item="b"
            mix={toolbar.button({ disabled: true, focusableWhenDisabled: false })}
          >
            B
          </button>
          <button data-item="c" mix={[toolbar.button(), on('click', () => void clicks.push('c'))]}>
            C
          </button>
        </div>
      </toolbar.Context>,
    )
    t.after(cleanup)

    let a = $('[data-item="a"]') as HTMLButtonElement
    let b = $('[data-item="b"]') as HTMLButtonElement
    let c = $('[data-item="c"]') as HTMLElement

    expect(a.disabled).toBe(false)
    expect(a.getAttribute('aria-disabled')).toBe('true')
    expect(a.getAttribute('data-disabled')).toBe('')
    expect(a.getAttribute('data-focusable')).toBe('')
    expect(b.disabled).toBe(true)
    expect(b.hasAttribute('data-focusable')).toBe(false)
    // The focusable disabled button keeps the tab stop.
    expect(stops(container)).toEqual(['a:0', 'b:-1', 'c:-1'])

    a.click()
    c.click()
    expect(clicks).toEqual(['c'])

    await act(() => a.focus())
    key(a, 'ArrowRight')
    expect(active()).toBe(c)
    key(c, 'ArrowLeft')
    expect(active()).toBe(a)
  })

  it('disables every item with the toolbar or group disabled', async (t) => {
    let { $, cleanup } = render(
      <div>
        <toolbar.Context disabled>
          <div data-toolbar="disabled" mix={toolbar.root()}>
            <button data-item="a" mix={toolbar.button()}>
              A
            </button>
            <input data-item="i" mix={toolbar.input()} />
          </div>
        </toolbar.Context>
        <toolbar.Context>
          <div data-toolbar="grouped" mix={toolbar.root()}>
            <toolbar.GroupContext disabled>
              <div data-group mix={toolbar.group()}>
                <button data-item="g" mix={toolbar.button()}>
                  G
                </button>
              </div>
            </toolbar.GroupContext>
            <button data-item="h" mix={toolbar.button()}>
              H
            </button>
          </div>
        </toolbar.Context>
      </div>,
    )
    t.after(cleanup)

    expect(($('[data-toolbar="disabled"]') as HTMLElement).getAttribute('data-disabled')).toBe('')
    expect(($('[data-item="a"]') as HTMLElement).getAttribute('aria-disabled')).toBe('true')
    let input = $('[data-item="i"]') as HTMLInputElement
    expect(input.readOnly).toBe(true)
    expect(input.getAttribute('aria-disabled')).toBe('true')
    expect(input.getAttribute('data-disabled')).toBe('')

    expect(($('[data-group]') as HTMLElement).getAttribute('data-disabled')).toBe('')
    expect(($('[data-item="g"]') as HTMLElement).getAttribute('data-disabled')).toBe('')
    expect(($('[data-item="h"]') as HTMLElement).hasAttribute('data-disabled')).toBe(false)
  })

  it('lets the arrows move the caret in an input and leave it from the edges', async (t) => {
    let { $, act, cleanup } = render(
      <toolbar.Context>
        <div mix={toolbar.root()}>
          <button data-item="a" mix={toolbar.button()}>
            A
          </button>
          <input data-item="i" defaultValue="abc" mix={toolbar.input()} />
          <button data-item="b" mix={toolbar.button()}>
            B
          </button>
        </div>
      </toolbar.Context>,
    )
    t.after(cleanup)

    let a = $('[data-item="a"]') as HTMLElement
    let input = $('[data-item="i"]') as HTMLInputElement
    let b = $('[data-item="b"]') as HTMLElement

    await act(() => a.focus())
    key(a, 'ArrowRight')
    expect(active()).toBe(input)
    // Reached with the keyboard: the text is selected, so the arrows act natively.
    expect([input.selectionStart, input.selectionEnd]).toEqual([0, 3])
    expect(key(input, 'ArrowRight').defaultPrevented).toBe(false)

    input.setSelectionRange(1, 1)
    expect(key(input, 'ArrowRight').defaultPrevented).toBe(false)
    expect(key(input, 'ArrowLeft').defaultPrevented).toBe(false)
    expect(key(input, 'Home').defaultPrevented).toBe(false)
    expect(active()).toBe(input)

    input.setSelectionRange(3, 3)
    expect(key(input, 'ArrowRight', { shiftKey: true }).defaultPrevented).toBe(false)
    expect(active()).toBe(input)
    key(input, 'ArrowRight')
    expect(active()).toBe(b)

    input.focus()
    input.setSelectionRange(0, 0)
    key(input, 'ArrowLeft')
    expect(active()).toBe(a)
  })

  it('renders disabled inputs and blocks interaction', (t) => {
    let { $, cleanup } = render(
      <toolbar.Context>
        <div mix={toolbar.root()}>
          <input data-item="focusable" mix={toolbar.input({ disabled: true })} />
          <input
            data-item="native"
            mix={toolbar.input({ disabled: true, focusableWhenDisabled: false })}
          />
        </div>
      </toolbar.Context>,
    )
    t.after(cleanup)

    let focusable = $('[data-item="focusable"]') as HTMLInputElement
    let native = $('[data-item="native"]') as HTMLInputElement
    expect(focusable.disabled).toBe(false)
    expect(focusable.readOnly).toBe(true)
    let click = new MouseEvent('click', { bubbles: true, cancelable: true })
    focusable.dispatchEvent(click)
    expect(click.defaultPrevented).toBe(true)
    expect(native.disabled).toBe(true)
    expect(native.hasAttribute('data-focusable')).toBe(false)
  })

  it('takes over the roving focus of a toggle button group inside it', async (t) => {
    let values: string[][] = []
    let { $, act, container, cleanup } = render(
      <toolbar.Context>
        <div mix={toolbar.root()}>
          <toggleButtonGroup.Context
            multiple
            defaultValue={['bold']}
            onValueChange={(value) => void values.push(value)}
          >
            <div mix={toggleButtonGroup.root()}>
              <button data-item="bold" mix={[toolbar.button(), toggleButton({ value: 'bold' })]}>
                B
              </button>
              {/* Mixin order doesn't matter for the tab stop. */}
              <button data-item="italic" mix={[toggleButton({ value: 'italic' }), toolbar.item()]}>
                I
              </button>
            </div>
          </toggleButtonGroup.Context>
          <button data-item="clear" mix={toolbar.button()}>
            Clear
          </button>
        </div>
      </toolbar.Context>,
    )
    t.after(cleanup)

    expect(stops(container)).toEqual(['bold:0', 'italic:-1', 'clear:-1'])
    let bold = $('[data-item="bold"]') as HTMLElement
    let italic = $('[data-item="italic"]') as HTMLElement
    let clear = $('[data-item="clear"]') as HTMLElement
    expect(bold.getAttribute('aria-pressed')).toBe('true')

    await act(() => bold.focus())
    key(bold, 'ArrowRight')
    expect(active()).toBe(italic)
    key(italic, 'ArrowRight')
    // The group's own navigation would loop back to "bold".
    expect(active()).toBe(clear)
    key(clear, 'ArrowRight')
    expect(active()).toBe(bold)
    await act(() => {})
    expect(stops(container)).toEqual(['bold:0', 'italic:-1', 'clear:-1'])

    await act(() => italic.click())
    expect(values).toEqual([['bold', 'italic']])
    expect(italic.getAttribute('aria-pressed')).toBe('true')
  })

  it('composes with a menu trigger: ArrowDown opens it, Left/Right move on', async (t) => {
    let { $, act, cleanup } = render(
      <toolbar.Context>
        <div mix={toolbar.root()}>
          <button data-item="a" mix={toolbar.button()}>
            A
          </button>
          <menu.Context>
            <button data-item="more" mix={[toolbar.button(), menu.trigger()]}>
              More
            </button>
            <div mix={menu.popup()}>
              <div data-menu-item mix={menu.item()}>
                One
              </div>
            </div>
          </menu.Context>
          <menu.Context>
            <button data-item="off" mix={[toolbar.button({ disabled: true }), menu.trigger()]}>
              Off
            </button>
            <div data-popup="off" mix={menu.popup()}>
              <div mix={menu.item()}>Two</div>
            </div>
          </menu.Context>
        </div>
      </toolbar.Context>,
    )
    t.after(cleanup)

    let a = $('[data-item="a"]') as HTMLElement
    let more = $('[data-item="more"]') as HTMLElement
    let off = $('[data-item="off"]') as HTMLElement
    expect(more.getAttribute('aria-haspopup')).toBe('menu')
    expect(more.getAttribute('tabindex')).toBe('-1')

    await act(() => a.focus())
    key(a, 'ArrowRight')
    expect(active()).toBe(more)
    key(more, 'ArrowRight')
    // The disabled trigger stays reachable but doesn't open.
    expect(active()).toBe(off)
    await act(() => off.click())
    expect(off.getAttribute('aria-expanded')).toBe('false')
    key(off, 'ArrowLeft')
    expect(active()).toBe(more)

    await act(() => key(more, 'ArrowDown'))
    await waitFor(() => active()?.hasAttribute('data-menu-item') === true)
    expect(more.getAttribute('aria-expanded')).toBe('true')
    // Keys inside the popup are left to the menu.
    key(active(), 'ArrowRight')
    expect(active()?.hasAttribute('data-menu-item')).toBe(true)
  })

  it('accepts every mixin called without arguments', (t) => {
    let { $, cleanup } = render(
      <toolbar.Context>
        <div mix={toolbar.root()}>
          <button mix={toolbar.button()}>A</button>
          <a href="#x" mix={toolbar.link()}>
            X
          </a>
          <input mix={toolbar.input()} />
          <span mix={toolbar.item()}>S</span>
          <div mix={toolbar.group()} />
          <div mix={toolbar.separator()} />
        </div>
      </toolbar.Context>,
    )
    t.after(cleanup)
    expect($('[role="toolbar"]')).not.toBe(null)
  })

  it('lets explicit host props win', (t) => {
    let { $, cleanup } = render(
      <toolbar.Context>
        <div role="menubar" mix={toolbar.root()}>
          <button tabIndex={0} data-item="a" mix={toolbar.button()}>
            A
          </button>
          <button tabIndex={0} data-item="b" mix={toolbar.button()}>
            B
          </button>
        </div>
      </toolbar.Context>,
    )
    t.after(cleanup)
    expect(($('[data-item="b"]') as HTMLElement).getAttribute('tabindex')).toBe('0')
    expect(($('[role="menubar"]') as HTMLElement).getAttribute('aria-orientation')).toBe(
      'horizontal',
    )
  })

  it('throws a helpful error outside a Context', (t) => {
    let container = document.createElement('div')
    document.body.append(container)
    let root = createRoot(container)
    let errors: unknown[] = []
    root.addEventListener('error', (event) => void errors.push((event as ErrorEvent).error))
    t.after(() => {
      root.dispose()
      container.remove()
    })

    root.render(<button mix={toolbar.button()} />)
    root.flush()
    expect(String(errors[0])).toMatch(
      /toolbar\.button\(\) must be rendered inside <toolbar\.Context>/,
    )
  })
})
