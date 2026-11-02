import { expect } from 'remix/assert'
import { describe, it } from 'remix/test'
import { on, type Handle } from 'remix/component'
import { render } from 'remix/component/test'

import * as drawer from './drawer.ts'
import {
  DrawerChangeEvent,
  DrawerSnapPointChangeEvent,
  onDrawerChange,
  onDrawerSnapPointChange,
} from './drawer.ts'

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

const css = `
  dialog.popup {
    position: fixed; inset: auto 0 0 0; margin: 0; width: auto; max-width: none;
    height: 200px; padding: 0; border: 0;
    transform: translateY(var(--drawer-swipe-movement-y));
  }
  dialog.popup[data-swipe-direction='right'] {
    inset: 0 0 0 auto; width: 200px; height: auto; max-height: none;
    transform: translateX(var(--drawer-swipe-movement-x));
  }
`

let pointerIds = 10

/** Drags with synthetic pointer events from (x, y) by (dx, dy) in `steps` moves. */
function drag(
  target: Element,
  from: { x: number; y: number },
  by: { x: number; y: number },
  options: { steps?: number; pointerType?: string; release?: boolean; stepMs?: number } = {},
) {
  let { steps = 5, pointerType = 'touch', release = true, stepMs = 16 } = options
  let pointerId = pointerIds++
  let init = { bubbles: true, cancelable: true, pointerId, pointerType, isPrimary: true }
  target.dispatchEvent(
    new PointerEvent('pointerdown', { ...init, clientX: from.x, clientY: from.y, button: 0 }),
  )
  let time = performance.now()
  for (let step = 1; step <= steps; step++) {
    time += stepMs
    let event = new PointerEvent('pointermove', {
      ...init,
      clientX: from.x + (by.x * step) / steps,
      clientY: from.y + (by.y * step) / steps,
    })
    Object.defineProperty(event, 'timeStamp', { value: time })
    target.dispatchEvent(event)
  }
  if (release) {
    let up = new PointerEvent('pointerup', {
      ...init,
      clientX: from.x + by.x,
      clientY: from.y + by.y,
    })
    Object.defineProperty(up, 'timeStamp', { value: time + stepMs })
    target.dispatchEvent(up)
  }
  return pointerId
}

type ExampleProps = drawer.DrawerContextProps & {
  nested?: boolean
  area?: drawer.DrawerSwipeAreaOptions | true
}

function Example(handle: Handle<ExampleProps>) {
  return () => {
    let { nested, area, children: _children, ...props } = handle.props
    return (
      <drawer.Context {...props}>
        <button class="trigger" mix={drawer.trigger()}>
          Open drawer
        </button>
        {area && (
          <div
            class="area"
            style={{ position: 'fixed', insetInline: '0', bottom: '0', height: '30px' }}
            mix={area === true ? drawer.swipeArea() : drawer.swipeArea(area)}
          />
        )}
        <div class="backdrop" mix={drawer.backdrop()} />
        <dialog class="popup" mix={drawer.popup()}>
          <div class="handle" style={{ height: '40px' }}>
            Handle
          </div>
          <div class="content" mix={drawer.content()}>
            <h2 mix={drawer.title()}>Move goal</h2>
            <p mix={drawer.description()}>Set your daily activity goal.</p>
            <input class="field" />
            <div class="ignored" data-swipe-ignore="">
              Carousel
            </div>
          </div>
          {nested && (
            <drawer.Context>
              <button class="inner-trigger" mix={drawer.trigger()}>
                More
              </button>
              <dialog class="popup inner" mix={drawer.popup()}>
                <div class="inner-handle" style={{ height: '40px' }}>
                  Inner
                </div>
                <button class="inner-close" mix={drawer.close()}>
                  Close
                </button>
              </dialog>
            </drawer.Context>
          )}
          <button class="close" mix={drawer.close()}>
            Close
          </button>
        </dialog>
      </drawer.Context>
    )
  }
}

function setup(t: T, props: ExampleProps = {}) {
  addStyle(t, css)
  let result = render(<Example {...props} />)
  t.after(result.cleanup)
  return {
    ...result,
    trigger: result.$('.trigger') as HTMLButtonElement,
    popup: result.$('dialog.popup') as HTMLDialogElement,
    handle: result.$('.handle') as HTMLElement,
  }
}

