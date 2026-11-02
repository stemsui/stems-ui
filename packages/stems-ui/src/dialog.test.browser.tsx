import { expect } from 'remix/assert'
import { describe, it } from 'remix/test'
import type { Handle } from 'remix/component'
import { render } from 'remix/component/test'

import * as dialog from './dialog.ts'
import { DialogChangeEvent, onDialogChange } from './dialog.ts'

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

function addStyle(t: T, css: string) {
  let style = document.createElement('style')
  style.textContent = css
  document.head.append(style)
  t.after(() => style.remove())
}

function escape(target: EventTarget = document.activeElement ?? document.body) {
  let event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
  target.dispatchEvent(event)
  return event
}

function tab(shiftKey = false) {
  let event = new KeyboardEvent('keydown', {
    key: 'Tab',
    shiftKey,
    bubbles: true,
    cancelable: true,
  })
  ;(document.activeElement ?? document.body).dispatchEvent(event)
  return event
}

/** A real-looking press: pointerdown + click at viewport coordinates on `target`. */
function pressAt(target: Element, x: number, y: number) {
  target.dispatchEvent(
    new PointerEvent('pointerdown', {
      bubbles: true,
      clientX: x,
      clientY: y,
      pointerType: 'mouse',
    }),
  )
  target.dispatchEvent(
    new MouseEvent('click', { bubbles: true, cancelable: true, clientX: x, clientY: y, detail: 1 }),
  )
}

const popupCss = `
  dialog.popup { width: 300px; height: 200px; padding: 0; margin: auto; }
`

type ExampleProps = dialog.DialogContextProps & {
  popup?: dialog.DialogPopupOptions
  withBackdrop?: boolean
  nested?: dialog.DialogContextProps
}

function Example(handle: Handle<ExampleProps>) {
  return () => {
    let { popup, withBackdrop, nested, children: _children, ...props } = handle.props
    return (
      <div>
        <dialog.Context {...props}>
          <button class="trigger" mix={dialog.trigger()}>
            Edit profile
          </button>
          {withBackdrop && <div class="backdrop" mix={dialog.backdrop()} />}
          <dialog class="popup" mix={dialog.popup(popup)}>
            <h2 mix={dialog.title()}>Edit profile</h2>
            <p mix={dialog.description()}>Make changes to your profile.</p>
            <input class="name" />
            {nested && (
              <dialog.Context {...nested}>
                <button class="inner-trigger" mix={dialog.trigger()}>
                  More
                </button>
                <dialog class="popup inner" mix={dialog.popup()}>
                  <h2 mix={dialog.title()}>Inner</h2>
                  <button class="inner-close" mix={dialog.close()}>
                    Close inner
                  </button>
                </dialog>
              </dialog.Context>
            )}
            <button class="close" mix={dialog.close()}>
              Close
            </button>
          </dialog>
        </dialog.Context>
        <button class="outside">Outside</button>
      </div>
    )
  }
}

function setup(t: T, props: ExampleProps = {}) {
  addStyle(t, popupCss)
  let result = render(<Example {...props} />)
  t.after(result.cleanup)
  let trigger = result.$('.trigger') as HTMLButtonElement
  let popup = result.$('dialog.popup') as HTMLDialogElement
  let close = result.$('.close') as HTMLButtonElement
  return { ...result, trigger, popup, close }
}

function pressBackdrop(popup: HTMLDialogElement) {
  let rect = popup.getBoundingClientRect()
  pressAt(popup, Math.max(1, rect.left - 10), Math.max(1, rect.top - 10))
}

