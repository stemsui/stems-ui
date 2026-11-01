import { expect } from 'remix/assert'
import { describe, it } from 'remix/test'
import type { Handle, RemixNode } from 'remix/component'
import { render } from 'remix/component/test'

import * as popover from './popover.ts'
import * as tooltip from './tooltip.ts'
import { TooltipChangeEvent, onTooltipChange } from './tooltip.ts'
import type { TooltipOpenChangeDetails } from './tooltip.ts'

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
  [data-test-popup] { margin: 0; padding: 0; border: 0; width: 80px; height: 24px; }
  [data-test-trigger] { position: fixed; top: 100px; width: 60px; height: 30px;
    margin: 0; padding: 0; border: 0; box-sizing: border-box; }
  #trigger, #a { left: 100px; } #b { left: 200px; } #c { left: 300px; }
`

function isShown(element: HTMLElement) {
  return element.matches(':popover-open')
}

function key(target: Element, value: string) {
  let event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: value })
  target.dispatchEvent(event)
  return event
}

function pointer(target: Element, type: string, init: PointerEventInit = {}) {
  target.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerType: 'mouse', ...init }))
}

function isOpen(trigger: HTMLElement) {
  return trigger.hasAttribute('data-popup-open')
}

type HarnessProps = tooltip.TooltipContextProps & {
  triggerOptions?: tooltip.TooltipTriggerOptions
  popupOptions?: tooltip.TooltipPopupOptions
  noArgs?: boolean
}

function Harness(handle: Handle<HarnessProps>) {
  return () => {
    let { triggerOptions, popupOptions, noArgs, children: _children, ...props } = handle.props
    return (
      <div>
        <tooltip.Context {...props}>
          <button
            id="trigger"
            data-test-trigger
            aria-label="Bold"
            mix={noArgs ? tooltip.trigger() : tooltip.trigger(triggerOptions)}
          >
            B
          </button>
          <div
            id="popup"
            data-test-popup
            mix={noArgs ? tooltip.popup() : tooltip.popup(popupOptions)}
          >
            <span id="arrow" style={{ width: '8px', height: '4px' }} mix={tooltip.arrow()} />
            Bold
          </div>
        </tooltip.Context>
        <input id="outside" />
      </div>
    )
  }
}

function setup(t: T, props: HarnessProps = {}) {
  addStyle(t, BASE_CSS)
  let result = render(<Harness {...props} />)
  t.after(result.cleanup)
  let get = (id: string) => result.$(`#${id}`) as HTMLElement
  return { ...result, trigger: get('trigger') as HTMLButtonElement, popup: get('popup'), get }
}

async function hoverOpen(act: (fn: () => void) => Promise<void>, trigger: HTMLElement) {
  pointer(trigger, 'pointerenter')
  await waitFor(() => isOpen(trigger))
  await act(() => {})
}