function startPoint(element: Element) {
  let rect = element.getBoundingClientRect()
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
}

describe('drawer', () => {
  it('is a modal dialog with drawer attributes and CSS variables', async (t) => {
    let { act, trigger, popup, $ } = setup(t)

    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog')
    expect(trigger.getAttribute('aria-controls')).toBe(popup.id)
    expect(popup.getAttribute('data-swipe-direction')).toBe('down')
    expect(popup.getAttribute('data-closed')).toBe('')
    expect(popup.style.getPropertyValue('--drawer-swipe-movement-y')).toBe('0px')
    expect(popup.style.getPropertyValue('--drawer-swipe-strength')).toBe('1')
    expect(popup.style.getPropertyValue('--nested-drawers')).toBe('0')
    expect(popup.style.getPropertyValue('--nested-dialogs')).toBe('0')
    expect(popup.style.touchAction).toBe('pan-x')
    expect(popup.getAttribute('aria-labelledby')).toBe(($('h2') as HTMLElement).id)

    await act(() => trigger.click())
    expect(popup.matches(':modal')).toBe(true)
    expect(popup.getAttribute('data-open')).toBe('')
    let backdrop = $('.backdrop') as HTMLElement
    expect(backdrop.hasAttribute('hidden')).toBe(false)
    expect(backdrop.style.getPropertyValue('--drawer-swipe-progress')).toBe('0')
  })

  it('dismisses on a long enough swipe in the swipe direction', async (t) => {
    let reasons: string[] = []
    let events: DrawerChangeEvent[] = []

    function App() {
      return () => (
        <div mix={onDrawerChange((event) => void events.push(event))}>
          <Example onOpenChange={(_open, details) => reasons.push(details.reason)} />
        </div>
      )
    }
    addStyle(t, css)
    let result = render(<App />)
    t.after(result.cleanup)
    let popup = result.$('dialog.popup') as HTMLDialogElement
    let handle = result.$('.handle') as HTMLElement

    await result.act(() => (result.$('.trigger') as HTMLButtonElement).click())
    await result.act(() => {
      drag(handle, startPoint(handle), { x: 0, y: 120 }, { release: false, stepMs: 40 })
    })
    expect(popup.getAttribute('data-swiping')).toBe('')
    expect(popup.style.getPropertyValue('--drawer-swipe-movement-y')).toBe('120px')
    expect(popup.style.getPropertyValue('--drawer-swipe-progress')).toBe('0.6')
    let backdrop = result.$('.backdrop') as HTMLElement
    expect(backdrop.style.getPropertyValue('--drawer-swipe-progress')).toBe('0.6')

    let rect = handle.getBoundingClientRect()
    await result.act(() => {
      let up = new PointerEvent('pointerup', {
        bubbles: true,
        pointerId: pointerIds - 1,
        pointerType: 'touch',
        clientX: rect.left + 5,
        clientY: rect.top + 5,
      })
      popup.dispatchEvent(up)
    })
    expect(popup.getAttribute('data-closed')).toBe('')
    expect(popup.getAttribute('data-swipe-dismiss')).toBe('')
    expect(popup.hasAttribute('data-swiping')).toBe(false)
    expect(reasons).toEqual(['trigger-press', 'swipe'])
    expect(events.at(-1)!.reason).toBe('swipe')
    await waitFor(() => !popup.open)
  })

  it('snaps back after a short, slow swipe', async (t) => {
    let { act, trigger, popup, handle } = setup(t)

    await act(() => trigger.click())
    await act(() => {
      drag(handle, startPoint(handle), { x: 0, y: 30 }, { steps: 6, stepMs: 100 })
    })
    expect(popup.getAttribute('data-open')).toBe('')
    expect(popup.hasAttribute('data-swiping')).toBe(false)
    expect(popup.style.getPropertyValue('--drawer-swipe-movement-y')).toBe('0px')
    expect(popup.style.getPropertyValue('--drawer-swipe-progress')).toBe('0')
  })

  it('dismisses on a fast flick', async (t) => {
    let { act, trigger, popup, handle } = setup(t)

    await act(() => trigger.click())
    await act(() => {
      drag(handle, startPoint(handle), { x: 0, y: 40 }, { steps: 4, stepMs: 8 })
    })
    expect(popup.getAttribute('data-closed')).toBe('')
    let strength = Number(popup.style.getPropertyValue('--drawer-swipe-strength'))
    expect(strength).toBeGreaterThan(0.09)
    expect(strength < 1).toBe(true)
  })

  it('ignores drags against the swipe direction and sideways drags', async (t) => {
    let { act, trigger, popup, handle } = setup(t)

    await act(() => trigger.click())
    await act(() => {
      drag(handle, startPoint(handle), { x: 0, y: -150 }, { stepMs: 40 })
    })
    expect(popup.getAttribute('data-open')).toBe('')

    await act(() => {
      drag(handle, startPoint(handle), { x: 150, y: 10 }, { stepMs: 40 })
    })
    expect(popup.getAttribute('data-open')).toBe('')
  })

  it('does not swipe from inputs, ignored elements, or mouse drags on content', async (t) => {
    let { act, trigger, popup, $ } = setup(t)

    await act(() => trigger.click())
    for (let selector of ['.field', '.ignored']) {
      let target = $(selector) as HTMLElement
      await act(() => {
        drag(target, startPoint(target), { x: 0, y: 150 }, { stepMs: 40 })
      })
      expect(popup.getAttribute('data-open')).toBe('')
    }

    let text = $('p') as HTMLElement
    await act(() => {
      drag(text, startPoint(text), { x: 0, y: 150 }, { stepMs: 40, pointerType: 'mouse' })
    })
    expect(popup.getAttribute('data-open')).toBe('')

    // Touch drags on content still swipe.
    await act(() => {
      drag(text, startPoint(text), { x: 0, y: 150 }, { stepMs: 40 })
    })
    expect(popup.getAttribute('data-closed')).toBe('')
  })

  it('supports other swipe directions', async (t) => {
    let { act, trigger, popup, handle } = setup(t, { swipeDirection: 'right' })

    expect(popup.getAttribute('data-swipe-direction')).toBe('right')
    expect(popup.style.touchAction).toBe('pan-y')
    await act(() => trigger.click())
    await act(() => {
      drag(handle, startPoint(handle), { x: 50, y: 0 }, { release: false, stepMs: 40 })
    })
    expect(popup.style.getPropertyValue('--drawer-swipe-movement-x')).toBe('50px')
    expect(popup.style.getPropertyValue('--drawer-swipe-movement-y')).toBe('0px')
    await act(() => {
      popup.dispatchEvent(
        new PointerEvent('pointercancel', { bubbles: true, pointerId: pointerIds - 1 }),
      )
    })
    expect(popup.style.getPropertyValue('--drawer-swipe-movement-x')).toBe('0px')
    expect(popup.getAttribute('data-open')).toBe('')
  })

  it('cancelled swipe dismissals snap back', async (t) => {
    let { act, trigger, popup, handle } = setup(t, {
      onOpenChange: (open, details) => {
        if (!open && details.reason === 'swipe') details.cancel()
      },
    })

    await act(() => trigger.click())
    await act(() => {
      drag(handle, startPoint(handle), { x: 0, y: 150 }, { stepMs: 40 })
    })
    expect(popup.getAttribute('data-open')).toBe('')
    expect(popup.hasAttribute('data-swipe-dismiss')).toBe(false)
    expect(popup.style.getPropertyValue('--drawer-swipe-movement-y')).toBe('0px')
  })

  it('closes on Escape and outside presses like a dialog', async (t) => {
    let reasons: string[] = []
    let { act, trigger, popup } = setup(t, {
      onOpenChange: (_open, details) => reasons.push(details.reason),
    })

    await act(() => trigger.click())
    await act(() => {
      ;(document.activeElement ?? document.body).dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
      )
    })
    await waitFor(() => !popup.open)

    await act(() => trigger.click())
    let rect = popup.getBoundingClientRect()
    await act(() => {
      popup.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
      popup.dispatchEvent(
        new MouseEvent('click', {
          bubbles: true,
          detail: 1,
          clientX: rect.left + 10,
          clientY: Math.max(1, rect.top - 20),
        }),
      )
    })
    expect(reasons).toEqual(['trigger-press', 'escape-key', 'trigger-press', 'outside-press'])
  })

  it('tracks nested drawers', async (t) => {
    let { act, trigger, popup, $ } = setup(t, { nested: true })
    let inner = $('dialog.inner') as HTMLDialogElement

    await act(() => trigger.click())
    await act(() => ($('.inner-trigger') as HTMLButtonElement).click())
    await waitFor(() => popup.hasAttribute('data-nested-drawer-open'))
    expect(popup.style.getPropertyValue('--nested-drawers')).toBe('1')
    expect(popup.style.getPropertyValue('--nested-dialogs')).toBe('1')
    expect(inner.getAttribute('data-nested')).toBe('')
    await waitFor(() => popup.style.getPropertyValue('--drawer-frontmost-height') === '200px')

    let innerHandle = $('.inner-handle') as HTMLElement
    await act(() => {
      drag(innerHandle, startPoint(innerHandle), { x: 0, y: 50 }, { release: false, stepMs: 40 })
    })
    await waitFor(() => popup.hasAttribute('data-nested-drawer-swiping'))
    expect(popup.style.getPropertyValue('--drawer-swipe-progress')).toBe('0.25')

    await act(() => {
      inner.dispatchEvent(
        new PointerEvent('pointercancel', { bubbles: true, pointerId: pointerIds - 1 }),
      )
    })
    await waitFor(() => !popup.hasAttribute('data-nested-drawer-swiping'))

    await act(() => ($('.inner-close') as HTMLButtonElement).click())
    await waitFor(() => !popup.hasAttribute('data-nested-drawer-open'))
    await waitFor(() => popup.style.getPropertyValue('--drawer-frontmost-height') === '')
  })

  it('activates indent parts inside drawer.Provider', async (t) => {
    function App() {
      return () => (
        <drawer.Provider>
          <div class="indent-bg" mix={drawer.indentBackground()} />
          <div class="indent" mix={drawer.indent()}>
            <Example />
          </div>
        </drawer.Provider>
      )
    }
    addStyle(t, css)
    let result = render(<App />)
    t.after(result.cleanup)
    let indent = result.$('.indent') as HTMLElement
    let background = result.$('.indent-bg') as HTMLElement
    let popup = result.$('dialog.popup') as HTMLDialogElement

    expect(indent.hasAttribute('data-active')).toBe(false)
    expect(indent.style.getPropertyValue('--drawer-swipe-progress')).toBe('0')
    await result.act(() => (result.$('.trigger') as HTMLButtonElement).click())
    await waitFor(() => indent.hasAttribute('data-active'))
    expect(background.getAttribute('data-active')).toBe('')

    await result.act(() => (result.$('.close') as HTMLButtonElement).click())
    await waitFor(() => !indent.hasAttribute('data-active'))
    await waitFor(() => !popup.open)
  })

  it('rests on the default snap point and drags between snap points', async (t) => {
    let changes: Array<[drawer.DrawerSnapPoint | null, string]> = []
    let events: DrawerSnapPointChangeEvent[] = []
    function App() {
      return () => (
        <div mix={onDrawerSnapPointChange((event) => void events.push(event))}>
          <Example
            snapPoints={['80px', 1]}
            onSnapPointChange={(point, details) => changes.push([point, details.reason])}
          />
        </div>
      )
    }
    addStyle(t, css)
    let result = render(<App />)
    t.after(result.cleanup)
    let popup = result.$('dialog.popup') as HTMLDialogElement
    let handle = result.$('.handle') as HTMLElement

    expect(popup.style.getPropertyValue('--drawer-snap-point-offset')).toBe('0px')
    await result.act(() => (result.$('.trigger') as HTMLButtonElement).click())
    // 200px popup at an 80px snap point: moved down by 120px.
    await waitFor(() => popup.style.getPropertyValue('--drawer-snap-point-offset') === '120px')
    expect(popup.hasAttribute('data-expanded')).toBe(false)
    expect(popup.style.getPropertyValue('--drawer-swipe-progress')).toBe('1')

    // Drag up 100px: the popup follows without damping.
    await result.act(() => {
      drag(handle, startPoint(handle), { x: 0, y: -100 }, { release: false, stepMs: 80 })
    })
    expect(popup.getAttribute('data-swiping')).toBe('')
    expect(popup.style.getPropertyValue('--drawer-swipe-movement-y')).toBe('-100px')
    expect(popup.style.getPropertyValue('--drawer-swipe-progress')).toBe('0.167')
    await result.act(() => {
      let up = new PointerEvent('pointerup', { bubbles: true, pointerId: pointerIds - 1 })
      Object.defineProperty(up, 'timeStamp', { value: performance.now() + 1000 })
      popup.dispatchEvent(up)
    })
    expect(changes).toEqual([[1, 'swipe']])
    expect(events.at(-1)!.snapPoint).toBe(1)
    expect(events.at(-1)!.reason).toBe('swipe')
    expect(popup.getAttribute('data-expanded')).toBe('')
    expect(popup.hasAttribute('data-swiping')).toBe(false)
    expect(popup.style.getPropertyValue('--drawer-snap-point-offset')).toBe('0px')
    expect(popup.style.getPropertyValue('--drawer-swipe-movement-y')).toBe('0px')
    expect(popup.style.getPropertyValue('--drawer-swipe-progress')).toBe('0')

    // A short drag down settles back; a longer one moves to the lower point.
    await result.act(() => {
      drag(handle, startPoint(handle), { x: 0, y: 30 }, { steps: 6, stepMs: 100 })
    })
    expect(popup.getAttribute('data-expanded')).toBe('')
    await result.act(() => {
      drag(handle, startPoint(handle), { x: 0, y: 90 }, { steps: 6, stepMs: 100 })
    })
    expect(changes.at(-1)).toEqual(['80px', 'swipe'])
    expect(popup.style.getPropertyValue('--drawer-snap-point-offset')).toBe('120px')
    expect(popup.getAttribute('data-open')).toBe('')
  })

  it('dismisses when released past the lowest snap point and resets on close', async (t) => {
    let reasons: string[] = []
    let changes: Array<drawer.DrawerSnapPoint | null> = []
    let { act, trigger, popup, handle } = setup(t, {
      snapPoints: ['80px', 1],
      defaultSnapPoint: 1,
      onOpenChange: (_open, details) => reasons.push(details.reason),
      onSnapPointChange: (point) => changes.push(point),
    })

    expect(popup.getAttribute('data-expanded')).toBe('')
    await act(() => trigger.click())
    await waitFor(() => popup.open)
    await nextFrame()
    await nextFrame()
    await act(() => {
      drag(handle, startPoint(handle), { x: 0, y: 130 }, { steps: 6, stepMs: 100 })
    })
    expect(changes).toEqual(['80px'])
    await act(() => {
      drag(handle, startPoint(handle), { x: 0, y: 60 }, { steps: 6, stepMs: 100 })
    })
    expect(popup.getAttribute('data-closed')).toBe('')
    expect(popup.getAttribute('data-swipe-dismiss')).toBe('')
    expect(reasons).toEqual(['trigger-press', 'swipe'])
    // Dismissal clears the snap point, then closing resets it to the default.
    expect(changes).toEqual(['80px', null, 1])
    expect(popup.style.getPropertyValue('--drawer-height')).toBe('200px')
    await waitFor(() => !popup.open)
    expect(popup.getAttribute('data-expanded')).toBe('')
  })

  it('supports a controlled snap point and cancelling changes', async (t) => {
    let point: drawer.DrawerSnapPoint | null = '80px'
    let allow = false
    let update = () => {}
    function App(handle: Handle) {
      update = () => void handle.update()
      return () => (
        <Example
          snapPoints={['80px', 1]}
          snapPoint={point}
          onSnapPointChange={(next, details) => {
            if (!allow) return details.cancel()
            point = next
            void handle.update()
          }}
        />
      )
    }
    addStyle(t, css)
    let result = render(<App />)
    t.after(result.cleanup)
    let popup = result.$('dialog.popup') as HTMLDialogElement
    let handle = result.$('.handle') as HTMLElement

    await result.act(() => (result.$('.trigger') as HTMLButtonElement).click())
    await waitFor(() => popup.style.getPropertyValue('--drawer-snap-point-offset') === '120px')

    // Cancelled: the drawer snaps back.
    await result.act(() => {
      drag(handle, startPoint(handle), { x: 0, y: -110 }, { steps: 6, stepMs: 100 })
    })
    expect(popup.style.getPropertyValue('--drawer-snap-point-offset')).toBe('120px')
    expect(popup.hasAttribute('data-expanded')).toBe(false)

    // Controlled from outside (e.g. a keyboard-accessible "Expand" button).
    await result.act(() => {
      point = 1
      update()
    })
    expect(popup.style.getPropertyValue('--drawer-snap-point-offset')).toBe('0px')
    expect(popup.getAttribute('data-expanded')).toBe('')

    allow = true
    await result.act(() => {
      drag(handle, startPoint(handle), { x: 0, y: 100 }, { steps: 6, stepMs: 100 })
    })
    expect(point).toBe('80px')
    expect(popup.style.getPropertyValue('--drawer-snap-point-offset')).toBe('120px')
  })

  it('ignores snap points for horizontal drawers', async (t) => {
    let { act, trigger, popup, handle } = setup(t, {
      swipeDirection: 'right',
      snapPoints: ['80px', 1],
    })
    await act(() => trigger.click())
    await nextFrame()
    await nextFrame()
    expect(popup.style.getPropertyValue('--drawer-snap-point-offset')).toBe('0px')
    await act(() => {
      drag(handle, startPoint(handle), { x: 150, y: 0 }, { stepMs: 40 })
    })
    expect(popup.getAttribute('data-closed')).toBe('')
  })

  it('sets --drawer-height while a nested drawer is open', async (t) => {
    let { act, trigger, popup, $ } = setup(t, { nested: true })
    await act(() => trigger.click())
    await act(() => ($('.inner-trigger') as HTMLButtonElement).click())
    await waitFor(() => popup.style.getPropertyValue('--drawer-height') === '200px')
    await act(() => ($('.inner-close') as HTMLButtonElement).click())
    await waitFor(() => popup.style.getPropertyValue('--drawer-height') === '')
  })

  it('opens from a swipe area and follows the pointer', async (t) => {
    let reasons: string[] = []
    let { act, popup, $ } = setup(t, {
      area: true,
      onOpenChange: (_open, details) => reasons.push(details.reason),
    })
    let area = $('.area') as HTMLElement

    expect(area.getAttribute('role')).toBe('presentation')
    expect(area.getAttribute('aria-hidden')).toBe('true')
    expect(area.getAttribute('data-swipe-direction')).toBe('up')
    expect(area.getAttribute('data-closed')).toBe('')
    expect(area.style.touchAction).toBe('pan-x')
    expect(area.style.pointerEvents).toBe('auto')

    await act(() => {
      drag(area, startPoint(area), { x: 0, y: -120 }, { release: false, stepMs: 80 })
    })
    expect(reasons).toEqual(['swipe'])
    expect(popup.getAttribute('data-open')).toBe('')
    expect(area.getAttribute('data-swiping')).toBe('')
    expect(popup.getAttribute('data-swiping')).toBe('')
    // The popup is 200px tall and 120px of it has been pulled in.
    await waitFor(() => popup.style.getPropertyValue('--drawer-swipe-movement-y') === '80px')
    expect(popup.style.getPropertyValue('--drawer-swipe-progress')).toBe('0.4')

    await act(() => {
      let up = new PointerEvent('pointerup', { bubbles: true, pointerId: pointerIds - 1 })
      Object.defineProperty(up, 'timeStamp', { value: performance.now() + 1000 })
      area.dispatchEvent(up)
    })
    expect(popup.getAttribute('data-open')).toBe('')
    expect(area.hasAttribute('data-swiping')).toBe(false)
    expect(popup.hasAttribute('data-swiping')).toBe(false)
    expect(popup.style.getPropertyValue('--drawer-swipe-movement-y')).toBe('0px')
    expect(area.getAttribute('data-open')).toBe('')
    expect(area.style.pointerEvents).toBe('none')

    // The click that ends the gesture (on the common ancestor of press and release, with no
    // pointerdown of its own) is not an outside press.
    await act(() => {
      document.body.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }))
    })
    expect(popup.getAttribute('data-open')).toBe('')
    // A later deliberate outside press still dismisses.
    await act(() => {
      document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
      document.body.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }))
    })
    expect(popup.getAttribute('data-closed')).toBe('')
  })

  it('closes again when a swipe-area drag is released early', async (t) => {
    let reasons: string[] = []
    let { act, popup, $ } = setup(t, {
      area: true,
      onOpenChange: (_open, details) => reasons.push(details.reason),
    })
    let area = $('.area') as HTMLElement

    await act(() => {
      drag(area, startPoint(area), { x: 0, y: -30 }, { steps: 6, stepMs: 100 })
    })
    expect(reasons).toEqual(['swipe', 'swipe'])
    expect(popup.getAttribute('data-closed')).toBe('')

    // Sideways drags and drags the wrong way don't open.
    await act(() => {
      drag(area, startPoint(area), { x: 120, y: -10 }, { stepMs: 40 })
      drag(area, startPoint(area), { x: 0, y: 80 }, { stepMs: 40 })
    })
    expect(reasons).toEqual(['swipe', 'swipe'])
  })

  it('respects disabled swipe areas and custom open directions', async (t) => {
    let { act, popup, $ } = setup(t, { area: { disabled: true, swipeDirection: 'left' } })
    let area = $('.area') as HTMLElement
    expect(area.getAttribute('data-disabled')).toBe('')
    expect(area.getAttribute('data-swipe-direction')).toBe('left')
    expect(area.style.touchAction).toBe('pan-y')
    expect(area.style.pointerEvents).toBe('none')
    await act(() => {
      drag(area, startPoint(area), { x: -120, y: 0 }, { stepMs: 40 })
    })
    expect(popup.getAttribute('data-closed')).toBe('')
  })
})