describe('dialog', () => {
  it('links the trigger, popup, title, and description', (t) => {
    let { trigger, popup, $ } = setup(t)
    let title = $('h2') as HTMLElement
    let description = $('p') as HTMLElement

    expect(trigger.getAttribute('type')).toBe('button')
    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog')
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(trigger.getAttribute('aria-controls')).toBe(popup.id)
    expect(popup.id).not.toBe('')
    expect(title.id).not.toBe('')
    expect(popup.getAttribute('aria-labelledby')).toBe(title.id)
    expect(popup.getAttribute('aria-describedby')).toBe(description.id)
    expect(popup.getAttribute('aria-modal')).toBe('true')
    expect(popup.hasAttribute('role')).toBe(false)
    expect(popup.open).toBe(false)
    expect(popup.getAttribute('data-closed')).toBe('')
    expect(popup.hasAttribute('data-open')).toBe(false)
    expect(popup.style.getPropertyValue('--nested-dialogs')).toBe('0')
  })

  it('opens as a modal dialog and moves focus inside', async (t) => {
    let { act, trigger, popup, $ } = setup(t)

    await act(() => trigger.click())
    expect(popup.open).toBe(true)
    expect(popup.matches(':modal')).toBe(true)
    expect(popup.getAttribute('data-open')).toBe('')
    expect(popup.hasAttribute('data-closed')).toBe(false)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(trigger.getAttribute('data-popup-open')).toBe('')
    expect(document.activeElement).toBe($('.name'))

    await waitFor(() => !popup.hasAttribute('data-starting-style'))
  })

  it('closes with the close button and returns focus to the trigger', async (t) => {
    let reasons: string[] = []
    let { act, trigger, popup, close } = setup(t, {
      onOpenChange: (open, details) => reasons.push(`${open}:${details.reason}`),
    })

    trigger.focus()
    await act(() => trigger.click())
    await act(() => close.click())
    expect(popup.getAttribute('data-closed')).toBe('')
    await waitFor(() => !popup.open)
    expect(document.activeElement).toBe(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(reasons).toEqual(['true:trigger-press', 'false:close-press'])
  })

  it('keeps the native dialog open until the exit animation finishes', async (t) => {
    addStyle(
      t,
      `dialog.popup { transition: opacity 120ms; }
       dialog.popup[data-starting-style], dialog.popup[data-ending-style] { opacity: 0; }`,
    )
    let { act, trigger, popup, close } = setup(t)

    await act(() => trigger.click())
    expect(popup.hasAttribute('data-starting-style')).toBe(true)
    await waitFor(() => !popup.hasAttribute('data-starting-style'))
    await waitFor(() => popup.getAnimations().length === 0)

    let start = performance.now()
    await act(() => close.click())
    expect(popup.getAttribute('data-ending-style')).toBe('')
    expect(popup.open).toBe(true)
    await nextFrame()
    expect(popup.open).toBe(true)
    await waitFor(() => !popup.open)
    expect(performance.now() - start).toBeGreaterThan(100)
    expect(popup.hasAttribute('data-ending-style')).toBe(false)
  })

  it('closes on Escape through the dismiss stack', async (t) => {
    let reasons: string[] = []
    let { act, trigger, popup } = setup(t, {
      onOpenChange: (_open, details) => reasons.push(details.reason),
    })

    await act(() => trigger.click())
    let event: KeyboardEvent | undefined
    await act(() => {
      event = escape()
    })
    expect(event!.defaultPrevented).toBe(true)
    expect(popup.getAttribute('data-closed')).toBe('')
    await waitFor(() => !popup.open)
    expect(reasons).toEqual(['trigger-press', 'escape-key'])
  })

  it('closes on a backdrop press but not on presses inside the popup', async (t) => {
    let reasons: string[] = []
    let { act, trigger, popup, $ } = setup(t, {
      onOpenChange: (_open, details) => reasons.push(details.reason),
    })

    await act(() => trigger.click())
    let rect = popup.getBoundingClientRect()
    // On the dialog's own box (its padding area), and on content: inside.
    await act(() => pressAt(popup, rect.left + 2, rect.top + 2))
    await act(() => pressAt($('p') as HTMLElement, rect.left + 20, rect.top + 40))
    expect(popup.getAttribute('data-open')).toBe('')

    await act(() => pressBackdrop(popup))
    expect(popup.getAttribute('data-closed')).toBe('')
    expect(reasons).toEqual(['trigger-press', 'outside-press'])
    await waitFor(() => !popup.open)
  })

  it('ignores outside presses with disablePointerDismissal', async (t) => {
    let { act, trigger, popup } = setup(t, { disablePointerDismissal: true })

    await act(() => trigger.click())
    await act(() => pressBackdrop(popup))
    expect(popup.getAttribute('data-open')).toBe('')

    await act(() => escape())
    expect(popup.getAttribute('data-closed')).toBe('')
  })

  it('supports controlled state and cancelling changes', async (t) => {
    let open = false
    let owner: Handle | undefined
    let calls: string[] = []
    let cancelNext = false

    function App(handle: Handle) {
      owner = handle
      return () => (
        <Example
          open={open}
          onOpenChange={(next, details) => {
            calls.push(`${next}:${details.reason}`)
            if (cancelNext) details.cancel()
          }}
        />
      )
    }

    addStyle(t, popupCss)
    let result = render(<App />)
    t.after(result.cleanup)
    let trigger = result.$('.trigger') as HTMLButtonElement
    let popup = result.$('dialog.popup') as HTMLDialogElement

    await result.act(() => trigger.click())
    expect(calls).toEqual(['true:trigger-press'])
    expect(popup.open).toBe(false)

    open = true
    await result.act(() => owner!.update())
    expect(popup.open).toBe(true)

    cancelNext = true
    await result.act(() => escape())
    expect(calls.at(-1)).toBe('false:escape-key')
    expect(popup.getAttribute('data-open')).toBe('')

    open = false
    await result.act(() => owner!.update())
    await waitFor(() => !popup.open)
  })

  it('cancelled uncontrolled changes keep the dialog open', async (t) => {
    let { act, trigger, popup } = setup(t, {
      onOpenChange: (open, details) => {
        if (!open) details.cancel()
      },
    })

    await act(() => trigger.click())
    await act(() => escape())
    expect(popup.open).toBe(true)
    expect(popup.getAttribute('data-open')).toBe('')
  })

  it('dispatches a bubbling stems:dialog-change event', async (t) => {
    let events: DialogChangeEvent[] = []

    function App() {
      return () => (
        <div mix={onDialogChange((event) => void events.push(event))}>
          <Example />
        </div>
      )
    }

    addStyle(t, popupCss)
    let result = render(<App />)
    t.after(result.cleanup)
    await result.act(() => (result.$('.trigger') as HTMLButtonElement).click())
    await result.act(() => (result.$('.close') as HTMLButtonElement).click())

    expect(events.length).toBe(2)
    expect(events[0]).toBeInstanceOf(DialogChangeEvent)
    expect(events[0].open).toBe(true)
    expect(events[0].reason).toBe('trigger-press')
    expect(events[1].open).toBe(false)
    expect(events[1].reason).toBe('close-press')
  })

  it('locks page scroll only while a modal dialog is open', async (t) => {
    let { act, trigger, popup, close } = setup(t)
    let root = document.documentElement
    let before = root.style.overflow

    await act(() => trigger.click())
    expect(root.style.overflow).toBe('hidden')
    await act(() => close.click())
    await waitFor(() => !popup.open)
    expect(root.style.overflow).toBe(before)
  })

  it('renders initially open with defaultOpen', async (t) => {
    let { popup, trigger } = setup(t, { defaultOpen: true })
    await waitFor(() => popup.open)
    expect(popup.matches(':modal')).toBe(true)
    expect(popup.getAttribute('data-open')).toBe('')
    expect(popup.hasAttribute('data-starting-style')).toBe(false)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
  })

  it('supports non-modal dialogs that close when focus leaves', async (t) => {
    let reasons: string[] = []
    let { act, trigger, popup, $ } = setup(t, {
      modal: false,
      onOpenChange: (_open, details) => reasons.push(details.reason),
    })

    await act(() => trigger.click())
    expect(popup.open).toBe(true)
    expect(popup.matches(':modal')).toBe(false)
    expect(popup.hasAttribute('aria-modal')).toBe(false)
    expect(document.documentElement.style.overflow).not.toBe('hidden')

    await act(() => ($('.outside') as HTMLButtonElement).focus())
    expect(popup.getAttribute('data-closed')).toBe('')
    expect(reasons).toEqual(['trigger-press', 'focus-out'])
    await waitFor(() => !popup.open)
    // Focus moved outside on purpose, so it isn't pulled back to the trigger.
    expect(document.activeElement).toBe($('.outside'))
  })

  it('closes a non-modal dialog on an outside press', async (t) => {
    let reasons: string[] = []
    let { act, trigger, popup, $ } = setup(t, {
      modal: false,
      onOpenChange: (_open, details) => reasons.push(details.reason),
    })

    await act(() => trigger.click())
    // The trigger counts as inside: pressing it toggles instead of dismiss-then-reopen.
    await act(() => pressAt(trigger, 1, 1))
    expect(reasons).toEqual(['trigger-press', 'trigger-press'])

    await act(() => trigger.click())
    await act(() => pressAt($('.outside') as HTMLElement, 1, 1))
    expect(reasons.at(-1)).toBe('outside-press')
    await waitFor(() => !popup.open)
  })

  it('traps Tab inside modal and trap-focus dialogs', async (t) => {
    let { act, trigger, popup, close, $ } = setup(t, { modal: 'trap-focus' })

    await act(() => trigger.click())
    expect(popup.matches(':modal')).toBe(false)
    expect(popup.hasAttribute('aria-modal')).toBe(false)
    expect(document.documentElement.style.overflow).not.toBe('hidden')

    close.focus()
    let event = tab()
    expect(event.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe($('.name'))

    event = tab(true)
    expect(event.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(close)
  })

  it('supports initialFocus and finalFocus', async (t) => {
    let { act, trigger, popup, close, $ } = setup(t, {
      popup: { initialFocus: '.close', finalFocus: () => $('.outside') as HTMLElement },
    })

    await act(() => trigger.click())
    expect(document.activeElement).toBe(close)
    await act(() => close.click())
    await waitFor(() => !popup.open)
    expect(document.activeElement).toBe($('.outside'))
  })

  it('passes the interaction type to an initialFocus function', async (t) => {
    let types: string[] = []
    let { act, trigger, popup, close, $ } = setup(t, {
      popup: {
        initialFocus: (type) => {
          types.push(type)
          return type === 'keyboard' ? ($('.close') as HTMLElement) : true
        },
      },
    })

    // A click with detail 0 (Enter/Space on a button) is a keyboard open.
    await act(() => trigger.click())
    expect(types).toEqual(['keyboard'])
    expect(document.activeElement).toBe(close)
    await act(() => close.click())
    await waitFor(() => !popup.open)

    await act(() => {
      trigger.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch' }),
      )
      trigger.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }))
    })
    expect(types).toEqual(['keyboard', 'touch'])
    expect(document.activeElement).toBe(popup)
  })

  it('syncs state when the native dialog closes on its own', async (t) => {
    let reasons: string[] = []
    let { act, trigger, popup } = setup(t, {
      onOpenChange: (_open, details) => reasons.push(details.reason),
    })

    await act(() => trigger.click())
    popup.close()
    await waitFor(() => popup.hasAttribute('data-closed'))
    expect(reasons).toEqual(['trigger-press', 'none'])
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
  })

  it('exposes imperative actions through actionsRef', async (t) => {
    let actionsRef: { current: dialog.DialogActions | null } = { current: null }
    let reasons: string[] = []
    let { act, popup } = setup(t, {
      actionsRef,
      onOpenChange: (_open, details) => reasons.push(details.reason),
    })

    expect(actionsRef.current).not.toBe(null)
    await act(() => actionsRef.current!.open())
    expect(popup.open).toBe(true)
    await act(() => actionsRef.current!.close())
    await waitFor(() => !popup.open)
    expect(reasons).toEqual(['imperative-action', 'imperative-action'])
  })

  it('renders a separate backdrop element while open', async (t) => {
    let { act, trigger, popup, $ } = setup(t, { withBackdrop: true, modal: false })
    let backdrop = $('.backdrop') as HTMLElement

    expect(backdrop.hasAttribute('hidden')).toBe(true)
    expect(backdrop.getAttribute('data-closed')).toBe('')
    expect(backdrop.getAttribute('role')).toBe('presentation')

    await act(() => trigger.click())
    expect(backdrop.hasAttribute('hidden')).toBe(false)
    expect(backdrop.getAttribute('data-open')).toBe('')

    await act(() => pressAt(backdrop, 1, 1))
    expect(popup.getAttribute('data-closed')).toBe('')
    await waitFor(() => backdrop.hasAttribute('hidden'))
  })

  it('ignores a disabled trigger', async (t) => {
    function App() {
      return () => (
        <dialog.Context>
          <button mix={dialog.trigger({ disabled: true })}>Open</button>
          <dialog mix={dialog.popup()}>Content</dialog>
        </dialog.Context>
      )
    }
    let result = render(<App />)
    t.after(result.cleanup)
    let button = result.$('button') as HTMLButtonElement
    expect(button.disabled).toBe(true)
    expect(button.getAttribute('data-disabled')).toBe('')
    await result.act(() => button.dispatchEvent(new MouseEvent('click', { bubbles: true })))
    expect((result.$('dialog') as HTMLDialogElement).open).toBe(false)
  })

  it('omits aria-labelledby and aria-describedby without a title or description', async (t) => {
    function App() {
      return () => (
        <dialog.Context>
          <button mix={dialog.trigger()}>Open</button>
          <dialog mix={dialog.popup()}>Content</dialog>
        </dialog.Context>
      )
    }
    let result = render(<App />)
    t.after(result.cleanup)
    let popup = result.$('dialog') as HTMLDialogElement
    await waitFor(() => !popup.hasAttribute('aria-labelledby'))
    expect(popup.hasAttribute('aria-describedby')).toBe(false)
  })

  describe('nested dialogs', () => {
    it('marks the parent and the child and counts open nested dialogs', async (t) => {
      let { act, trigger, popup, $ } = setup(t, { nested: {} })
      let inner = $('dialog.inner') as HTMLDialogElement

      expect(inner.getAttribute('data-nested')).toBe('')
      expect(popup.hasAttribute('data-nested')).toBe(false)

      await act(() => trigger.click())
      await act(() => ($('.inner-trigger') as HTMLButtonElement).click())
      expect(inner.open).toBe(true)
      expect(inner.matches(':modal')).toBe(true)
      await waitFor(() => popup.hasAttribute('data-nested-dialog-open'))
      expect(popup.style.getPropertyValue('--nested-dialogs')).toBe('1')
      expect(inner.style.getPropertyValue('--nested-dialogs')).toBe('0')

      await act(() => ($('.inner-close') as HTMLButtonElement).click())
      await waitFor(() => !popup.hasAttribute('data-nested-dialog-open'))
      expect(popup.style.getPropertyValue('--nested-dialogs')).toBe('0')
      await waitFor(() => !inner.open)
      expect(popup.open).toBe(true)
      expect(document.activeElement).toBe($('.inner-trigger'))
    })

    it('Escape closes only the innermost dialog', async (t) => {
      let { act, trigger, popup, $ } = setup(t, { nested: {} })
      let inner = $('dialog.inner') as HTMLDialogElement

      await act(() => trigger.click())
      await act(() => ($('.inner-trigger') as HTMLButtonElement).click())
      await act(() => escape())
      expect(inner.getAttribute('data-closed')).toBe('')
      expect(popup.getAttribute('data-open')).toBe('')
      await waitFor(() => !inner.open)
      expect(popup.open).toBe(true)

      await act(() => escape())
      expect(popup.getAttribute('data-closed')).toBe('')
    })

    it('a backdrop press closes only the innermost dialog', async (t) => {
      let { act, trigger, popup, $ } = setup(t, { nested: {} })
      let inner = $('dialog.inner') as HTMLDialogElement

      await act(() => trigger.click())
      await act(() => ($('.inner-trigger') as HTMLButtonElement).click())
      await act(() => pressBackdrop(inner))
      expect(inner.getAttribute('data-closed')).toBe('')
      expect(popup.getAttribute('data-open')).toBe('')
    })
  })
})

