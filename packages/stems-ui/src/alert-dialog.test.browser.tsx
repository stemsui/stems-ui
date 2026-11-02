import { expect } from 'remix/assert'
import { describe, it } from 'remix/test'
import type { Handle } from 'remix/component'
import { render } from 'remix/component/test'

import * as alertDialog from './alert-dialog.ts'
import { AlertDialogChangeEvent, onAlertDialogChange } from './alert-dialog.ts'
import * as dialog from './dialog.ts'

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

function escape() {
  let event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
  ;(document.activeElement ?? document.body).dispatchEvent(event)
  return event
}

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

function pressBackdrop(popup: HTMLDialogElement) {
  let rect = popup.getBoundingClientRect()
  pressAt(popup, Math.max(1, rect.left - 10), Math.max(1, rect.top - 10))
}

const css = `dialog { width: 300px; height: 160px; padding: 0; margin: auto; }`

function Example(handle: Handle<alertDialog.AlertDialogContextProps & { backdrop?: boolean }>) {
  return () => {
    let { backdrop, children: _children, ...props } = handle.props
    return (
      <alertDialog.Context {...props}>
        <button class="trigger" mix={alertDialog.trigger()}>
          Delete account
        </button>
        {backdrop && <div class="backdrop" mix={alertDialog.backdrop()} />}
        <dialog class="popup" mix={alertDialog.popup()}>
          <h2 mix={alertDialog.title()}>Are you absolutely sure?</h2>
          <p mix={alertDialog.description()}>This action cannot be undone.</p>
          <button class="cancel" mix={alertDialog.close()}>
            Cancel
          </button>
          <button class="action" mix={alertDialog.close()}>
            Continue
          </button>
        </dialog>
      </alertDialog.Context>
    )
  }
}

function setup(t: T, props: alertDialog.AlertDialogContextProps & { backdrop?: boolean } = {}) {
  addStyle(t, css)
  let result = render(<Example {...props} />)
  t.after(result.cleanup)
  return {
    ...result,
    trigger: result.$('.trigger') as HTMLButtonElement,
    popup: result.$('dialog') as HTMLDialogElement,
  }
}

describe('alert dialog', () => {
  it('renders an alertdialog that is always modal', async (t) => {
    let { act, trigger, popup, $ } = setup(t)

    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog')
    expect(popup.getAttribute('role')).toBe('alertdialog')
    expect(popup.getAttribute('aria-modal')).toBe('true')
    expect(popup.getAttribute('aria-labelledby')).toBe(($('h2') as HTMLElement).id)
    expect(popup.getAttribute('aria-describedby')).toBe(($('p') as HTMLElement).id)

    await act(() => trigger.click())
    expect(popup.matches(':modal')).toBe(true)
    expect(document.activeElement).toBe($('.cancel'))
    expect(document.documentElement.style.overflow).toBe('hidden')
  })

  it('ignores outside presses', async (t) => {
    let reasons: string[] = []
    let { act, trigger, popup } = setup(t, {
      onOpenChange: (_open, details) => reasons.push(details.reason),
    })

    await act(() => trigger.click())
    await act(() => pressBackdrop(popup))
    expect(popup.getAttribute('data-open')).toBe('')
    expect(reasons).toEqual(['trigger-press'])
  })

  it('ignores presses on a separate backdrop element', async (t) => {
    let { act, trigger, popup, $ } = setup(t, { backdrop: true })

    await act(() => trigger.click())
    let backdrop = $('.backdrop') as HTMLElement
    expect(backdrop.hasAttribute('hidden')).toBe(false)
    await act(() => pressAt(backdrop, 1, 1))
    expect(popup.getAttribute('data-open')).toBe('')
  })

  it('closes on Escape and returns focus to the trigger', async (t) => {
    let reasons: string[] = []
    let { act, trigger, popup } = setup(t, {
      onOpenChange: (_open, details) => reasons.push(details.reason),
    })

    trigger.focus()
    await act(() => trigger.click())
    await act(() => escape())
    expect(popup.getAttribute('data-closed')).toBe('')
    await waitFor(() => !popup.open)
    expect(document.activeElement).toBe(trigger)
    expect(reasons).toEqual(['trigger-press', 'escape-key'])
  })

  it('closes from its close buttons', async (t) => {
    let events: AlertDialogChangeEvent[] = []

    function App() {
      return () => (
        <div mix={onAlertDialogChange((event) => void events.push(event))}>
          <Example />
        </div>
      )
    }

    addStyle(t, css)
    let result = render(<App />)
    t.after(result.cleanup)
    let popup = result.$('dialog') as HTMLDialogElement

    await result.act(() => (result.$('.trigger') as HTMLButtonElement).click())
    await result.act(() => (result.$('.action') as HTMLButtonElement).click())
    await waitFor(() => !popup.open)

    expect(events.map((event) => `${event.open}:${event.reason}`)).toEqual([
      'true:trigger-press',
      'false:close-press',
    ])
    expect(events[0]).toBeInstanceOf(AlertDialogChangeEvent)
  })

  it('nested in a dialog, a backdrop press closes neither', async (t) => {
    function App() {
      return () => (
        <dialog.Context>
          <button class="outer-trigger" mix={dialog.trigger()}>
            Settings
          </button>
          <dialog class="outer" mix={dialog.popup()}>
            <alertDialog.Context>
              <button class="trigger" mix={alertDialog.trigger()}>
                Reset
              </button>
              <dialog class="inner" mix={alertDialog.popup()}>
                <button mix={alertDialog.close()}>Cancel</button>
              </dialog>
            </alertDialog.Context>
          </dialog>
        </dialog.Context>
      )
    }

    addStyle(t, css)
    let result = render(<App />)
    t.after(result.cleanup)
    let outer = result.$('dialog.outer') as HTMLDialogElement
    let inner = result.$('dialog.inner') as HTMLDialogElement

    await result.act(() => (result.$('.outer-trigger') as HTMLButtonElement).click())
    await result.act(() => (result.$('.trigger') as HTMLButtonElement).click())
    expect(inner.getAttribute('data-nested')).toBe('')
    await waitFor(() => outer.hasAttribute('data-nested-dialog-open'))

    await result.act(() => pressBackdrop(inner))
    expect(inner.getAttribute('data-open')).toBe('')
    expect(outer.getAttribute('data-open')).toBe('')

    await result.act(() => escape())
    expect(inner.getAttribute('data-closed')).toBe('')
    expect(outer.getAttribute('data-open')).toBe('')
  })
})