describe('drawer detached triggers', () => {
  it('opens from detached triggers with their payloads and returns focus', async (t) => {
    addStyle(t, css)
    let h = drawer.createHandle<string>()
    let result = render(
      <div>
        <button id="d1" mix={drawer.trigger({ handle: h, payload: 'Steps' })}>
          Steps
        </button>
        <button id="d2" mix={drawer.trigger({ handle: h, payload: 'Calories' })}>
          Calories
        </button>
        <drawer.Context handle={h}>
          {({ payload }) => (
            <dialog class="popup" mix={drawer.popup()}>
              <h2 mix={drawer.title()}>{String(payload ?? 'none')}</h2>
              <button class="close" mix={drawer.close()}>
                Close
              </button>
            </dialog>
          )}
        </drawer.Context>
      </div>,
    )
    t.after(result.cleanup)
    let d1 = result.$('#d1') as HTMLButtonElement
    let d2 = result.$('#d2') as HTMLButtonElement
    let popup = result.$('dialog.popup') as HTMLDialogElement
    await result.act(() => {})
    expect(d2.getAttribute('aria-haspopup')).toBe('dialog')
    expect(d2.getAttribute('aria-controls')).toBe(popup.id)

    d1.focus()
    await result.act(() => d1.click())
    await result.act(() => {})
    expect(popup.open).toBe(true)
    expect(result.$('h2')!.textContent).toBe('Steps')
    expect(d1.getAttribute('aria-expanded')).toBe('true')
    expect(d1.hasAttribute('data-popup-open')).toBe(true)

    await result.act(() => (result.$('.close') as HTMLElement).click())
    await waitFor(() => !popup.open)
    await result.act(() => {})
    expect(document.activeElement).toBe(d1)
    expect(d1.getAttribute('aria-expanded')).toBe('false')

    await result.act(() => h.openWithPayload('Custom'))
    await result.act(() => {})
    expect(popup.open).toBe(true)
    expect(result.$('h2')!.textContent).toBe('Custom')
    await result.act(() => h.close())
    await waitFor(() => !popup.open)
    expect(d2.getAttribute('aria-expanded')).toBe('false')
  })
})
