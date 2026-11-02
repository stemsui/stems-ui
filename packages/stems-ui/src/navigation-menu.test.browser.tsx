import { expect } from 'remix/assert'
import { describe, it } from 'remix/test'
import type { Handle, RemixNode } from 'remix/component'
import { render } from 'remix/component/test'

import * as navigationMenu from './navigation-menu.tsx'
import { NavigationMenuChangeEvent, onNavigationMenuChange } from './navigation-menu.tsx'
import type { NavigationMenuChangeDetails } from './navigation-menu.tsx'

type T = { after(fn: () => void): void }

function nextFrame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
}

async function waitFor(condition: () => boolean, timeout = 1500) {
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
  [data-test-list] { display: flex; gap: 0; margin: 0; padding: 0; list-style: none;
    position: fixed; top: 20px; left: 20px; }
  [data-test-list] > li { margin: 0; padding: 0; }
  [data-test-trigger] { width: 100px; height: 30px; margin: 0; padding: 0; border: 0;
    box-sizing: border-box; }
  [data-test-popup] { margin: 0; padding: 0; border: 0; box-sizing: border-box; overflow: visible;
    width: var(--popup-width); height: var(--popup-height); }
  [data-test-viewport] { position: relative; width: 100%; height: 100%; overflow: hidden; }
  [data-test-content] { box-sizing: border-box; }
`

function isShown(element: HTMLElement) {
  return element.matches(':popover-open')
}

function key(target: Element, value: string, init: KeyboardEventInit = {}) {
  let event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: value, ...init })
  target.dispatchEvent(event)
  return event
}

function pointer(target: Element, type: string, init: PointerEventInit = {}) {
  target.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerType: 'mouse', ...init }))
}

type HarnessProps = navigationMenu.NavigationMenuContextProps & {
  noArgs?: boolean
  noPopup?: boolean
  popupOptions?: navigationMenu.NavigationMenuPopupOptions
  closeOnClick?: boolean
  docsExtra?: RemixNode
  blogWidth?: number
}

function Harness(handle: Handle<HarnessProps>) {
  return () => {
    let {
      noArgs,
      noPopup,
      popupOptions,
      closeOnClick,
      docsExtra,
      blogWidth = 300,
      children: _children,
      ...props
    } = handle.props
    let trigger = () => (noArgs ? navigationMenu.trigger() : navigationMenu.trigger({}))
    return (
      <div>
        <button id="before">Before</button>
        <navigationMenu.Context {...props}>
          <nav id="root" mix={navigationMenu.root()}>
            <ul id="list" data-test-list mix={navigationMenu.list()}>
              <navigationMenu.ItemContext value="docs">
                <li>
                  <button id="docs" data-test-trigger mix={trigger()}>
                    Docs
                    <span id="docs-icon" mix={navigationMenu.icon()} />
                  </button>
                  <navigationMenu.Content
                    id="docs-content"
                    data-test-content
                    style={{ width: '200px', height: '100px' }}
                  >
                    <a id="docs-intro" href="#intro" mix={navigationMenu.link({ closeOnClick })}>
                      Intro
                    </a>
                    <a
                      id="docs-install"
                      href="#install"
                      mix={navigationMenu.link({ active: true })}
                    >
                      Install
                    </a>
                    {docsExtra}
                  </navigationMenu.Content>
                </li>
              </navigationMenu.ItemContext>
              <navigationMenu.ItemContext value="blog">
                <li>
                  <button id="blog" data-test-trigger mix={trigger()}>
                    Blog
                  </button>
                  <navigationMenu.Content
                    id="blog-content"
                    data-test-content
                    style={{ width: `${blogWidth}px`, height: '150px' }}
                  >
                    <a id="blog-latest" href="#latest" mix={navigationMenu.link()}>
                      Latest
                    </a>
                  </navigationMenu.Content>
                </li>
              </navigationMenu.ItemContext>
              <navigationMenu.ItemContext value="disabled">
                <li>
                  <button
                    id="disabled"
                    data-test-trigger
                    mix={navigationMenu.trigger({ disabled: true })}
                  >
                    Disabled
                  </button>
                  <navigationMenu.Content id="disabled-content">Nope</navigationMenu.Content>
                </li>
              </navigationMenu.ItemContext>
              <li>
                <a
                  id="about"
                  href="#about"
                  mix={noArgs ? navigationMenu.link() : navigationMenu.link({})}
                >
                  About
                </a>
              </li>
            </ul>
            {noPopup ? (
              <navigationMenu.Viewport id="viewport" data-test-viewport />
            ) : (
              <div
                id="popup"
                data-test-popup
                mix={noArgs ? navigationMenu.popup() : navigationMenu.popup(popupOptions)}
              >
                <div
                  id="arrow"
                  style={{ width: '12px', height: '6px' }}
                  mix={navigationMenu.arrow()}
                />
                <navigationMenu.Viewport id="viewport" data-test-viewport />
              </div>
            )}
          </nav>
        </navigationMenu.Context>
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
    get,
    docs: get('docs') as HTMLButtonElement,
    blog: get('blog') as HTMLButtonElement,
    popup: get('popup'),
    docsContent: get('docs-content'),
    blogContent: get('blog-content'),
  }
}

function setupControlled(t: T, options: { value?: string | null; accept?: boolean } = {}) {
  addStyle(t, BASE_CSS)
  let state = { value: options.value ?? null }
  let changes: Array<{ value: string | null; details: NavigationMenuChangeDetails }> = []
  let owner: Handle | undefined
  function App(handle: Handle) {
    owner = handle
    return () => (
      <Harness
        value={state.value}
        onValueChange={(value, details) => {
          changes.push({ value, details })
          if (options.accept !== false) {
            state.value = value
            void handle.update()
          }
        }}
      />
    )
  }
  let result = render(<App />)
  t.after(result.cleanup)
  let get = (id: string) => result.$(`#${id}`) as HTMLElement
  return {
    ...result,
    get,
    docs: get('docs') as HTMLButtonElement,
    blog: get('blog') as HTMLButtonElement,
    popup: get('popup'),
    changes,
    async setValue(value: string | null) {
      state.value = value
      await result.act(() => owner!.update())
    },
  }
}