describe('alert dialog detached triggers', () => {
  it('opens from detached triggers with their payloads and returns focus', async (t) => {
    addStyle(t, css)
    let h = alertDialog.createHandle<{ item: string }>()
    let result = render(
      <div>
        <button id="d1" mix={alertDialog.trigger({ handle: h, payload: { item: 'file.txt' } })}>
          Delete file
        </button>
        <button id="d2" mix={alertDialog.trigger({ handle: h, payload: { item: 'photo.png' } })}>
          Delete photo
        </button>
        <alertDialog.Context handle={h}>
          {({ payload }) => (
            <dialog class="popup" mix={alertDialog.popup()}>
              <h2 mix={alertDialog.title()}>Delete {payload?.item}?</h2>
              <button class="cancel" mix={alertDialog.close()}>
                Cancel
              </button>
            </dialog>
          )}
        </alertDialog.Context>
      </div>,
    )
    t.after(result.cleanup)
    let d1 = result.$('#d1') as HTMLButtonElement
    let d2 = result.$('#d2') as HTMLButtonElement
    let popup = result.$('dialog') as HTMLDialogElement
    await result.act(() => {})
    expect(d1.getAttribute('aria-controls')).toBe(popup.id)
    expect(d1.getAttribute('aria-expanded')).toBe('false')

    d2.focus()
    await result.act(() => d2.click())
    await result.act(() => {})
    expect(popup.open).toBe(true)
    expect(popup.getAttribute('role')).toBe('alertdialog')
    expect(popup.matches(':modal')).toBe(true)
    expect(result.$('h2')!.textContent).toBe('Delete photo.png?')
    expect(d2.getAttribute('aria-expanded')).toBe('true')
    expect(d1.getAttribute('aria-expanded')).toBe('false')

    await result.act(() => (result.$('.cancel') as HTMLElement).click())
    await waitFor(() => !popup.open)
    await result.act(() => {})
    expect(document.activeElement).toBe(d2)
    expect(d2.getAttribute('aria-expanded')).toBe('false')

    await result.act(() => h.open('d1'))
    await result.act(() => {})
    expect(result.$('h2')!.textContent).toBe('Delete file.txt?')
    expect(h.isOpen).toBe(true)
    escape()
    await waitFor(() => !popup.open)
    expect(h.isOpen).toBe(false)
  })
})