describe('dialog detached triggers', () => {
  function setupDetached(t: T, props: dialog.DialogContextProps<string> = {}) {
    addStyle(t, popupCss)
    let h = dialog.createHandle<string>()
    let result = render(
      <div>
        <button id="t1" mix={dialog.trigger({ handle: h, payload: 'One' })}>
          One
        </button>
        <button id="t2" mix={dialog.trigger({ handle: h, payload: 'Two' })}>
          Two
        </button>
        <dialog.Context handle={h} {...props}>
          {({ payload }) => (
            <dialog class="popup" mix={dialog.popup()}>
              <h2 mix={dialog.title()}>Edit</h2>
              <p class="payload">{payload ?? 'none'}</p>
              <button class="close" mix={dialog.close()}>
                Close
              </button>
            </dialog>
          )}
        </dialog.Context>
      </div>,
    )
    t.after(result.cleanup)
    let popup = result.$('dialog.popup') as HTMLDialogElement
    return {
      ...result,
      h,
      popup,
      t1: result.$('#t1') as HTMLButtonElement,
      t2: result.$('#t2') as HTMLButtonElement,
      payload: () => result.$('.payload')!.textContent,
    }
  }

  it('wires ARIA once the Context renders', async (t) => {
    let { t1, t2, popup, act } = setupDetached(t)
    await act(() => {})
    for (let trigger of [t1, t2]) {
      expect(trigger.getAttribute('type')).toBe('button')
      expect(trigger.getAttribute('aria-haspopup')).toBe('dialog')
      expect(trigger.getAttribute('aria-expanded')).toBe('false')
      expect(trigger.getAttribute('aria-controls')).toBe(popup.id)
    }
  })

  it('opens from a detached trigger, shows its payload, and returns focus to it', async (t) => {
    let { t1, t2, popup, payload, act, h } = setupDetached(t)
    t2.focus()
    await act(() => t2.click())
    await act(() => {})
    expect(popup.open).toBe(true)
    expect(popup.matches(':modal')).toBe(true)
    expect(h.isOpen).toBe(true)
    expect(payload()).toBe('Two')
    expect(t2.getAttribute('aria-expanded')).toBe('true')
    expect(t2.hasAttribute('data-popup-open')).toBe(true)
    expect(t1.getAttribute('aria-expanded')).toBe('false')

    escape()
    await waitFor(() => !popup.open)
    await act(() => {})
    expect(document.activeElement).toBe(t2)
    expect(t2.getAttribute('aria-expanded')).toBe('false')
    expect(h.isOpen).toBe(false)

    await act(() => t1.click())
    await act(() => {})
    expect(payload()).toBe('One')
    expect(t1.getAttribute('aria-expanded')).toBe('true')
  })

  it('opens imperatively, with a trigger or a payload', async (t) => {
    let reasons: string[] = []
    let { h, popup, payload, t1, act } = setupDetached(t, {
      onOpenChange: (open, details) => reasons.push(`${open}:${details.reason}`),
    })
    await act(() => h.open('t1'))
    await act(() => {})
    expect(popup.open).toBe(true)
    expect(payload()).toBe('One')
    expect(t1.getAttribute('aria-expanded')).toBe('true')
    await act(() => h.close())
    await waitFor(() => !popup.open)

    await act(() => h.openWithPayload('Custom'))
    await act(() => {})
    expect(popup.open).toBe(true)
    expect(payload()).toBe('Custom')
    await act(() => h.close())
    await waitFor(() => !popup.open)
    expect(reasons).toEqual([
      'true:imperative-action',
      'false:imperative-action',
      'true:imperative-action',
      'false:imperative-action',
    ])
  })

  it('treats detached triggers as inside for a non-modal dialog', async (t) => {
    let reasons: string[] = []
    let { t1, t2, popup, act } = setupDetached(t, {
      modal: false,
      onOpenChange: (open, details) => reasons.push(`${open}:${details.reason}`),
    })
    await act(() => t1.click())
    await act(() => {})
    expect(popup.open).toBe(true)
    let rect = t2.getBoundingClientRect()
    await act(() => pressAt(t2, rect.left + 2, rect.top + 2))
    await waitFor(() => !popup.open)
    // The press on the other trigger is a trigger press, not an outside press.
    expect(reasons).toEqual(['true:trigger-press', 'false:trigger-press'])
  })

  it('follows a controlled triggerId', async (t) => {
    let { t1, t2, payload, act } = setupDetached(t, { open: true, triggerId: 't2' })
    await act(() => {})
    await act(() => {})
    expect(payload()).toBe('Two')
    expect(t2.getAttribute('aria-expanded')).toBe('true')
    expect(t1.getAttribute('aria-expanded')).toBe('false')
  })
})
