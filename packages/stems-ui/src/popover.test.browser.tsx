// Adapted from @remix-run/ui 0.13.0 (packages/ui/src/popover.test.tsx).
// https://github.com/remix-run/remix - Copyright (c) 2025 Shopify Inc. MIT License.

import { expect } from 'remix/assert'
import { describe, it } from 'remix/test'
import type { Handle, RemixNode } from 'remix/component'
import { render } from 'remix/component/test'

import * as popover from './popover.ts'
import { PopoverChangeEvent, onPopoverChange } from './popover.ts'
import type { PopoverOpenChangeDetails } from './popover.ts'

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
  [data-test-popup] { margin: 0; padding: 0; border: 0; width: 160px; height: 96px; }
  [data-test-trigger] { position: fixed; top: 40px; left: 100px; width: 80px; height: 30px;
    margin: 0; padding: 0; border: 0; box-sizing: border-box; }
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

type HarnessProps = popover.PopoverContextProps & {
  popupOptions?: popover.PopoverPopupOptions
  triggerOptions?: popover.PopoverTriggerOptions
  noArgs?: boolean
  withArrow?: boolean
  withBackdrop?: boolean
  noClose?: boolean
  content?: RemixNode
}

function Harness(handle: Handle<HarnessProps>) {
  return () => {
    let {
      popupOptions,
      triggerOptions,
      noArgs,
      withArrow,
      withBackdrop,
      noClose,
      content,
      children: _children,
      ...props
    } = handle.props
    return (
      <div>
        <popover.Context {...props}>
          <button
            id="trigger"
            data-test-trigger
            mix={noArgs ? popover.trigger() : popover.trigger(triggerOptions)}
          >
            Open
          </button>
          {withBackdrop ? <div id="backdrop" mix={popover.backdrop()} /> : null}
          <div
            id="popup"
            data-test-popup
            mix={noArgs ? popover.popup() : popover.popup(popupOptions)}
          >
            {withArrow ? (
              <div id="arrow" style={{ width: '12px', height: '6px' }} mix={popover.arrow()} />
            ) : null}
            <h2 mix={popover.title()}>Notifications</h2>
            <p mix={popover.description()}>You are all caught up.</p>
            {content ?? (
              <>
                <button id="first">First</button>
                <button id="last">Last</button>
              </>
            )}
            {noClose ? null : (
              <button id="close" mix={popover.close()}>
                Close
              </button>
            )}
          </div>
        </popover.Context>
        <button id="outside">Outside</button>
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
    get,
  }
}

/** A controlled harness whose owner decides the open state. */
function setupControlled(
  t: T,
  options: { open?: boolean; accept?: boolean; props?: HarnessProps } = {},
) {
  addStyle(t, BASE_CSS)
  let state = { open: options.open ?? false }
  let changes: Array<{ open: boolean; details: PopoverOpenChangeDetails }> = []
  let owner: Handle | undefined
  function App(handle: Handle) {
    owner = handle
    return () => (
      <Harness
        {...options.props}
        open={state.open}
        onOpenChange={(open, details) => {
          changes.push({ open, details })
          if (options.accept !== false) {
            state.open = open
            void handle.update()
          }
        }}
      />
    )
  }
  let result = render(<App />)
  t.after(result.cleanup)
  async function setOpen(open: boolean) {
    state.open = open
    await result.act(() => owner!.update())
  }
  return {
    ...result,
    trigger: result.$('#trigger') as HTMLButtonElement,
    popup: result.$('#popup') as HTMLElement,
    get: (id: string) => result.$(`#${id}`) as HTMLElement,
    changes,
    setOpen,
  }
}

describe('popover', () => {
  it('renders ARIA and closed state', (t) => {
    let { trigger, popup, get } = setup(t)

    expect(trigger.getAttribute('type')).toBe('button')
    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog')
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(trigger.getAttribute('aria-controls')).toBe(popup.id)
    expect(trigger.hasAttribute('data-popup-open')).toBe(false)

    expect(popup.getAttribute('popover')).toBe('manual')
    expect(popup.getAttribute('role')).toBe('dialog')
    expect(popup.hasAttribute('hidden')).toBe(true)
    expect(popup.getAttribute('data-closed')).toBe('')
    expect(popup.getAttribute('data-side')).toBe('bottom')
    expect(popup.getAttribute('data-align')).toBe('center')
    expect(popup.getAttribute('aria-modal')).toBe(null)
    expect(isShown(popup)).toBe(false)

    let title = popup.querySelector('h2')!
    let description = popup.querySelector('p')!
    expect(popup.getAttribute('aria-labelledby')).toBe(title.id)
    expect(popup.getAttribute('aria-describedby')).toBe(description.id)
    expect(title.id).not.toBe('')
    expect(get('close').getAttribute('type')).toBe('button')
  })

  it('works with no-argument mixin calls', async (t) => {
    let { act, trigger, popup } = setup(t, { noArgs: true })
    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog')
    expect(popup.getAttribute('role')).toBe('dialog')

    await act(() => trigger.click())
    expect(isShown(popup)).toBe(true)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
  })

  it('shows a manual popover on trigger press and hides it on a second press', async (t) => {
    let showPopover = t.mock.method(HTMLElement.prototype, 'showPopover')
    let hidePopover = t.mock.method(HTMLElement.prototype, 'hidePopover')
    let { act, trigger, popup } = setup(t)

    expect(showPopover).not.toHaveBeenCalled()

    await act(() => trigger.click())
    expect(showPopover).toHaveBeenCalledTimes(1)
    expect(isShown(popup)).toBe(true)
    expect(popup.hasAttribute('hidden')).toBe(false)
    expect(popup.getAttribute('data-open')).toBe('')
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(trigger.getAttribute('data-popup-open')).toBe('')

    // The trigger counts as inside, so the press toggles instead of dismiss-then-reopen.
    await act(() => trigger.click())
    await waitFor(() => !isShown(popup))
    expect(hidePopover).toHaveBeenCalledTimes(1)
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(popup.getAttribute('data-closed')).toBe('')
    await waitFor(() => popup.hasAttribute('hidden'))
  })

  it('opens initially with defaultOpen', async (t) => {
    let { trigger, popup } = setup(t, { defaultOpen: true })
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(popup.getAttribute('data-open')).toBe('')
    await waitFor(() => isShown(popup))
  })

  it('positions against the trigger and only locks scroll when modal', async (t) => {
    let { act, trigger, popup } = setup(t, { popupOptions: { sideOffset: 4 } })

    await act(() => trigger.click())
    expect(popup.style.position).toBe('fixed')
    expect(popup.style.top).toBe('74px')
    // Centered: 100 + (80 - 160) / 2
    expect(popup.style.left).toBe('60px')
    expect(document.documentElement.style.overflow).toBe('')
    expect(popup.style.getPropertyValue('--anchor-width')).toBe('80px')
    expect(popup.style.getPropertyValue('--anchor-height')).toBe('30px')
    expect(popup.style.getPropertyValue('--transform-origin')).toBe('80px -4px')
    expect(popup.style.getPropertyValue('--available-height')).not.toBe('')
    expect(popup.style.getPropertyValue('--available-width')).not.toBe('')
  })

  it('supports side, align, and alignOffset', async (t) => {
    let { act, trigger, popup } = setup(t, {
      popupOptions: { side: 'right', align: 'start', sideOffset: 8, alignOffset: 2 },
    })
    await act(() => trigger.click())
    expect(popup.getAttribute('data-side')).toBe('right')
    expect(popup.getAttribute('data-align')).toBe('start')
    expect(popup.style.left).toBe('188px')
    expect(popup.style.top).toBe('42px')
  })

  it('maps inline-start to the physical side for the text direction', async (t) => {
    let { act, trigger, popup, container } = setup(t, {
      popupOptions: { side: 'inline-start', align: 'center' },
    })
    container.setAttribute('dir', 'rtl')
    addStyle(t, '[data-test-trigger] { left: 300px; }')
    await act(() => trigger.click())
    expect(popup.getAttribute('data-side')).toBe('inline-start')
    // RTL: inline-start is the right side of the trigger.
    expect(popup.style.left).toBe('380px')
  })

  it('reports the flipped side in data-side', async (t) => {
    let { act, trigger, popup, get } = setup(t, {
      withArrow: true,
      popupOptions: { sideOffset: 4 },
    })
    addStyle(t, `[data-test-trigger] { top: ${window.innerHeight - 40}px; }`)

    await act(() => trigger.click())
    expect(popup.getAttribute('data-side')).toBe('top')
    expect(get('arrow').getAttribute('data-side')).toBe('top')
    expect(popup.style.getPropertyValue('--transform-origin')).toBe('80px 100px')
  })

  it('positions the arrow against the anchor center', async (t) => {
    let { act, trigger, get } = setup(t, { withArrow: true })
    await act(() => trigger.click())
    let arrow = get('arrow')
    expect(arrow.getAttribute('aria-hidden')).toBe('true')
    expect(arrow.getAttribute('data-side')).toBe('bottom')
    expect(arrow.getAttribute('data-open')).toBe('')
    expect(arrow.style.position).toBe('absolute')
    // Popup is 160px wide and centered: the arrow (12px) sits at 80 - 6.
    expect(arrow.style.left).toBe('74px')
    expect(arrow.hasAttribute('data-uncentered')).toBe(false)
  })

  it('moves focus to the first tabbable element on open', async (t) => {
    let { act, trigger, get } = setup(t)
    trigger.focus()
    await act(() => trigger.click())
    expect(document.activeElement).toBe(get('first'))
  })

  it('supports initialFocus', async (t) => {
    let { act, trigger, get } = setup(t, { popupOptions: { initialFocus: '#last' } })
    await act(() => trigger.click())
    expect(document.activeElement).toBe(get('last'))
  })

  it('focuses the popup itself when it has no tabbable content', async (t) => {
    let { act, trigger, popup } = setup(t, { content: <span>Static</span>, noClose: true })
    await act(() => trigger.click())
    expect(document.activeElement).toBe(popup)
  })

  it('does not move focus with initialFocus false', async (t) => {
    let { act, trigger } = setup(t, { popupOptions: { initialFocus: false } })
    trigger.focus()
    await act(() => trigger.click())
    expect(document.activeElement).toBe(trigger)
  })

  it('closes on Escape and returns focus to the trigger', async (t) => {
    let details: PopoverOpenChangeDetails[] = []
    let { act, trigger, popup, get } = setup(t, {
      onOpenChange: (_open, d) => details.push(d),
    })
    await act(() => trigger.click())
    expect(document.activeElement).toBe(get('first'))

    let event = key(get('first'), 'Escape')
    await act(() => {})
    expect(event.defaultPrevented).toBe(true)
    expect(details.map((d) => d.reason)).toEqual(['trigger-press', 'escape-key'])
    expect(details[1].event).toBe(event)
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(trigger)
    await waitFor(() => !isShown(popup))
  })

  it('closes on an outside press and returns focus to the trigger', async (t) => {
    let reasons: string[] = []
    let { act, trigger, popup, get } = setup(t, {
      onOpenChange: (_open, d) => reasons.push(d.reason),
    })
    await act(() => trigger.click())

    await act(() => get('outside-area').click())
    expect(reasons).toEqual(['trigger-press', 'outside-press'])
    expect(document.activeElement).toBe(trigger)
    await waitFor(() => !isShown(popup))
  })

  it('leaves focus alone after an outside press on a focusable element', async (t) => {
    let { act, trigger, get } = setup(t)
    await act(() => trigger.click())
    await act(() => get('outside').click())
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).not.toBe(trigger)
  })

  it('does not close when pressing inside the popup', async (t) => {
    let { act, trigger, popup, get } = setup(t)
    await act(() => trigger.click())
    await act(() => get('first').click())
    expect(isShown(popup)).toBe(true)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
  })

  it('closes with the close part', async (t) => {
    let reasons: string[] = []
    let { act, trigger, get } = setup(t, { onOpenChange: (_open, d) => reasons.push(d.reason) })
    await act(() => trigger.click())
    await act(() => get('close').click())
    expect(reasons).toEqual(['trigger-press', 'close-press'])
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(trigger)
  })

  it('can skip restoring focus with finalFocus false', async (t) => {
    let { act, trigger, get } = setup(t, { popupOptions: { finalFocus: false } })
    await act(() => trigger.click())
    get('last').focus()
    await act(() => get('close').click())
    expect(document.activeElement).not.toBe(trigger)
  })

  it('closes when focus moves outside (non-modal)', async (t) => {
    let reasons: string[] = []
    let { act, trigger, get } = setup(t, { onOpenChange: (_open, d) => reasons.push(d.reason) })
    await act(() => trigger.click())
    await act(() => get('outside').focus())
    expect(reasons).toEqual(['trigger-press', 'focus-out'])
    expect(document.activeElement).toBe(get('outside'))
  })

  it('stays open until a controlled owner updates open', async (t) => {
    let { act, trigger, popup, get, changes, setOpen } = setupControlled(t, { accept: false })

    await act(() => trigger.click())
    expect(changes.map((c) => c.open)).toEqual([true])
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(isShown(popup)).toBe(false)

    await setOpen(true)
    expect(isShown(popup)).toBe(true)

    key(get('first'), 'Escape')
    await act(() => {})
    expect(changes.map((c) => c.details.reason)).toEqual(['trigger-press', 'escape-key'])
    expect(isShown(popup)).toBe(true)

    await setOpen(false)
    await waitFor(() => !isShown(popup))
  })

  it('supports controlled state', async (t) => {
    let { act, trigger, popup, changes } = setupControlled(t)
    await act(() => trigger.click())
    expect(isShown(popup)).toBe(true)
    expect(changes[0].details.trigger).toBe(trigger)
    await act(() => trigger.click())
    expect(changes.map((c) => c.open)).toEqual([true, false])
    await waitFor(() => !isShown(popup))
  })

  it('lets onOpenChange cancel a change', async (t) => {
    let { act, trigger, popup } = setup(t, {
      onOpenChange: (open, details) => {
        if (!open && details.reason === 'outside-press') details.cancel()
      },
    })
    await act(() => trigger.click())
    await act(() => document.getElementById('outside-area')!.click())
    expect(isShown(popup)).toBe(true)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
  })

  it('dispatches a bubbling stems:popover-change event', async (t) => {
    let events: PopoverChangeEvent[] = []
    function App() {
      return () => (
        <div mix={onPopoverChange((event) => void events.push(event))}>
          <Harness />
        </div>
      )
    }
    addStyle(t, BASE_CSS)
    let result = render(<App />)
    t.after(result.cleanup)
    let trigger = result.$('#trigger') as HTMLElement
    await result.act(() => trigger.click())
    await result.act(() => trigger.click())
    expect(events.length).toBe(2)
    expect(events[0]).toBeInstanceOf(PopoverChangeEvent)
    expect(events.map((e) => [e.open, e.reason])).toEqual([
      [true, 'trigger-press'],
      [false, 'trigger-press'],
    ])
  })

  it('keeps the popup shown until its exit animation finishes', async (t) => {
    let { act, trigger, popup } = setup(t)
    addStyle(
      t,
      `[data-test-popup] { transition: opacity 120ms; }
       [data-test-popup][data-starting-style], [data-test-popup][data-ending-style] { opacity: 0; }`,
    )
    await act(() => trigger.click())
    await waitFor(() => !popup.hasAttribute('data-starting-style'))
    // Let the enter transition finish so the exit has something to animate.
    await waitFor(() => popup.getAnimations().length === 0)

    let completed: boolean[] = []
    popup.addEventListener('transitionend', () => completed.push(true))
    await act(() => trigger.click())
    expect(popup.getAttribute('data-closed')).toBe('')
    expect(popup.getAttribute('data-ending-style')).toBe('')
    await nextFrame()
    expect(isShown(popup)).toBe(true)

    await waitFor(() => !isShown(popup))
    expect(completed.length).toBeGreaterThan(0)
    await waitFor(() => popup.hasAttribute('hidden'))
    expect(popup.hasAttribute('data-ending-style')).toBe(false)
  })

  it('calls onOpenChangeComplete after animations', async (t) => {
    let completes: boolean[] = []
    let { act, trigger } = setup(t, { onOpenChangeComplete: (open) => completes.push(open) })
    await act(() => trigger.click())
    await waitFor(() => completes.length === 1)
    await act(() => trigger.click())
    await waitFor(() => completes.length === 2)
    expect(completes).toEqual([true, false])
  })

  describe('modal', () => {
    it('modal: traps focus, locks scroll, and makes outside content inert', async (t) => {
      let { act, trigger, popup, get } = setup(t, { modal: true })
      await act(() => trigger.click())

      expect(popup.getAttribute('aria-modal')).toBe('true')
      expect(document.documentElement.style.overflow).toBe('hidden')
      expect(get('outside').hasAttribute('inert')).toBe(true)
      expect(trigger.hasAttribute('inert')).toBe(true)
      expect(popup.hasAttribute('inert')).toBe(false)

      get('close').focus()
      let forward = key(get('close'), 'Tab')
      expect(forward.defaultPrevented).toBe(true)
      expect(document.activeElement).toBe(get('first'))

      let backward = key(get('first'), 'Tab', { shiftKey: true })
      expect(backward.defaultPrevented).toBe(true)
      expect(document.activeElement).toBe(get('close'))

      get('first').focus()
      let middle = key(get('first'), 'Tab')
      expect(middle.defaultPrevented).toBe(false)

      // Focus can't leave, so focus-out doesn't close it.
      key(get('close'), 'Escape')
      await act(() => {})
      expect(document.documentElement.style.overflow).toBe('')
      expect(get('outside').hasAttribute('inert')).toBe(false)
      expect(trigger.hasAttribute('inert')).toBe(false)
      expect(document.activeElement).toBe(trigger)
    })

    it("'trap-focus' traps focus without scroll lock or inert", async (t) => {
      let { act, trigger, popup, get } = setup(t, { modal: 'trap-focus' })
      await act(() => trigger.click())
      expect(popup.getAttribute('aria-modal')).toBe(null)
      expect(document.documentElement.style.overflow).toBe('')
      expect(get('outside').hasAttribute('inert')).toBe(false)

      get('close').focus()
      key(get('close'), 'Tab')
      expect(document.activeElement).toBe(get('first'))

      // Focus moving out doesn't close a focus-trapped popover.
      await act(() => get('outside').focus())
      expect(trigger.getAttribute('aria-expanded')).toBe('true')
    })
  })

  describe('backdrop', () => {
    it('shows the backdrop in the top layer below the popup', async (t) => {
      let { act, trigger, popup, get } = setup(t, { withBackdrop: true })
      let backdrop = get('backdrop')
      expect(backdrop.getAttribute('role')).toBe('presentation')
      expect(backdrop.hasAttribute('hidden')).toBe(true)
      expect(backdrop.getAttribute('data-closed')).toBe('')

      await act(() => trigger.click())
      expect(isShown(backdrop)).toBe(true)
      expect(isShown(popup)).toBe(true)
      expect(backdrop.getAttribute('data-open')).toBe('')

      // A press on the backdrop is an outside press.
      await act(() => backdrop.click())
      expect(trigger.getAttribute('aria-expanded')).toBe('false')
      await waitFor(() => !isShown(backdrop) && !isShown(popup))
      await waitFor(() => backdrop.hasAttribute('hidden'))
    })
  })

  describe('hover', () => {
    it('opens on hover after the delay and closes when the pointer leaves', async (t) => {
      let reasons: string[] = []
      let { act, trigger, popup } = setup(t, {
        triggerOptions: { openOnHover: true, delay: 20 },
        onOpenChange: (_open, d) => reasons.push(d.reason),
      })
      trigger.focus()
      pointer(trigger, 'pointerenter')
      await sleep(5)
      expect(isShown(popup)).toBe(false)
      await sleep(40)
      await act(() => {})
      expect(isShown(popup)).toBe(true)
      expect(reasons).toEqual(['trigger-hover'])
      // Hover-opened popovers don't steal focus.
      expect(document.activeElement).toBe(trigger)

      pointer(trigger, 'pointerleave', { relatedTarget: document.body })
      await sleep(20)
      await act(() => {})
      expect(reasons).toEqual(['trigger-hover', 'trigger-hover'])
      expect(trigger.getAttribute('aria-expanded')).toBe('false')
    })

    it('stays open while the pointer is over the popup', async (t) => {
      let { act, trigger, popup } = setup(t, {
        triggerOptions: { openOnHover: true, delay: 0, closeDelay: 30 },
      })
      pointer(trigger, 'pointerenter')
      await sleep(10)
      await act(() => {})
      expect(isShown(popup)).toBe(true)

      pointer(trigger, 'pointerleave', { relatedTarget: popup })
      pointer(popup, 'pointerenter', { relatedTarget: trigger })
      await sleep(60)
      await act(() => {})
      expect(trigger.getAttribute('aria-expanded')).toBe('true')

      pointer(popup, 'pointerleave', { relatedTarget: document.body })
      await sleep(60)
      await act(() => {})
      expect(trigger.getAttribute('aria-expanded')).toBe('false')
    })

    it('stays open after pressing the trigger of a hover-opened popover', async (t) => {
      let { act, trigger } = setup(t, { triggerOptions: { openOnHover: true, delay: 0 } })
      pointer(trigger, 'pointerenter')
      await sleep(10)
      await act(() => {})
      expect(trigger.getAttribute('aria-expanded')).toBe('true')

      await act(() => trigger.click())
      expect(trigger.getAttribute('aria-expanded')).toBe('true')
      pointer(trigger, 'pointerleave', { relatedTarget: document.body })
      await sleep(20)
      await act(() => {})
      expect(trigger.getAttribute('aria-expanded')).toBe('true')
    })
  })

  describe('nested popovers', () => {
    function Nested() {
      return () => (
        <div>
          <popover.Context>
            <button id="outer-trigger" mix={popover.trigger()}>
              Outer
            </button>
            <div id="outer" data-test-popup mix={popover.popup()}>
              <button id="outer-inside">Outer inside</button>
              <popover.Context>
                <button id="inner-trigger" mix={popover.trigger()}>
                  Inner
                </button>
                <div id="inner" mix={popover.popup({ side: 'right' })}>
                  <button id="inner-inside">Inner inside</button>
                </div>
              </popover.Context>
            </div>
          </popover.Context>
          <div id="away">Away</div>
        </div>
      )
    }

    async function open(t: T) {
      addStyle(t, BASE_CSS)
      let result = render(<Nested />)
      t.after(result.cleanup)
      let get = (id: string) => result.$(`#${id}`) as HTMLElement
      await result.act(() => get('outer-trigger').click())
      await result.act(() => get('inner-trigger').click())
      expect(isShown(get('outer'))).toBe(true)
      expect(isShown(get('inner'))).toBe(true)
      return { ...result, get }
    }

    it('Escape closes only the innermost popover', async (t) => {
      let { act, get } = await open(t)
      expect(document.activeElement).toBe(get('inner-inside'))

      key(get('inner-inside'), 'Escape')
      await act(() => {})
      expect(get('inner-trigger').getAttribute('aria-expanded')).toBe('false')
      expect(get('outer-trigger').getAttribute('aria-expanded')).toBe('true')
      expect(document.activeElement).toBe(get('inner-trigger'))

      key(get('inner-trigger'), 'Escape')
      await act(() => {})
      expect(get('outer-trigger').getAttribute('aria-expanded')).toBe('false')
    })

    it('an outside press closes both', async (t) => {
      let { act, get } = await open(t)
      await act(() => get('away').click())
      expect(get('inner-trigger').getAttribute('aria-expanded')).toBe('false')
      expect(get('outer-trigger').getAttribute('aria-expanded')).toBe('false')
    })

    it('a press inside the parent closes only the child', async (t) => {
      let { act, get } = await open(t)
      await act(() => get('outer-inside').click())
      expect(get('inner-trigger').getAttribute('aria-expanded')).toBe('false')
      expect(get('outer-trigger').getAttribute('aria-expanded')).toBe('true')
    })

    it('a press inside the child keeps both open', async (t) => {
      let { act, get } = await open(t)
      await act(() => get('inner-inside').click())
      expect(get('inner-trigger').getAttribute('aria-expanded')).toBe('true')
      expect(get('outer-trigger').getAttribute('aria-expanded')).toBe('true')
    })
  })

  describe('multiple triggers', () => {
    it('anchors to and reports the trigger that opened it', async (t) => {
      addStyle(t, BASE_CSS)
      let result = render(
        <popover.Context>
          <button id="a" mix={popover.trigger()}>
            A
          </button>
          <button id="b" mix={popover.trigger()}>
            B
          </button>
          <div id="popup" data-test-popup mix={popover.popup()}>
            <button>Inside</button>
          </div>
        </popover.Context>,
      )
      t.after(result.cleanup)
      let a = result.$('#a')!
      let b = result.$('#b')!
      await result.act(() => b.click())
      expect(b.getAttribute('aria-expanded')).toBe('true')
      expect(a.getAttribute('aria-expanded')).toBe('false')

      key(document.activeElement!, 'Escape')
      await result.act(() => {})
      expect(document.activeElement).toBe(b)
    })
  })
})

