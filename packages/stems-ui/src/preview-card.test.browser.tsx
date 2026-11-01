import { expect } from 'remix/assert'
import { describe, it } from 'remix/test'
import type { Handle } from 'remix/component'
import { render } from 'remix/component/test'

import * as popover from './popover.ts'
import * as previewCard from './preview-card.ts'
import { PreviewCardChangeEvent, onPreviewCardChange } from './preview-card.ts'

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
  [data-test-popup] { margin: 0; padding: 0; border: 0; width: 200px; height: 120px; }
  [data-test-trigger] { position: fixed; top: 60px; left: 100px; width: 80px; height: 20px;
    display: block; margin: 0; padding: 0; }
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

type HarnessProps = previewCard.PreviewCardContextProps & {
  triggerOptions?: previewCard.PreviewCardTriggerOptions
  popupOptions?: previewCard.PreviewCardPopupOptions
  noArgs?: boolean
  withBackdrop?: boolean
}

function Harness(handle: Handle<HarnessProps>) {
  return () => {
    let {
      triggerOptions,
      popupOptions,
      noArgs,
      withBackdrop,
      children: _children,
      ...props
    } = handle.props
    return (
      <div>
        <previewCard.Context {...props}>
          <a
            id="trigger"
            href="#remix"
            data-test-trigger
            mix={noArgs ? previewCard.trigger() : previewCard.trigger(triggerOptions)}
          >
            @remix-run
          </a>
          {withBackdrop ? <div id="backdrop" mix={previewCard.backdrop()} /> : null}
          <div
            id="popup"
            data-test-popup
            mix={noArgs ? previewCard.popup() : previewCard.popup(popupOptions)}
          >
            <span id="arrow" style={{ width: '10px', height: '5px' }} mix={previewCard.arrow()} />
            <a id="inside" href="#docs">
              Docs
            </a>
          </div>
        </previewCard.Context>
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
  return { ...result, trigger: get('trigger') as HTMLAnchorElement, popup: get('popup'), get }
}

describe('preview-card', () => {
  it('renders the closed state and leaves the link semantics alone', (t) => {
    let { trigger, popup, get } = setup(t)

    expect(trigger.getAttribute('href')).toBe('#remix')
    expect(trigger.getAttribute('role')).toBe(null)
    expect(trigger.getAttribute('aria-haspopup')).toBe(null)
    expect(trigger.getAttribute('aria-expanded')).toBe(null)
    expect(trigger.getAttribute('tabindex')).toBe(null)
    expect(trigger.hasAttribute('data-popup-open')).toBe(false)

    expect(popup.getAttribute('role')).toBe(null)
    expect(popup.getAttribute('popover')).toBe('manual')
    expect(popup.hasAttribute('hidden')).toBe(true)
    expect(popup.getAttribute('data-closed')).toBe('')
    expect(popup.getAttribute('data-side')).toBe('bottom')
    expect(popup.getAttribute('data-align')).toBe('center')
    expect(get('arrow').getAttribute('data-side')).toBe('bottom')
  })

  it('opens on hover after the delay without moving focus', async (t) => {
    let changes: Array<[boolean, string]> = []
    let { act, trigger, popup, get } = setup(t, {
      triggerOptions: { delay: 40, closeDelay: 0 },
      onOpenChange: (open, details) => changes.push([open, details.reason]),
    })
    let input = get('outside')
    input.focus()

    pointer(trigger, 'pointerenter')
    await sleep(15)
    expect(isOpen(trigger)).toBe(false)
    await waitFor(() => isOpen(trigger))
    await act(() => {})
    await waitFor(() => isShown(popup))
    expect(changes).toEqual([[true, 'trigger-hover']])
    expect(popup.getAttribute('data-open')).toBe('')
    expect(document.activeElement).toBe(input)

    // Below the trigger.
    expect(popup.getBoundingClientRect().top >= trigger.getBoundingClientRect().bottom - 1).toBe(
      true,
    )

    pointer(trigger, 'pointerleave', { relatedTarget: document.body })
    await waitFor(() => !isOpen(trigger))
    expect(changes.at(-1)).toEqual([false, 'trigger-hover'])
  })

  it('defaults to a 600ms open delay and a 300ms close delay', async (t) => {
    let { act, trigger } = setup(t)
    pointer(trigger, 'pointerenter')
    await sleep(300)
    expect(isOpen(trigger)).toBe(false)
    await waitFor(() => isOpen(trigger), 1000)
    await act(() => {})

    pointer(trigger, 'pointerleave', { relatedTarget: document.body })
    await sleep(150)
    expect(isOpen(trigger)).toBe(true)
    await waitFor(() => !isOpen(trigger), 1000)
  })

  it('stays open while the pointer is over the card', async (t) => {
    let { act, trigger, popup } = setup(t, { triggerOptions: { delay: 0, closeDelay: 30 } })
    pointer(trigger, 'pointerenter')
    await waitFor(() => isOpen(trigger))
    await act(() => {})

    pointer(trigger, 'pointerleave', { relatedTarget: popup })
    pointer(popup, 'pointerenter', { relatedTarget: trigger })
    await sleep(70)
    expect(isOpen(trigger)).toBe(true)

    pointer(popup, 'pointerleave', { relatedTarget: document.body })
    await waitFor(() => !isOpen(trigger))
  })

  it('opens on keyboard focus after the delay and closes on blur', async (t) => {
    let changes: Array<[boolean, string]> = []
    let { act, trigger, popup, get } = setup(t, {
      triggerOptions: { delay: 40 },
      onOpenChange: (open, details) => changes.push([open, details.reason]),
    })
    await act(() => trigger.focus())
    expect(isOpen(trigger)).toBe(false)
    await waitFor(() => isOpen(trigger))
    await waitFor(() => isShown(popup))
    expect(changes).toEqual([[true, 'trigger-focus']])
    expect(document.activeElement).toBe(trigger)

    await act(() => get('outside').focus())
    await waitFor(() => !isOpen(trigger))
    expect(changes.at(-1)).toEqual([false, 'trigger-focus'])
  })

  it('stays open when focus moves from the trigger into the card', async (t) => {
    let { act, trigger, popup, get } = setup(t, { triggerOptions: { delay: 0 } })
    await act(() => trigger.focus())
    await waitFor(() => isShown(popup))
    await act(() => get('inside').focus())
    await sleep(20)
    expect(isOpen(trigger)).toBe(true)
  })

  it('does not toggle when the link is pressed', async (t) => {
    let { act, trigger } = setup(t, { triggerOptions: { delay: 0 } })
    pointer(trigger, 'pointerenter')
    await waitFor(() => isOpen(trigger))
    await act(() => {
      pointer(trigger, 'pointerdown')
      trigger.click()
    })
    expect(isOpen(trigger)).toBe(true)
  })

  it('closes on Escape and on an outside press', async (t) => {
    let reasons: string[] = []
    let { act, trigger, get } = setup(t, {
      triggerOptions: { delay: 0 },
      onOpenChange: (_open, details) => reasons.push(details.reason),
    })
    pointer(trigger, 'pointerenter')
    await waitFor(() => isOpen(trigger))
    await act(() => key(document.body, 'Escape'))
    expect(isOpen(trigger)).toBe(false)

    pointer(trigger, 'pointerleave', { relatedTarget: document.body })
    pointer(trigger, 'pointerenter')
    await waitFor(() => isOpen(trigger))
    await act(() => {
      pointer(get('outside'), 'pointerdown')
      get('outside').click()
    })
    expect(isOpen(trigger)).toBe(false)
    expect(reasons).toEqual(['trigger-hover', 'escape-key', 'trigger-hover', 'outside-press'])
  })

  it('Escape inside an open popover closes only the preview card', async (t) => {
    addStyle(t, BASE_CSS)
    let popoverChanges: string[] = []
    let result = render(
      <popover.Context
        defaultOpen
        onOpenChange={(open, details) => popoverChanges.push(`${open}:${details.reason}`)}
      >
        <button mix={popover.trigger()}>Open</button>
        <div id="popover" mix={popover.popup()}>
          <previewCard.Context>
            <a id="card-trigger" href="#x" mix={previewCard.trigger({ delay: 0 })}>
              Link
            </a>
            <div id="card" mix={previewCard.popup()}>
              Card
            </div>
          </previewCard.Context>
        </div>
      </popover.Context>,
    )
    t.after(result.cleanup)
    let cardTrigger = result.$('#card-trigger') as HTMLElement
    await waitFor(() => isShown(result.$('#popover') as HTMLElement))
    await result.act(() => cardTrigger.focus())
    await waitFor(() => isOpen(cardTrigger))
    await result.act(() => key(cardTrigger, 'Escape'))
    expect(isOpen(cardTrigger)).toBe(false)
    expect(popoverChanges).toEqual([])
  })

  it('supports controlled state', async (t) => {
    addStyle(t, BASE_CSS)
    let state = { open: true }
    let changes: string[] = []
    let owner: Handle | undefined
    function App(handle: Handle) {
      owner = handle
      return () => (
        <Harness
          open={state.open}
          onOpenChange={(open, details) => {
            changes.push(`${open}:${details.reason}`)
          }}
        />
      )
    }
    let result = render(<App />)
    t.after(result.cleanup)
    let trigger = result.$('#trigger') as HTMLElement
    let popup = result.$('#popup') as HTMLElement
    await waitFor(() => isShown(popup))
    expect(isOpen(trigger)).toBe(true)

    // Not accepted: stays open.
    await result.act(() => key(document.body, 'Escape'))
    expect(changes).toEqual(['false:escape-key'])
    expect(isOpen(trigger)).toBe(true)

    state.open = false
    await result.act(() => owner!.update())
    expect(isOpen(trigger)).toBe(false)
    await waitFor(() => popup.hasAttribute('hidden'))
  })

  it('shows and hides the backdrop with the card', async (t) => {
    let { act, trigger, get } = setup(t, { withBackdrop: true, triggerOptions: { delay: 0 } })
    let backdrop = get('backdrop')
    expect(backdrop.getAttribute('role')).toBe('presentation')
    expect(backdrop.hasAttribute('hidden')).toBe(true)
    pointer(trigger, 'pointerenter')
    await waitFor(() => isOpen(trigger))
    await act(() => {})
    await waitFor(() => isShown(backdrop))
    expect(backdrop.getAttribute('data-open')).toBe('')
    await act(() => key(document.body, 'Escape'))
    await waitFor(() => backdrop.hasAttribute('hidden'))
    expect(backdrop.getAttribute('data-closed')).toBe('')
  })

  it('exits with presence styles before hiding', async (t) => {
    let { act, trigger, popup } = setup(t, { triggerOptions: { delay: 0, closeDelay: 0 } })
    addStyle(
      t,
      `#popup { transition: opacity 80ms; }
       #popup[data-starting-style], #popup[data-ending-style] { opacity: 0; }`,
    )
    pointer(trigger, 'pointerenter')
    await waitFor(() => isOpen(trigger))
    await act(() => {})
    await waitFor(() => !popup.hasAttribute('data-starting-style'))
    pointer(trigger, 'pointerleave', { relatedTarget: document.body })
    await waitFor(() => popup.hasAttribute('data-ending-style'))
    expect(isShown(popup)).toBe(true)
    await waitFor(() => popup.hasAttribute('hidden'))
  })

  it('dispatches a bubbling stems:preview-card-change event', async (t) => {
    addStyle(t, BASE_CSS)
    let events: PreviewCardChangeEvent[] = []
    let result = render(
      <div mix={onPreviewCardChange((event) => void events.push(event))}>
        <Harness triggerOptions={{ delay: 0 }} />
      </div>,
    )
    t.after(result.cleanup)
    let trigger = result.$('#trigger') as HTMLElement
    pointer(trigger, 'pointerenter')
    await waitFor(() => isOpen(trigger))
    await result.act(() => key(document.body, 'Escape'))
    expect(events.map((e) => [e.open, e.reason])).toEqual([
      [true, 'trigger-hover'],
      [false, 'escape-key'],
    ])
    expect(events[0]).toBeInstanceOf(PreviewCardChangeEvent)
    expect(events[0].target).toBe(trigger)
  })

  it('works with no-argument mixin calls', async (t) => {
    let { trigger, popup } = setup(t, { noArgs: true })
    expect(popup.getAttribute('data-side')).toBe('bottom')
    pointer(trigger, 'pointerenter')
    await waitFor(() => isOpen(trigger), 1000)
    await waitFor(() => isShown(popup))
  })
})