describe('tooltip', () => {
  it('renders closed state without popup-button ARIA', (t) => {
    let { trigger, popup, get } = setup(t)

    expect(trigger.getAttribute('aria-haspopup')).toBe(null)
    expect(trigger.getAttribute('aria-expanded')).toBe(null)
    expect(trigger.getAttribute('aria-describedby')).toBe(null)
    expect(trigger.getAttribute('role')).toBe(null)
    expect(trigger.hasAttribute('data-popup-open')).toBe(false)
    expect(trigger.hasAttribute('data-trigger-disabled')).toBe(false)

    expect(popup.getAttribute('role')).toBe('tooltip')
    expect(popup.getAttribute('popover')).toBe('manual')
    expect(popup.hasAttribute('hidden')).toBe(true)
    expect(popup.getAttribute('data-closed')).toBe('')
    expect(popup.getAttribute('data-side')).toBe('top')
    expect(popup.getAttribute('data-align')).toBe('center')
    expect(popup.hasAttribute('data-instant')).toBe(false)
    expect(get('arrow').getAttribute('aria-hidden')).toBe('true')
    expect(get('arrow').getAttribute('data-side')).toBe('top')
  })

  it('opens on hover after the delay and closes when the pointer leaves', async (t) => {
    let changes: Array<[boolean, string]> = []
    let { act, trigger, popup, get } = setup(t, {
      triggerOptions: { delay: 40 },
      onOpenChange: (open, details) => changes.push([open, details.reason]),
    })

    pointer(trigger, 'pointerenter')
    await sleep(15)
    expect(isShown(popup)).toBe(false)
    await waitFor(() => isOpen(trigger))
    await act(() => {})
    expect(changes).toEqual([[true, 'trigger-hover']])
    expect(isShown(popup)).toBe(true)
    expect(popup.hasAttribute('hidden')).toBe(false)
    expect(popup.getAttribute('data-open')).toBe('')
    expect(get('arrow').getAttribute('data-open')).toBe('')
    expect(popup.hasAttribute('data-instant')).toBe(false)

    // The popup sits above the trigger.
    let triggerRect = trigger.getBoundingClientRect()
    let popupRect = popup.getBoundingClientRect()
    expect(popupRect.bottom <= triggerRect.top + 1).toBe(true)

    pointer(trigger, 'pointerleave', { relatedTarget: document.body })
    await waitFor(() => !isOpen(trigger))
    expect(changes).toEqual([
      [true, 'trigger-hover'],
      [false, 'trigger-hover'],
    ])
    await waitFor(() => !isShown(popup) && popup.hasAttribute('hidden'))
    expect(popup.getAttribute('data-closed')).toBe('')
  })

  it('cancels a pending hover open when the pointer leaves first', async (t) => {
    let { trigger, popup } = setup(t, { triggerOptions: { delay: 30 } })
    pointer(trigger, 'pointerenter')
    await sleep(10)
    pointer(trigger, 'pointerleave', { relatedTarget: document.body })
    await sleep(50)
    expect(isOpen(trigger)).toBe(false)
    expect(isShown(popup)).toBe(false)
  })

  it('defaults to a 600ms hover delay', async (t) => {
    let { trigger } = setup(t)
    pointer(trigger, 'pointerenter')
    await sleep(300)
    expect(isOpen(trigger)).toBe(false)
    await waitFor(() => isOpen(trigger), 1000)
  })

  it('ignores touch pointers', async (t) => {
    let { trigger } = setup(t, { triggerOptions: { delay: 0 } })
    pointer(trigger, 'pointerenter', { pointerType: 'touch' })
    await sleep(30)
    expect(isOpen(trigger)).toBe(false)
  })

  it('stays open while the pointer is over the popup (hoverable popup)', async (t) => {
    let { act, trigger, popup } = setup(t, { triggerOptions: { delay: 0, closeDelay: 30 } })
    await hoverOpen(act, trigger)

    pointer(trigger, 'pointerleave', { relatedTarget: popup })
    pointer(popup, 'pointerenter', { relatedTarget: trigger })
    await sleep(60)
    expect(isOpen(trigger)).toBe(true)

    pointer(popup, 'pointerleave', { relatedTarget: document.body })
    await waitFor(() => !isOpen(trigger))
  })

  it('closes when the pointer moves to the popup with disableHoverablePopup', async (t) => {
    let { act, trigger, popup } = setup(t, {
      disableHoverablePopup: true,
      triggerOptions: { delay: 0 },
    })
    await hoverOpen(act, trigger)

    pointer(trigger, 'pointerleave', { relatedTarget: popup })
    pointer(popup, 'pointerenter', { relatedTarget: trigger })
    await waitFor(() => !isOpen(trigger))
  })

  it('honors closeDelay', async (t) => {
    let { act, trigger } = setup(t, { triggerOptions: { delay: 0, closeDelay: 60 } })
    await hoverOpen(act, trigger)
    pointer(trigger, 'pointerleave', { relatedTarget: document.body })
    await sleep(25)
    expect(isOpen(trigger)).toBe(true)
    await waitFor(() => !isOpen(trigger))
  })

  it('opens instantly on keyboard focus and closes on blur, without moving focus', async (t) => {
    let changes: Array<[boolean, string]> = []
    let { act, trigger, popup, get } = setup(t, {
      onOpenChange: (open, details) => changes.push([open, details.reason]),
    })

    await act(() => trigger.focus())
    expect(trigger.matches(':focus-visible')).toBe(true)
    expect(changes).toEqual([[true, 'trigger-focus']])
    expect(isOpen(trigger)).toBe(true)
    await waitFor(() => isShown(popup))
    expect(document.activeElement).toBe(trigger)
    expect(popup.getAttribute('data-instant')).toBe('focus')
    expect(get('arrow').getAttribute('data-instant')).toBe('focus')

    await act(() => get('outside').focus())
    await waitFor(() => !isOpen(trigger))
    expect(changes).toEqual([
      [true, 'trigger-focus'],
      [false, 'trigger-focus'],
    ])
    expect(document.activeElement).toBe(get('outside'))
  })

  it('does not open on focus that is not focus-visible', async (t) => {
    let { trigger } = setup(t)
    // A focus event on an element that isn't focused never matches :focus-visible.
    trigger.dispatchEvent(new FocusEvent('focus'))
    await sleep(20)
    expect(isOpen(trigger)).toBe(false)
  })

  it('never takes focus when opened by hover', async (t) => {
    let { act, trigger, get } = setup(t, { triggerOptions: { delay: 0 } })
    let input = get('outside') as HTMLInputElement
    input.focus()
    await hoverOpen(act, trigger)
    await nextFrame()
    expect(document.activeElement).toBe(input)
  })

  it('never takes focus when open by default', async (t) => {
    let input = document.createElement('input')
    document.body.append(input)
    t.after(() => input.remove())
    input.focus()
    let { trigger, popup } = setup(t, { defaultOpen: true })
    await waitFor(() => isShown(popup))
    await nextFrame()
    expect(isOpen(trigger)).toBe(true)
    expect(document.activeElement).toBe(input)
  })

  it('closes on Escape (reason escape-key, data-instant="dismiss")', async (t) => {
    let reasons: string[] = []
    let { act, trigger, popup } = setup(t, {
      triggerOptions: { delay: 0 },
      onOpenChange: (_open, details) => reasons.push(details.reason),
    })
    await hoverOpen(act, trigger)

    let event = key(document.body, 'Escape')
    await act(() => {})
    expect(event.defaultPrevented).toBe(true)
    expect(isOpen(trigger)).toBe(false)
    expect(reasons).toEqual(['trigger-hover', 'escape-key'])
    expect(popup.getAttribute('data-instant')).toBe('dismiss')
  })

  it('closes on an outside press', async (t) => {
    let reasons: string[] = []
    let { act, trigger, get } = setup(t, {
      triggerOptions: { delay: 0 },
      onOpenChange: (_open, details) => reasons.push(details.reason),
    })
    await hoverOpen(act, trigger)
    await act(() => {
      pointer(get('outside'), 'pointerdown')
      get('outside').click()
    })
    expect(isOpen(trigger)).toBe(false)
    expect(reasons.at(-1)).toBe('outside-press')
  })

  it('closes when the trigger is pressed and cancels a pending open', async (t) => {
    let reasons: string[] = []
    let { act, trigger, popup } = setup(t, {
      triggerOptions: { delay: 0 },
      onOpenChange: (_open, details) => reasons.push(details.reason),
    })
    await hoverOpen(act, trigger)
    await act(() => {
      pointer(trigger, 'pointerdown')
      trigger.click()
    })
    expect(isOpen(trigger)).toBe(false)
    expect(reasons).toEqual(['trigger-hover', 'trigger-press'])
    expect(popup.getAttribute('data-instant')).toBe('dismiss')

    // Pressing before the delay elapses cancels the open.
    pointer(trigger, 'pointerleave', { relatedTarget: document.body })
    reasons.length = 0
    let slow = setup(t, { triggerOptions: { delay: 30 } })
    pointer(slow.trigger, 'pointerenter')
    pointer(slow.trigger, 'pointerdown')
    await sleep(50)
    expect(isOpen(slow.trigger)).toBe(false)
  })

  it('stays open on press with closeOnClick: false', async (t) => {
    let { act, trigger } = setup(t, { triggerOptions: { delay: 0, closeOnClick: false } })
    await hoverOpen(act, trigger)
    await act(() => {
      pointer(trigger, 'pointerdown')
      trigger.click()
    })
    expect(isOpen(trigger)).toBe(true)
  })

  it('Escape inside an open popover closes only the tooltip', async (t) => {
    addStyle(t, BASE_CSS)
    let popoverChanges: string[] = []
    function App() {
      return () => (
        <popover.Context
          defaultOpen
          onOpenChange={(open, details) => popoverChanges.push(`${open}:${details.reason}`)}
        >
          <button id="popover-trigger" mix={popover.trigger()}>
            Open
          </button>
          <div id="popover" mix={popover.popup()}>
            <tooltip.Context>
              <button id="tip-trigger" mix={tooltip.trigger()}>
                Info
              </button>
              <div id="tip" mix={tooltip.popup()}>
                Hint
              </div>
            </tooltip.Context>
          </div>
        </popover.Context>
      )
    }
    let result = render(<App />)
    t.after(result.cleanup)
    let popoverPopup = result.$('#popover') as HTMLElement
    let tipTrigger = result.$('#tip-trigger') as HTMLElement
    let tip = result.$('#tip') as HTMLElement
    await waitFor(() => isShown(popoverPopup))

    await result.act(() => tipTrigger.focus())
    await waitFor(() => isShown(tip))
    expect(isOpen(tipTrigger)).toBe(true)

    await result.act(() => key(tipTrigger, 'Escape'))
    expect(isOpen(tipTrigger)).toBe(false)
    expect(isShown(popoverPopup)).toBe(true)
    expect(popoverChanges).toEqual([])

    // The next Escape closes the popover.
    await result.act(() => key(tipTrigger, 'Escape'))
    expect(popoverChanges).toEqual(['false:escape-key'])
  })

  it('Escape inside a modal <dialog> closes only the tooltip', async (t) => {
    addStyle(t, BASE_CSS)
    function App() {
      return () => (
        <dialog id="dialog">
          <tooltip.Context>
            <button id="tip-trigger" mix={tooltip.trigger()}>
              Info
            </button>
            <div id="tip" mix={tooltip.popup()}>
              Hint
            </div>
          </tooltip.Context>
        </dialog>
      )
    }
    let result = render(<App />)
    t.after(result.cleanup)
    let dialog = result.$('#dialog') as HTMLDialogElement
    let tipTrigger = result.$('#tip-trigger') as HTMLElement
    dialog.showModal()
    t.after(() => dialog.close())
    await result.act(() => tipTrigger.focus())
    await waitFor(() => isOpen(tipTrigger))

    let event = key(tipTrigger, 'Escape')
    await result.act(() => {})
    expect(event.defaultPrevented).toBe(true)
    expect(isOpen(tipTrigger)).toBe(false)
    expect(dialog.open).toBe(true)
  })

  describe('controlled', () => {
    it('follows the open prop and reports changes', async (t) => {
      addStyle(t, BASE_CSS)
      let state = { open: false }
      let accept = true
      let changes: Array<{ open: boolean; details: TooltipOpenChangeDetails }> = []
      let owner: Handle | undefined
      function App(handle: Handle) {
        owner = handle
        return () => (
          <Harness
            open={state.open}
            triggerOptions={{ delay: 0 }}
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
      let trigger = result.$('#trigger') as HTMLElement
      let popup = result.$('#popup') as HTMLElement

      state.open = true
      await result.act(() => owner!.update())
      await waitFor(() => isShown(popup))
      expect(isOpen(trigger)).toBe(true)
      expect(changes).toEqual([])

      // Rejected change keeps it open.
      accept = false
      await result.act(() => key(document.body, 'Escape'))
      expect(changes.map((c) => [c.open, c.details.reason])).toEqual([[false, 'escape-key']])
      expect(isOpen(trigger)).toBe(true)

      accept = true
      await result.act(() => key(document.body, 'Escape'))
      expect(isOpen(trigger)).toBe(false)
      expect(changes[1].details.trigger).toBe(trigger)
    })

    it('can cancel a change from onOpenChange', async (t) => {
      let { trigger } = setup(t, {
        triggerOptions: { delay: 0 },
        onOpenChange: (_open, details) => details.cancel(),
      })
      pointer(trigger, 'pointerenter')
      await sleep(30)
      expect(isOpen(trigger)).toBe(false)
    })
  })

  describe('disabled', () => {
    it('does not open from a disabled trigger', async (t) => {
      let { trigger } = setup(t, { triggerOptions: { delay: 0, disabled: true } })
      expect(trigger.getAttribute('data-trigger-disabled')).toBe('')
      expect(trigger.hasAttribute('disabled')).toBe(false)
      pointer(trigger, 'pointerenter')
      trigger.focus()
      await sleep(30)
      expect(isOpen(trigger)).toBe(false)
    })

    it('closes with reason "disabled" when the root becomes disabled', async (t) => {
      addStyle(t, BASE_CSS)
      let disabled = false
      let reasons: string[] = []
      let owner: Handle | undefined
      function App(handle: Handle) {
        owner = handle
        return () => (
          <Harness
            disabled={disabled}
            triggerOptions={{ delay: 0 }}
            onOpenChange={(_open, details) => reasons.push(details.reason)}
          />
        )
      }
      let result = render(<App />)
      t.after(result.cleanup)
      let trigger = result.$('#trigger') as HTMLElement
      await hoverOpen(result.act, trigger)

      disabled = true
      await result.act(() => owner!.update())
      await waitFor(() => !isOpen(trigger))
      expect(reasons).toEqual(['trigger-hover', 'disabled'])
      expect(trigger.getAttribute('data-trigger-disabled')).toBe('')
    })
  })

  describe('delay group (Provider)', () => {
    function Group(handle: Handle<{ timeout?: number; onChange?(id: string, e: string): void }>) {
      let item = (id: string): RemixNode => (
        <tooltip.Context
          onOpenChange={(open, details) => handle.props.onChange?.(id, `${open}:${details.reason}`)}
        >
          <button id={id} data-test-trigger mix={tooltip.trigger()}>
            {id}
          </button>
          <div id={`${id}-popup`} data-test-popup mix={tooltip.popup()}>
            {id}
          </div>
        </tooltip.Context>
      )
      return () => (
        <tooltip.Provider delay={60} timeout={handle.props.timeout ?? 400}>
          {item('a')}
          {item('b')}
          {item('c')}
        </tooltip.Provider>
      )
    }

    function setupGroup(t: T, timeout?: number) {
      addStyle(t, BASE_CSS)
      let changes: string[] = []
      let result = render(
        <Group timeout={timeout} onChange={(id, change) => changes.push(`${id}:${change}`)} />,
      )
      t.after(result.cleanup)
      let get = (id: string) => result.$(`#${id}`) as HTMLElement
      return { ...result, get, changes }
    }

    it('uses the provider delay, then opens adjacent tooltips instantly', async (t) => {
      let { act, get, changes } = setupGroup(t)
      let a = get('a')
      let b = get('b')

      pointer(a, 'pointerenter')
      await sleep(25)
      expect(isOpen(a)).toBe(false)
      await waitFor(() => isOpen(a))
      await act(() => {})
      expect(get('a-popup').hasAttribute('data-instant')).toBe(false)

      // Move from A to B: A closes, B opens without waiting for the delay.
      pointer(a, 'pointerleave', { relatedTarget: b })
      pointer(b, 'pointerenter', { relatedTarget: a })
      let start = performance.now()
      await waitFor(() => isOpen(b))
      expect(performance.now() - start < 50).toBe(true)
      await act(() => {})
      expect(isOpen(a)).toBe(false)
      expect(get('b-popup').getAttribute('data-instant')).toBe('delay')
      // A closes either from the pointer leaving or because B opened (reason 'none').
      expect(changes[0]).toBe('a:true:trigger-hover')
      expect(changes).toContain('b:true:trigger-hover')
      expect(changes.filter((change) => change.startsWith('a:false')).length).toBe(1)
    })

    it('closes the open sibling with reason "none" and makes it instant', async (t) => {
      let { act, get, changes } = setupGroup(t)
      let a = get('a')
      let b = get('b')
      a.focus()
      await waitFor(() => isOpen(a))
      await act(() => {})

      // A stays focused (so it isn't closed by blur); hovering B opens it at once.
      pointer(b, 'pointerenter')
      await waitFor(() => isOpen(b))
      await act(() => {})
      expect(isOpen(a)).toBe(false)
      expect(changes).toEqual(['a:true:trigger-focus', 'b:true:trigger-hover', 'a:false:none'])
      expect(get('a-popup').getAttribute('data-instant')).toBe('delay')
      expect(get('b-popup').getAttribute('data-instant')).toBe('delay')
    })

    it('uses the delay again after the timeout', async (t) => {
      let { act, get } = setupGroup(t, 30)
      let a = get('a')
      let c = get('c')
      pointer(a, 'pointerenter')
      await waitFor(() => isOpen(a))
      await act(() => {})
      pointer(a, 'pointerleave', { relatedTarget: document.body })
      await waitFor(() => !isOpen(a))
      await sleep(60)

      pointer(c, 'pointerenter')
      await sleep(25)
      expect(isOpen(c)).toBe(false)
      await waitFor(() => isOpen(c))
      await act(() => {})
      expect(get('c-popup').hasAttribute('data-instant')).toBe(false)
    })

    it('lets a trigger delay override the provider delay', async (t) => {
      addStyle(t, BASE_CSS)
      let result = render(
        <tooltip.Provider delay={500}>
          <tooltip.Context>
            <button id="a" data-test-trigger mix={tooltip.trigger({ delay: 0 })}>
              a
            </button>
            <div mix={tooltip.popup()}>a</div>
          </tooltip.Context>
        </tooltip.Provider>,
      )
      t.after(result.cleanup)
      let a = result.$('#a') as HTMLElement
      pointer(a, 'pointerenter')
      await waitFor(() => isOpen(a), 200)
    })
  })

  it('exits with presence styles before hiding', async (t) => {
    let { act, trigger, popup } = setup(t, { triggerOptions: { delay: 0 } })
    addStyle(
      t,
      `#popup { transition: opacity 80ms; }
       #popup[data-starting-style], #popup[data-ending-style] { opacity: 0; }`,
    )
    await hoverOpen(act, trigger)
    await waitFor(() => !popup.hasAttribute('data-starting-style'))

    pointer(trigger, 'pointerleave', { relatedTarget: document.body })
    await waitFor(() => popup.hasAttribute('data-ending-style'))
    expect(popup.getAttribute('data-closed')).toBe('')
    expect(isShown(popup)).toBe(true)
    await waitFor(() => !isShown(popup) && popup.hasAttribute('hidden'))
    expect(popup.hasAttribute('data-ending-style')).toBe(false)
  })

  it('dispatches a bubbling stems:tooltip-change event', async (t) => {
    addStyle(t, BASE_CSS)
    let events: TooltipChangeEvent[] = []
    let result = render(
      <div mix={onTooltipChange((event) => void events.push(event))}>
        <Harness triggerOptions={{ delay: 0 }} />
      </div>,
    )
    t.after(result.cleanup)
    let trigger = result.$('#trigger') as HTMLElement
    await hoverOpen(result.act, trigger)
    await result.act(() => key(document.body, 'Escape'))
    expect(events.map((e) => [e.open, e.reason])).toEqual([
      [true, 'trigger-hover'],
      [false, 'escape-key'],
    ])
    expect(events[0]).toBeInstanceOf(TooltipChangeEvent)
    expect(events[0].target).toBe(trigger)
  })

  it('works with no-argument mixin calls', async (t) => {
    let { act, trigger, popup } = setup(t, { noArgs: true })
    expect(popup.getAttribute('role')).toBe('tooltip')
    expect(popup.getAttribute('data-side')).toBe('top')
    await act(() => trigger.focus())
    expect(isOpen(trigger)).toBe(true)
    await waitFor(() => isShown(popup))
  })

  it('positions on the requested side and reports it on the arrow', async (t) => {
    let { act, trigger, popup, get } = setup(t, {
      triggerOptions: { delay: 0 },
      popupOptions: { side: 'bottom', sideOffset: 6 },
    })
    await hoverOpen(act, trigger)
    await waitFor(() => popup.getBoundingClientRect().top > trigger.getBoundingClientRect().bottom)
    let gap = popup.getBoundingClientRect().top - trigger.getBoundingClientRect().bottom
    expect(Math.round(gap)).toBe(6)
    expect(popup.getAttribute('data-side')).toBe('bottom')
    expect(get('arrow').getAttribute('data-side')).toBe('bottom')
  })

  it('follows the cursor with trackCursorAxis="x"', async (t) => {
    let { act, trigger, popup } = setup(t, {
      trackCursorAxis: 'x',
      triggerOptions: { delay: 0 },
    })
    let rect = trigger.getBoundingClientRect()
    pointer(trigger, 'pointerenter', { clientX: rect.left + 5, clientY: rect.top + 5 })
    await waitFor(() => isOpen(trigger))
    await act(() => {})
    pointer(trigger, 'pointermove', { clientX: rect.left + 50, clientY: rect.top + 5 })
    await waitFor(() => {
      let box = popup.getBoundingClientRect()
      return Math.abs(box.left + box.width / 2 - (rect.left + 50)) < 1.5
    })
    // Still placed above the trigger.
    expect(popup.getBoundingClientRect().bottom <= rect.top + 1).toBe(true)
  })
})