describe('navigation-menu', () => {
  it('renders navigation semantics, not menu roles', (t) => {
    let { docs, popup, docsContent, get } = setup(t)

    expect(docs.getAttribute('type')).toBe('button')
    expect(docs.getAttribute('aria-expanded')).toBe('false')
    expect(docs.getAttribute('aria-controls')).toBe('docs-content')
    expect(docs.hasAttribute('aria-haspopup')).toBe(false)
    expect(docs.hasAttribute('data-popup-open')).toBe(false)
    expect(get('docs-icon').getAttribute('aria-hidden')).toBe('true')

    expect(get('root').getAttribute('data-orientation')).toBe('horizontal')
    expect(popup.getAttribute('popover')).toBe('manual')
    expect(popup.hasAttribute('role')).toBe(false)
    expect(popup.hasAttribute('hidden')).toBe(true)
    expect(isShown(popup)).toBe(false)

    // Content renders inside the viewport.
    expect(get('viewport').contains(docsContent)).toBe(true)
    expect(docsContent.hasAttribute('hidden')).toBe(true)
    expect(docsContent.getAttribute('data-closed')).toBe('')
    expect(document.querySelector('[role="menu"], [role="menuitem"]')).toBe(null)

    expect(get('docs-install').getAttribute('aria-current')).toBe('page')
    expect(get('docs-install').getAttribute('data-active')).toBe('')
    expect(get('docs-intro').hasAttribute('aria-current')).toBe(false)
  })

  it('works with no-argument mixin calls', async (t) => {
    let { act, docs, popup } = setup(t, { noArgs: true })
    await act(() => docs.click())
    expect(isShown(popup)).toBe(true)
    expect(docs.getAttribute('aria-expanded')).toBe('true')
  })

  it('opens on press and closes on a second press', async (t) => {
    let { act, docs, popup, docsContent, blogContent, get } = setup(t)

    await act(() => docs.click())
    expect(isShown(popup)).toBe(true)
    expect(popup.getAttribute('data-open')).toBe('')
    expect(docs.getAttribute('aria-expanded')).toBe('true')
    expect(docs.getAttribute('data-popup-open')).toBe('')
    expect(docs.getAttribute('data-pressed')).toBe('')
    expect(get('docs-icon').getAttribute('data-popup-open')).toBe('')
    expect(docsContent.hasAttribute('hidden')).toBe(false)
    expect(docsContent.getAttribute('data-open')).toBe('')
    expect(blogContent.hasAttribute('hidden')).toBe(true)
    // Opening doesn't move focus (non-modal).
    expect(document.activeElement).not.toBe(get('docs-intro'))
    // Positioned against the trigger.
    // Positioned against the trigger (centered: 70 - 200 / 2, clamped to the 5px padding).
    expect(popup.style.position).toBe('fixed')
    expect(popup.style.top).toBe('50px')
    expect(popup.style.left).toBe('5px')
    expect(popup.offsetWidth).toBe(200)

    await act(() => docs.click())
    expect(docs.getAttribute('aria-expanded')).toBe('false')
    await waitFor(() => !isShown(popup))
    await waitFor(() => docsContent.hasAttribute('hidden'))
  })

  it('switches between items, keeping the popup open', async (t) => {
    let { act, docs, blog, popup, docsContent, blogContent } = setup(t, {
      popupOptions: { align: 'start' },
    })
    await act(() => docs.click())
    expect(docsContent.hasAttribute('data-activation-direction')).toBe(false)

    await act(() => blog.click())
    expect(isShown(popup)).toBe(true)
    expect(docs.getAttribute('aria-expanded')).toBe('false')
    expect(blog.getAttribute('aria-expanded')).toBe('true')
    expect(blogContent.getAttribute('data-open')).toBe('')
    expect(blogContent.getAttribute('data-activation-direction')).toBe('right')
    expect(docsContent.getAttribute('data-closed')).toBe('')
    expect(docsContent.getAttribute('data-activation-direction')).toBe('right')
    // Repositioned against the new trigger.
    await waitFor(() => popup.style.left === '120px')

    await act(() => docs.click())
    expect(docsContent.getAttribute('data-activation-direction')).toBe('left')
    expect(blogContent.getAttribute('data-activation-direction')).toBe('left')
  })

  it('animates content and popup size between items', async (t) => {
    addStyle(
      t,
      `[data-test-popup] { transition: width 80ms linear, height 80ms linear; }
       [data-test-content] { transition: opacity 80ms linear; }
       [data-test-content][data-starting-style], [data-test-content][data-ending-style] { opacity: 0; }`,
    )
    let { act, docs, blog, popup, docsContent, blogContent } = setup(t)
    await act(() => docs.click())
    await waitFor(() => !docsContent.hasAttribute('data-starting-style'))
    expect(popup.offsetWidth).toBe(200)
    expect(popup.offsetHeight).toBe(100)

    await act(() => blog.click())
    // The exiting content leaves the flow and is inert while it animates out.
    expect(docsContent.getAttribute('data-ending-style')).toBe('')
    expect(docsContent.style.position).toBe('absolute')
    expect(docsContent.hasAttribute('inert')).toBe(true)
    expect(blogContent.hasAttribute('hidden')).toBe(false)
    expect(popup.style.getPropertyValue('--positioner-width')).toBe('300px')
    expect(popup.style.getPropertyValue('--positioner-height')).toBe('150px')

    await waitFor(() => popup.style.getPropertyValue('--popup-width') === '300px')
    expect(popup.style.getPropertyValue('--popup-height')).toBe('150px')

    await waitFor(() => docsContent.hasAttribute('hidden'))
    expect(docsContent.style.position).toBe('')
    expect(docsContent.hasAttribute('inert')).toBe(false)
    // Back to the content size once the morph has finished.
    await waitFor(() => popup.style.getPropertyValue('--popup-width') === 'fit-content')
    expect(popup.offsetWidth).toBe(300)
  })

  it('opens on hover after the delay and closes after leaving', async (t) => {
    let { docs, popup, get } = setup(t, { delay: 30, closeDelay: 30 })

    pointer(docs, 'pointerenter')
    await sleep(10)
    expect(docs.getAttribute('aria-expanded')).toBe('false')
    await waitFor(() => docs.getAttribute('aria-expanded') === 'true')
    await waitFor(() => isShown(popup))
    expect(docs.hasAttribute('data-pressed')).toBe(false)

    // Moving into the popup keeps it open.
    pointer(docs, 'pointerleave', { relatedTarget: popup })
    pointer(popup, 'pointerenter')
    await sleep(60)
    expect(docs.getAttribute('aria-expanded')).toBe('true')

    pointer(popup, 'pointerleave', { relatedTarget: get('outside-area') })
    await waitFor(() => docs.getAttribute('aria-expanded') === 'false')
  })

  it('cancels a pending hover open when the pointer leaves first', async (t) => {
    let { docs } = setup(t, { delay: 40 })
    pointer(docs, 'pointerenter')
    pointer(docs, 'pointerleave', { relatedTarget: document.body })
    await sleep(80)
    expect(docs.getAttribute('aria-expanded')).toBe('false')
  })

  it('switches immediately when hovering another trigger while open', async (t) => {
    let { act, docs, blog } = setup(t, { delay: 1000 })
    await act(() => docs.click())
    pointer(blog, 'pointerenter')
    await waitFor(() => blog.getAttribute('aria-expanded') === 'true')
  })

  it('ignores touch hover', async (t) => {
    let { docs } = setup(t, { delay: 0 })
    pointer(docs, 'pointerenter', { pointerType: 'touch' })
    await sleep(30)
    expect(docs.getAttribute('aria-expanded')).toBe('false')
  })

  it('keeps a hover-opened menu open on a quick press, and stops hover closing', async (t) => {
    let { act, docs, get } = setup(t, { delay: 0, closeDelay: 0 })
    pointer(docs, 'pointerenter')
    await waitFor(() => docs.getAttribute('aria-expanded') === 'true')
    await act(() => docs.click())
    expect(docs.getAttribute('aria-expanded')).toBe('true')
    expect(docs.getAttribute('data-pressed')).toBe('')

    pointer(docs, 'pointerleave', { relatedTarget: get('outside-area') })
    await sleep(40)
    expect(docs.getAttribute('aria-expanded')).toBe('true')

    // A later press closes it.
    await act(() => docs.click())
    expect(docs.getAttribute('aria-expanded')).toBe('false')
  })

  it('closes a hover-opened menu with a patient press', async (t) => {
    let { act, docs } = setup(t, { delay: 0 })
    pointer(docs, 'pointerenter')
    await waitFor(() => docs.getAttribute('aria-expanded') === 'true')
    await sleep(550)
    await act(() => docs.click())
    expect(docs.getAttribute('aria-expanded')).toBe('false')
  })

  it('ignores disabled triggers', async (t) => {
    let { act, get } = setup(t, { delay: 0 })
    let disabled = get('disabled')
    expect(disabled.getAttribute('aria-disabled')).toBe('true')
    expect(disabled.getAttribute('data-disabled')).toBe('')
    expect((disabled as HTMLButtonElement).disabled).toBe(false)
    await act(() => disabled.click())
    pointer(disabled, 'pointerenter')
    await sleep(30)
    expect(disabled.getAttribute('aria-expanded')).toBe('false')
  })

  it('closes on Escape and returns focus to the trigger', async (t) => {
    let { act, docs, popup, get } = setup(t)
    docs.focus()
    await act(() => docs.click())
    get('docs-intro').focus()
    await act(() => key(get('docs-intro'), 'Escape'))
    expect(docs.getAttribute('aria-expanded')).toBe('false')
    await waitFor(() => document.activeElement === docs)
    await waitFor(() => !isShown(popup))
  })

  it('closes on an outside press', async (t) => {
    let reasons: string[] = []
    let { act, docs, get } = setup(t, { onValueChange: (_v, d) => reasons.push(d.reason) })
    await act(() => docs.click())
    await nextFrame()
    let outside = get('outside-area')
    pointer(outside, 'pointerdown')
    await act(() => outside.click())
    expect(docs.getAttribute('aria-expanded')).toBe('false')
    expect(reasons).toEqual(['trigger-press', 'outside-press'])
  })

  it('closes when focus leaves the menu', async (t) => {
    let reasons: string[] = []
    let { act, docs, get } = setup(t, { onValueChange: (_v, d) => reasons.push(d.reason) })
    docs.focus()
    await act(() => docs.click())
    // Focus moving within the root keeps it open.
    get('about').focus()
    expect(docs.getAttribute('aria-expanded')).toBe('true')
    await act(() => get('after').focus())
    expect(docs.getAttribute('aria-expanded')).toBe('false')
    expect(reasons.at(-1)).toBe('focus-out')
  })

  it('moves focus between top-level items with the arrow keys (RTL aware)', async (t) => {
    let { docs, blog, get, container } = setup(t)
    docs.focus()
    key(docs, 'ArrowRight')
    expect(document.activeElement).toBe(blog)
    key(blog, 'ArrowRight')
    expect(document.activeElement).toBe(get('disabled'))
    key(get('disabled'), 'ArrowRight')
    expect(document.activeElement).toBe(get('about'))
    key(get('about'), 'ArrowRight')
    expect(document.activeElement).toBe(docs)
    key(docs, 'ArrowLeft')
    expect(document.activeElement).toBe(get('about'))
    key(get('about'), 'Home')
    expect(document.activeElement).toBe(docs)
    key(docs, 'End')
    expect(document.activeElement).toBe(get('about'))
    // Up/Down don't move in a horizontal list.
    key(get('about'), 'ArrowUp')
    expect(document.activeElement).toBe(get('about'))

    container.setAttribute('dir', 'rtl')
    docs.focus()
    key(docs, 'ArrowLeft')
    expect(document.activeElement).toBe(blog)
  })

  it('uses Up/Down and opens with ArrowRight in a vertical menu', async (t) => {
    let { docs, blog, get, container } = setup(t, { orientation: 'vertical' })
    docs.focus()
    key(docs, 'ArrowDown')
    expect(document.activeElement).toBe(blog)
    key(blog, 'ArrowUp')
    expect(document.activeElement).toBe(docs)

    key(docs, 'ArrowRight')
    await waitFor(() => document.activeElement === get('docs-intro'))
    expect(docs.getAttribute('aria-expanded')).toBe('true')

    container.setAttribute('dir', 'rtl')
    blog.focus()
    key(blog, 'ArrowLeft')
    await waitFor(() => document.activeElement === get('blog-latest'))
  })

  it('opens with ArrowDown and focuses the first link', async (t) => {
    let reasons: string[] = []
    let { docs, get } = setup(t, { onValueChange: (_v, d) => reasons.push(d.reason) })
    docs.focus()
    let event = key(docs, 'ArrowDown')
    expect(event.defaultPrevented).toBe(true)
    await waitFor(() => document.activeElement === get('docs-intro'))
    expect(reasons).toEqual(['list-navigation'])

    // Arrow keys move between the content's links.
    key(get('docs-intro'), 'ArrowDown')
    expect(document.activeElement).toBe(get('docs-install'))
    key(get('docs-install'), 'ArrowDown')
    expect(document.activeElement).toBe(get('docs-install'))
    key(get('docs-install'), 'ArrowUp')
    expect(document.activeElement).toBe(get('docs-intro'))
  })

  it('tabs from the open trigger into its content and back out', async (t) => {
    let { act, docs, blog, get } = setup(t)
    docs.focus()
    await act(() => docs.click())

    let tab = key(docs, 'Tab')
    expect(tab.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(get('docs-intro'))

    // Shift+Tab from the first link returns to the trigger.
    let back = key(get('docs-intro'), 'Tab', { shiftKey: true })
    expect(back.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(docs)

    // Tab from the last link moves to the element after the trigger.
    get('docs-install').focus()
    let out = key(get('docs-install'), 'Tab')
    expect(out.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(blog)
    // Still inside the menu: it stays open.
    expect(docs.getAttribute('aria-expanded')).toBe('true')

    // A Tab from a middle link is left to the browser.
    expect(key(get('docs-intro'), 'Tab').defaultPrevented).toBe(false)
  })

  it('skips the popup when tabbing into it from outside (focus guards)', async (t) => {
    let { act, docs, blog, get } = setup(t)
    await act(() => docs.click())
    let viewport = get('viewport')
    let start = viewport.firstElementChild as HTMLElement
    let end = viewport.lastElementChild as HTMLElement
    expect(start.getAttribute('aria-hidden')).toBe('true')
    expect(start.tabIndex).toBe(0)

    // Forward from the last list item: past the popup.
    get('about').focus()
    start.focus()
    expect(document.activeElement).toBe(get('after'))
    await waitFor(() => docs.getAttribute('aria-expanded') === 'false')

    await act(() => docs.click())
    // Backward from after the menu: back to the list.
    get('after').focus()
    end.focus()
    expect(document.activeElement).toBe(get('about'))

    // Leaving the content backward goes to its trigger, forward to what follows the trigger.
    get('docs-intro').focus()
    start.focus()
    expect(document.activeElement).toBe(docs)
    get('docs-install').focus()
    end.focus()
    expect(document.activeElement).toBe(blog)
  })

  it('closes when a focus guard has nothing to skip to', async (t) => {
    let { act, docs, get, container } = setup(t)
    // Make everything after the popup unfocusable.
    for (let node of container.querySelectorAll<HTMLElement>('#after')) node.tabIndex = -1
    await act(() => docs.click())
    get('about').focus()
    await act(() => (get('viewport').firstElementChild as HTMLElement).focus())
    expect(docs.getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).not.toBe(get('viewport').firstElementChild)
  })

  it('leaves Tab alone on a closed trigger', (t) => {
    let { docs } = setup(t)
    docs.focus()
    expect(key(docs, 'Tab').defaultPrevented).toBe(false)
  })

  it('closes on link press with closeOnClick', async (t) => {
    let reasons: string[] = []
    let { act, docs, get } = setup(t, {
      closeOnClick: true,
      onValueChange: (_v, d) => reasons.push(d.reason),
    })
    await act(() => docs.click())
    await act(() => get('docs-intro').click())
    expect(docs.getAttribute('aria-expanded')).toBe('false')
    expect(reasons).toEqual(['trigger-press', 'link-press'])
  })

  it('keeps the menu open on link press by default', async (t) => {
    let { act, docs, get } = setup(t)
    await act(() => docs.click())
    await act(() => get('docs-intro').click())
    expect(docs.getAttribute('aria-expanded')).toBe('true')
  })

  it('opens initially with defaultValue', async (t) => {
    let { docs, popup, docsContent } = setup(t, { defaultValue: 'docs' })
    expect(docs.getAttribute('aria-expanded')).toBe('true')
    expect(docsContent.getAttribute('data-open')).toBe('')
    await waitFor(() => isShown(popup))
  })

  it('supports a controlled value', async (t) => {
    let { act, docs, blog, popup, changes, setValue } = setupControlled(t)
    await act(() => docs.click())
    expect(changes.map((c) => [c.value, c.details.reason])).toEqual([['docs', 'trigger-press']])
    expect(changes[0]!.details.trigger).toBe(docs)
    expect(docs.getAttribute('aria-expanded')).toBe('true')

    await setValue('blog')
    expect(blog.getAttribute('aria-expanded')).toBe('true')
    expect(isShown(popup)).toBe(true)

    await setValue(null)
    expect(blog.getAttribute('aria-expanded')).toBe('false')
    await waitFor(() => !isShown(popup))
  })

  it('stays put when the controlled owner rejects a change', async (t) => {
    let { act, docs, changes } = setupControlled(t, { accept: false })
    await act(() => docs.click())
    expect(changes).toHaveLength(1)
    expect(docs.getAttribute('aria-expanded')).toBe('false')
  })

  it('lets onValueChange cancel a change', async (t) => {
    let { act, docs } = setup(t, {
      onValueChange: (value, details) => {
        if (value === 'docs') details.cancel()
      },
    })
    await act(() => docs.click())
    expect(docs.getAttribute('aria-expanded')).toBe('false')
  })

  it('dispatches a bubbling change event', async (t) => {
    let events: NavigationMenuChangeEvent[] = []
    let { act, docs, blog, container } = setup(t)
    container.addEventListener('stems:navigation-menu-change', (event) => events.push(event))
    await act(() => docs.click())
    await act(() => blog.click())
    await act(() => blog.click())
    expect(events.map((e) => [e.value, e.previousValue, e.reason])).toEqual([
      ['docs', null, 'trigger-press'],
      ['blog', 'docs', 'trigger-press'],
      [null, 'blog', 'trigger-press'],
    ])
    expect(events[0]).toBeInstanceOf(NavigationMenuChangeEvent)
    expect(events[0]!.target).toBe(docs)
  })

  it('exposes a typed listener helper', async (t) => {
    addStyle(t, BASE_CSS)
    let values: Array<string | null> = []
    let result = render(
      <div mix={onNavigationMenuChange((event) => void values.push(event.value))}>
        <Harness />
      </div>,
    )
    t.after(result.cleanup)
    await result.act(() => (result.$('#docs') as HTMLElement).click())
    expect(values).toEqual(['docs'])
  })

  it('calls onOpenChangeComplete after the popup animations', async (t) => {
    let completes: boolean[] = []
    let { act, docs } = setup(t, { onOpenChangeComplete: (open) => completes.push(open) })
    await act(() => docs.click())
    await waitFor(() => completes.length === 1)
    await act(() => docs.click())
    await waitFor(() => completes.length === 2)
    expect(completes).toEqual([true, false])
  })

  it('keeps the content visible while the popup animates out', async (t) => {
    addStyle(
      t,
      `[data-test-popup] { transition: opacity 80ms linear; }
       [data-test-popup][data-ending-style] { opacity: 0; }`,
    )
    let { act, docs, popup, docsContent } = setup(t)
    await act(() => docs.click())
    await waitFor(() => !popup.hasAttribute('data-starting-style'))
    await act(() => docs.click())
    expect(popup.getAttribute('data-ending-style')).toBe('')
    expect(docsContent.hasAttribute('hidden')).toBe(false)
    expect(docsContent.getAttribute('data-open')).toBe('')
    await waitFor(() => !isShown(popup))
    await waitFor(() => docsContent.hasAttribute('hidden'))
    expect(docsContent.getAttribute('data-closed')).toBe('')
  })

  it('positions with Positioner options and an arrow', async (t) => {
    let { act, docs, popup, get } = setup(t, {
      popupOptions: { sideOffset: 8, align: 'start' },
    })
    await act(() => docs.click())
    expect(popup.getAttribute('data-side')).toBe('bottom')
    expect(popup.getAttribute('data-align')).toBe('start')
    expect(popup.style.top).toBe('58px')
    expect(popup.style.left).toBe('20px')
    expect(get('arrow').getAttribute('data-open')).toBe('')
    expect(get('arrow').style.position).toBe('absolute')
  })

  it('updates the viewport when content re-renders', async (t) => {
    addStyle(t, BASE_CSS)
    let extra: RemixNode = null
    let owner: Handle | undefined
    function App(handle: Handle) {
      owner = handle
      return () => <Harness defaultValue="docs" docsExtra={extra} />
    }
    let result = render(<App />)
    t.after(result.cleanup)
    expect(result.$('#extra')).toBe(null)
    extra = (
      <a id="extra" href="#extra">
        Extra
      </a>
    )
    await result.act(() => owner!.update())
    await waitFor(() => result.$('#extra') !== null)
    expect((result.$('#docs-content') as HTMLElement).contains(result.$('#extra'))).toBe(true)
  })

  it('shows content inline without a popup', async (t) => {
    let { act, docs, blog, get } = setup(t, { noPopup: true, defaultValue: 'docs', delay: 0 })
    expect(get('docs-content').hasAttribute('hidden')).toBe(false)
    pointer(blog, 'pointerenter')
    await waitFor(() => blog.getAttribute('aria-expanded') === 'true')
    pointer(blog, 'pointerleave', { relatedTarget: get('outside-area') })
    await sleep(80)
    // Without a popup, hover never closes.
    expect(blog.getAttribute('aria-expanded')).toBe('true')
    await act(() => docs.click())
    expect(docs.getAttribute('aria-expanded')).toBe('true')
  })

  it('supports imperative setValue and close on the context', async (t) => {
    addStyle(t, BASE_CSS)
    let menu: navigationMenu.NavigationMenuContextValue | undefined
    let reasons: string[] = []
    function Probe(handle: Handle) {
      menu = handle.context.get(navigationMenu.Context)
      return () => null
    }
    let result = render(
      <navigationMenu.Context onValueChange={(_v, d) => reasons.push(d.reason)}>
        <Probe />
        <ul mix={navigationMenu.list()}>
          <navigationMenu.ItemContext value="a">
            <li>
              <button id="a" mix={navigationMenu.trigger()}>
                A
              </button>
              <navigationMenu.Content>A content</navigationMenu.Content>
            </li>
          </navigationMenu.ItemContext>
        </ul>
        <navigationMenu.Viewport />
      </navigationMenu.Context>,
    )
    t.after(result.cleanup)
    await result.act(() => menu!.setValue('a'))
    expect(menu!.value).toBe('a')
    expect(menu!.open).toBe(true)
    expect(result.$('#a')!.getAttribute('aria-expanded')).toBe('true')
    await result.act(() => menu!.close())
    expect(menu!.value).toBe(null)
    expect(reasons).toEqual(['imperative-action', 'imperative-action'])
  })
})

describe('navigation-menu (nested)', () => {
  function Nested(handle: Handle<{ inline?: boolean }>) {
    return () => (
      <navigationMenu.Context delay={0} closeDelay={0}>
        <nav id="root" mix={navigationMenu.root()}>
          <ul data-test-list mix={navigationMenu.list()}>
            <navigationMenu.ItemContext value="product">
              <li>
                <button id="product" data-test-trigger mix={navigationMenu.trigger()}>
                  Product
                </button>
                <navigationMenu.Content id="product-content">
                  <a id="overview" href="#overview">
                    Overview
                  </a>
                  <navigationMenu.Context
                    orientation="vertical"
                    defaultValue={handle.props.inline ? 'dev' : null}
                  >
                    <div id="sub-root" mix={navigationMenu.root()}>
                      <ul id="sub-list" mix={navigationMenu.list()}>
                        <navigationMenu.ItemContext value="dev">
                          <li>
                            <button id="dev" mix={navigationMenu.trigger()}>
                              Developers
                            </button>
                            <navigationMenu.Content id="dev-content">
                              <a id="dev-link" href="#dev">
                                Dev docs
                              </a>
                            </navigationMenu.Content>
                          </li>
                        </navigationMenu.ItemContext>
                        <navigationMenu.ItemContext value="teams">
                          <li>
                            <button id="teams" mix={navigationMenu.trigger()}>
                              Teams
                            </button>
                            <navigationMenu.Content
                              id="teams-content"
                              style={{ display: 'block', width: '400px' }}
                            >
                              <a id="teams-link" href="#teams">
                                Team docs
                              </a>
                            </navigationMenu.Content>
                          </li>
                        </navigationMenu.ItemContext>
                      </ul>
                      {handle.props.inline ? (
                        <navigationMenu.Viewport id="sub-viewport" />
                      ) : (
                        <div id="sub-popup" mix={navigationMenu.popup({ side: 'right' })}>
                          <navigationMenu.Viewport id="sub-viewport" />
                        </div>
                      )}
                    </div>
                  </navigationMenu.Context>
                </navigationMenu.Content>
              </li>
            </navigationMenu.ItemContext>
            <navigationMenu.ItemContext value="learn">
              <li>
                <button id="learn" data-test-trigger mix={navigationMenu.trigger()}>
                  Learn
                </button>
                <navigationMenu.Content id="learn-content">
                  <a id="learn-link" href="#learn">
                    Guides
                  </a>
                </navigationMenu.Content>
              </li>
            </navigationMenu.ItemContext>
          </ul>
          <div id="popup" data-test-popup mix={navigationMenu.popup()}>
            <navigationMenu.Viewport data-test-viewport />
          </div>
        </nav>
      </navigationMenu.Context>
    )
  }

  function setupNested(t: T, inline = false) {
    addStyle(t, BASE_CSS)
    let result = render(<Nested inline={inline} />)
    t.after(result.cleanup)
    return { ...result, get: (id: string) => result.$(`#${id}`) as HTMLElement }
  }

  it('marks nested roots and renders nested content in the nested viewport', (t) => {
    let { get } = setupNested(t)
    expect(get('root').hasAttribute('data-nested')).toBe(false)
    expect(get('sub-root').getAttribute('data-nested')).toBe('')
    expect(get('sub-root').getAttribute('data-orientation')).toBe('vertical')
    expect(get('sub-viewport').contains(get('dev-content'))).toBe(true)
  })

  it('opens a nested popup and closes it first on Escape', async (t) => {
    let { act, get } = setupNested(t)
    await act(() => get('product').click())
    await act(() => get('dev').click())
    expect(get('dev').getAttribute('aria-expanded')).toBe('true')
    await waitFor(() => isShown(get('sub-popup')))

    get('dev-link').focus()
    await act(() => key(get('dev-link'), 'Escape'))
    expect(get('dev').getAttribute('aria-expanded')).toBe('false')
    expect(get('product').getAttribute('aria-expanded')).toBe('true')
    await waitFor(() => document.activeElement === get('dev'))
  })

  it('keeps the parent open while interacting with the nested popup', async (t) => {
    let { act, get } = setupNested(t)
    await act(() => get('product').click())
    await act(() => get('dev').click())
    await waitFor(() => isShown(get('sub-popup')))
    get('dev-link').focus()
    pointer(get('dev-link'), 'pointerdown')
    await act(() => get('dev-link').click())
    expect(get('product').getAttribute('aria-expanded')).toBe('true')
    expect(get('dev').getAttribute('aria-expanded')).toBe('true')
  })

  it('closes nested popups when the parent switches items', async (t) => {
    let { act, get } = setupNested(t)
    await act(() => get('product').click())
    await act(() => get('dev').click())
    await waitFor(() => isShown(get('sub-popup')))
    await act(() => get('learn').click())
    await waitFor(() => get('dev').getAttribute('aria-expanded') === 'false')
    await waitFor(() => !isShown(get('sub-popup')))
  })

  it('leaves arrow keys of nested triggers to the parent content', async (t) => {
    let { act, get } = setupNested(t)
    await act(() => get('product').click())
    get('overview').focus()
    key(get('overview'), 'ArrowDown')
    expect(document.activeElement).toBe(get('dev'))
    key(get('dev'), 'ArrowDown')
    expect(document.activeElement).toBe(get('teams'))
    // End of the nested list: the parent content takes over (no further tabbables).
    key(get('teams'), 'ArrowUp')
    expect(document.activeElement).toBe(get('dev'))
    // Nested triggers don't open with ArrowRight.
    key(get('dev'), 'ArrowRight')
    await sleep(20)
    expect(get('dev').getAttribute('aria-expanded')).toBe('false')
  })

  it('switches inline nested content on hover and morphs the parent popup', async (t) => {
    let { act, get } = setupNested(t, true)
    await act(() => get('product').click())
    expect(get('dev-content').hasAttribute('hidden')).toBe(false)
    pointer(get('teams'), 'pointerenter')
    await waitFor(() => get('teams').getAttribute('aria-expanded') === 'true')
    await waitFor(() => get('dev-content').hasAttribute('hidden'))
    expect(get('teams-content').hasAttribute('hidden')).toBe(false)
    // The parent menu stays open.
    expect(get('product').getAttribute('aria-expanded')).toBe('true')
    // The parent popup morphs to the new size.
    await waitFor(() => get('popup').style.getPropertyValue('--popup-width') === '400px')
  })
})