describe('popover detached triggers', () => {
  const DETACHED_CSS = `
    [data-test-popup] { margin: 0; padding: 0; border: 0; width: 160px; height: 96px; }
    .detached { position: fixed; top: 40px; width: 80px; height: 30px; margin: 0; padding: 0;
      border: 0; box-sizing: border-box; }
    #t1 { left: 20px; } #t2 { left: 300px; }
  `

  function setupDetached(
    t: T,
    options: { rootFirst?: boolean; mountRoot?: boolean; props?: popover.PopoverContextProps } = {},
  ) {
    addStyle(t, DETACHED_CSS)
    let h = popover.createHandle<{ label: string }>()
    let state = { mountRoot: options.mountRoot ?? true }
    let owner: Handle | undefined
    function App(handle: Handle) {
      owner = handle
      return () => {
        let triggers = (
          <div>
            <button
              id="t1"
              class="detached"
              mix={popover.trigger({ handle: h, payload: { label: 'One' } })}
            >
              One
            </button>
            <button
              id="t2"
              class="detached"
              mix={popover.trigger({ handle: h, payload: { label: 'Two' } })}
            >
              Two
            </button>
          </div>
        )
        let root = state.mountRoot ? (
          <popover.Context handle={h} {...options.props}>
            {({ payload }) => (
              <div id="popup" data-test-popup mix={popover.popup()}>
                <p id="payload">{payload ? (payload as { label: string }).label : 'none'}</p>
                <button id="inside">Inside</button>
              </div>
            )}
          </popover.Context>
        ) : null
        return (
          <div>
            {options.rootFirst ? root : null}
            {triggers}
            {options.rootFirst ? null : root}
            <button id="outside">Outside</button>
          </div>
        )
      }
    }
    let result = render(<App />)
    t.after(result.cleanup)
    let get = (id: string) => result.$(`#${id}`) as HTMLElement
    return {
      ...result,
      h,
      get,
      t1: get('t1'),
      t2: get('t2'),
      async setRoot(mounted: boolean) {
        state.mountRoot = mounted
        await result.act(() => owner!.update())
        await result.act(() => {})
      },
    }
  }

  it('wires ARIA to the popup once the Context renders', async (t) => {
    let { t1, t2, get, act } = setupDetached(t)
    await act(() => {})
    let popup = get('popup')
    for (let trigger of [t1, t2]) {
      expect(trigger.getAttribute('type')).toBe('button')
      expect(trigger.getAttribute('aria-haspopup')).toBe('dialog')
      expect(trigger.getAttribute('aria-expanded')).toBe('false')
      expect(trigger.getAttribute('aria-controls')).toBe(popup.id)
      expect(trigger.hasAttribute('data-popup-open')).toBe(false)
    }
  })

  it('opens and closes from a trigger outside the Context', async (t) => {
    let { t1, t2, get, act, h } = setupDetached(t)
    await act(() => t1.click())
    let popup = get('popup')
    expect(isShown(popup)).toBe(true)
    expect(h.isOpen).toBe(true)
    expect(t1.getAttribute('aria-expanded')).toBe('true')
    expect(t1.hasAttribute('data-popup-open')).toBe(true)
    expect(t2.getAttribute('aria-expanded')).toBe('false')
    expect(get('payload').textContent).toBe('One')

    await act(() => t1.click())
    await waitFor(() => !isShown(popup))
    expect(h.isOpen).toBe(false)
    expect(t1.getAttribute('aria-expanded')).toBe('false')
    expect(t1.hasAttribute('data-popup-open')).toBe(false)
  })

  it('switches the payload and the anchor to the pressed trigger', async (t) => {
    let { t1, t2, get, act } = setupDetached(t)
    await act(() => t1.click())
    let popup = get('popup')
    await waitFor(() => Math.abs(popup.getBoundingClientRect().left - 0) < 40)
    let left1 = popup.getBoundingClientRect().left

    await act(() => t2.click())
    await act(() => {})
    expect(isShown(popup)).toBe(true)
    expect(get('payload').textContent).toBe('Two')
    expect(t2.getAttribute('aria-expanded')).toBe('true')
    expect(t1.getAttribute('aria-expanded')).toBe('false')
    await waitFor(() => popup.getBoundingClientRect().left > left1 + 200)
    // Centered under #t2 (300 + 40 - 80).
    expect(Math.round(popup.getBoundingClientRect().left)).toBe(260)
    expect(Math.round(popup.getBoundingClientRect().top)).toBe(70)
  })

  it('returns focus to the detached trigger and treats it as inside', async (t) => {
    let { t2, get, act } = setupDetached(t)
    t2.focus()
    await act(() => t2.click())
    let popup = get('popup')
    expect(popup.contains(document.activeElement)).toBe(true)

    // A press on another detached trigger is not an outside press.
    pointer(get('t1'), 'pointerdown')
    await act(() => {})
    expect(isShown(popup)).toBe(true)

    key(document.activeElement!, 'Escape')
    await act(() => {})
    expect(document.activeElement).toBe(t2)
    expect(t2.getAttribute('aria-expanded')).toBe('false')
  })

  it('opens and closes imperatively with the handle', async (t) => {
    let changes: Array<{ open: boolean; reason: string; trigger?: string }> = []
    let { h, t2, get, act } = setupDetached(t, {
      props: {
        onOpenChange: (open, details) =>
          changes.push({ open, reason: details.reason, trigger: details.trigger?.id }),
      },
    })
    await act(() => h.open('t2'))
    await act(() => {})
    expect(isShown(get('popup'))).toBe(true)
    expect(get('payload').textContent).toBe('Two')
    expect(t2.getAttribute('aria-expanded')).toBe('true')
    expect(changes).toEqual([{ open: true, reason: 'imperative-action', trigger: 't2' }])

    await act(() => h.open('t1'))
    await act(() => {})
    expect(get('payload').textContent).toBe('One')

    await act(() => h.close())
    await act(() => {})
    expect(h.isOpen).toBe(false)
    expect(changes.at(-1)).toEqual({ open: false, reason: 'imperative-action', trigger: 't1' })
  })

  it('works when the Context renders before the triggers', async (t) => {
    let { t1, get, act } = setupDetached(t, { rootFirst: true })
    await act(() => {})
    expect(t1.getAttribute('aria-controls')).toBe(get('popup').id)
    await act(() => t1.click())
    expect(isShown(get('popup'))).toBe(true)
    expect(get('payload').textContent).toBe('One')
  })

  it('is inert until a Context attaches, and ignores imperative calls meanwhile', async (t) => {
    let { t1, h, act, setRoot, get } = setupDetached(t, { mountRoot: false })
    await act(() => {})
    expect(t1.getAttribute('aria-expanded')).toBe('false')
    expect(t1.hasAttribute('aria-controls')).toBe(false)
    h.open('t1')
    await act(() => t1.click())
    expect(h.isOpen).toBe(false)
    expect(t1.getAttribute('aria-expanded')).toBe('false')

    await setRoot(true)
    expect(t1.getAttribute('aria-controls')).toBe(get('popup').id)
    // A fresh root doesn't replay earlier calls.
    expect(h.isOpen).toBe(false)
    await act(() => t1.click())
    expect(h.isOpen).toBe(true)

    await setRoot(false)
    expect(h.isOpen).toBe(false)
    expect(t1.getAttribute('aria-expanded')).toBe('false')
    expect(t1.hasAttribute('aria-controls')).toBe(false)
  })

  it('supports a controlled triggerId', async (t) => {
    addStyle(t, DETACHED_CSS)
    let h = popover.createHandle()
    let result = render(
      <div>
        <button id="t1" class="detached" mix={popover.trigger({ handle: h, payload: 1 })} />
        <button id="t2" class="detached" mix={popover.trigger({ handle: h, payload: 2 })} />
        <popover.Context handle={h} open triggerId="t2">
          {({ payload }) => (
            <div id="popup" data-test-popup mix={popover.popup()}>
              {String(payload)}
            </div>
          )}
        </popover.Context>
      </div>,
    )
    t.after(result.cleanup)
    await result.act(() => {})
    await result.act(() => {})
    let popup = result.$('#popup') as HTMLElement
    expect(isShown(popup)).toBe(true)
    expect(popup.textContent).toBe('2')
    expect(result.$('#t2')!.getAttribute('aria-expanded')).toBe('true')
    expect(result.$('#t1')!.getAttribute('aria-expanded')).toBe('false')
    await waitFor(() => Math.round(popup.getBoundingClientRect().left) === 260)
  })

  it('accepts a payload from a trigger inside the Context', async (t) => {
    let result = render(
      <popover.Context>
        {({ payload }) => (
          <>
            <button id="a" mix={popover.trigger({ payload: 'A' })} />
            <button id="b" mix={popover.trigger({ payload: 'B' })} />
            <div id="popup" mix={popover.popup()}>
              {String(payload)}
            </div>
          </>
        )}
      </popover.Context>,
    )
    t.after(result.cleanup)
    await result.act(() => (result.$('#b') as HTMLElement).click())
    expect(result.$('#popup')!.textContent).toBe('B')
    await result.act(() => (result.$('#a') as HTMLElement).click())
    expect(result.$('#popup')!.textContent).toBe('A')
  })

  it('calls trigger() without arguments outside a Context', async (t) => {
    let result = render(<button id="lonely" mix={popover.trigger()} />)
    t.after(result.cleanup)
    let button = result.$('#lonely') as HTMLElement
    expect(button.getAttribute('aria-expanded')).toBe('false')
    await result.act(() => button.click())
    expect(button.getAttribute('aria-expanded')).toBe('false')
  })
})
