import { expect } from 'remix/assert'
import { describe, it } from 'remix/test'
import type { Handle } from 'remix/component'
import { render } from 'remix/component/test'

import * as toast from './toast.ts'

type T = { after(fn: () => void): void }

function nextFrame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

async function waitFor(condition: () => boolean, timeout = 2000) {
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

function List(handle: Handle<{ swipeDirection?: toast.ToastSwipeDirection[] }>) {
  let ctx = handle.context.get(toast.Context)
  return () => (
    <div class="viewport" mix={toast.viewport()}>
      {ctx.toasts.map((item) => (
        <div
          key={item.id}
          class="toast"
          data-id={item.id}
          mix={toast.root({ toast: item, swipeDirection: handle.props.swipeDirection })}
        >
          <div class="content" mix={toast.content({ toast: item })}>
            <h2 class="title" mix={toast.title({ toast: item })}>
              {item.title}
            </h2>
            <p class="description" mix={toast.description({ toast: item })}>
              {item.description}
            </p>
            {item.actionProps ? (
              <button class="action" mix={toast.action({ toast: item })}>
                {item.actionProps.children}
              </button>
            ) : null}
            <button class="close" aria-label="Close" mix={toast.close({ toast: item })}>
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

function setup(
  t: T,
  props: Omit<toast.ToastContextProps, 'children'> & {
    swipeDirection?: toast.ToastSwipeDirection[]
  } = {},
) {
  let { swipeDirection, ...contextProps } = props
  let manager = contextProps.toastManager ?? toast.createToastManager()
  let result = render(
    <toast.Context {...contextProps} toastManager={manager}>
      <List swipeDirection={swipeDirection} />
    </toast.Context>,
  )
  t.after(result.cleanup)
  let viewport = result.$('.viewport') as HTMLDivElement
  let toasts = () => [...result.container.querySelectorAll<HTMLElement>('.toast')]
  let byId = (id: string) => result.container.querySelector<HTMLElement>(`[data-id="${id}"]`)
  return { ...result, manager, viewport, toasts, byId }
}

describe('toast manager', () => {
  it('adds, updates, upserts, and closes toasts', () => {
    let manager = toast.createToastManager()
    let events: string[] = []
    let unsubscribe = manager.subscribe((_toasts, event) =>
      events.push(`${event.type}:${event.id}`),
    )

    let id = manager.add({ title: 'Saved', type: 'success' })
    expect(manager.toasts.length).toBe(1)
    expect(manager.toasts[0].title).toBe('Saved')
    expect(manager.toasts[0].transitionStatus).toBe('starting')

    manager.update(id, { description: 'All good' })
    expect(manager.toasts[0].description).toBe('All good')
    expect(manager.toasts[0].updateKey).toBe(1)

    manager.update(id, (prev) => ({ title: `${prev.title}!` }))
    expect(manager.toasts[0].title).toBe('Saved!')

    expect(manager.add({ id, title: 'Again' })).toBe(id)
    expect(manager.toasts.length).toBe(1)
    expect(manager.toasts[0].title).toBe('Again')

    let second = manager.add({ title: 'Second' })
    expect(manager.toasts[0].id).toBe(second)

    // Without a renderer, closed toasts are removed right away.
    let removed: string[] = []
    manager.update(id, { onRemove: () => removed.push(id) })
    manager.close(id)
    expect(manager.toasts.map((item) => item.id)).toEqual([second])
    expect(removed).toEqual([id])

    manager.close()
    expect(manager.toasts.length).toBe(0)
    unsubscribe()
    manager.add({ title: 'Unheard' })
    expect(events).toEqual([
      `add:${id}`,
      `update:${id}`,
      `update:${id}`,
      `add:${id}`,
      `add:${second}`,
      `update:${id}`,
      `close:${id}`,
      `remove:${id}`,
      `close:${second}`,
      `remove:${second}`,
    ])
  })

  it('tracks promises', async () => {
    let manager = toast.createToastManager()
    let resolve!: (value: string) => void
    let promise = new Promise<string>((done) => (resolve = done))
    let returned = manager.promise(promise, {
      loading: 'Loading…',
      success: (value) => ({ title: 'Done', description: `Hello ${value}` }),
      error: 'Failed',
    })
    expect(returned).toBe(promise)
    expect(manager.toasts[0].type).toBe('loading')
    expect(manager.toasts[0].description).toBe('Loading…')
    expect(manager.toasts[0].timeout).toBe(0)

    resolve('world')
    await promise
    await Promise.resolve()
    expect(manager.toasts[0].type).toBe('success')
    expect(manager.toasts[0].title).toBe('Done')
    expect(manager.toasts[0].description).toBe('Hello world')
    expect(manager.toasts[0].timeout).toBe(undefined)

    let rejected = Promise.reject(new Error('nope'))
    let returnedRejection = manager.promise(rejected, {
      loading: 'Loading…',
      success: 'Done',
      error: (error) => `Error: ${(error as Error).message}`,
    })
    await returnedRejection.catch(() => {})
    await Promise.resolve()
    expect(manager.toasts[0].type).toBe('error')
    expect(manager.toasts[0].description).toBe('Error: nope')
  })
})

describe('toast', () => {
  it('renders toasts newest first with accessible markup', async (t) => {
    let { act, manager, viewport, toasts } = setup(t)

    expect(viewport.getAttribute('role')).toBe('region')
    expect(viewport.getAttribute('aria-label')).toBe('Notifications')
    expect(viewport.getAttribute('tabindex')).toBe('-1')
    expect(toasts().length).toBe(0)

    let first = ''
    let second = ''
    await act(() => {
      first = manager.add({ title: 'First', description: 'One', type: 'info' })
      second = manager.add({ title: 'Second', priority: 'high' })
    })

    let [front, back] = toasts()
    expect(front.dataset.id).toBe(second)
    expect(back.dataset.id).toBe(first)
    expect(front.getAttribute('role')).toBe('alertdialog')
    expect(back.getAttribute('role')).toBe('dialog')
    expect(back.getAttribute('aria-modal')).toBe('false')
    expect(back.getAttribute('tabindex')).toBe('0')
    expect(back.getAttribute('data-type')).toBe('info')
    expect(back.querySelector('.title')!.getAttribute('data-type')).toBe('info')
    expect(back.getAttribute('aria-labelledby')).toBe(back.querySelector('.title')!.id)
    expect(back.getAttribute('aria-describedby')).toBe(back.querySelector('.description')!.id)
    expect(front.hasAttribute('aria-describedby')).toBe(false)

    await waitFor(() => front.style.getPropertyValue('--toast-index') === '0')
    expect(back.style.getPropertyValue('--toast-index')).toBe('1')
    expect(front.style.getPropertyValue('--toast-offset-y')).toBe('0px')
    let frontHeight = front.offsetHeight
    expect(front.style.getPropertyValue('--toast-height')).toBe(`${frontHeight}px`)
    await waitFor(() => back.style.getPropertyValue('--toast-offset-y') === `${frontHeight}px`)
    expect(front.style.getPropertyValue('--toast-swipe-movement-x')).toBe('0px')
    expect(viewport.style.getPropertyValue('--toast-frontmost-height')).toBe(`${frontHeight}px`)

    expect(front.querySelector('.content')!.hasAttribute('data-behind')).toBe(false)
    expect(back.querySelector('.content')!.hasAttribute('data-behind')).toBe(true)
  })

  it('announces toasts politely or assertively', async (t) => {
    let { act, manager } = setup(t)
    await act(() => {
      manager.add({ title: 'Saved', description: 'Your file was saved.' })
      manager.add({ title: 'Disk full', priority: 'high' })
    })
    await nextFrame()

    let polite = document.querySelector('[data-stems-toast-announcer="polite"]')!
    let assertive = document.querySelector('[data-stems-toast-announcer="assertive"]')!
    expect(polite.getAttribute('role')).toBe('status')
    expect(polite.getAttribute('aria-live')).toBe('polite')
    expect(assertive.getAttribute('role')).toBe('alert')
    expect(assertive.getAttribute('aria-live')).toBe('assertive')
    expect(polite.textContent).toContain('Saved. Your file was saved.')
    expect(assertive.textContent).toContain('Disk full')
    expect(polite.textContent).not.toContain('Disk full')
  })

  it('removes the announcer when the provider unmounts', async (t) => {
    let { cleanup } = setup(t)
    await nextFrame()
    expect(document.querySelectorAll('[data-stems-toast-announcer]').length).toBe(2)
    cleanup()
    expect(document.querySelectorAll('[data-stems-toast-announcer]').length).toBe(0)
  })

  it('runs the enter transition with data-starting-style', async (t) => {
    let { act, manager, toasts } = setup(t)
    let id = ''
    await act(() => {
      id = manager.add({ title: 'Hello' })
    })
    let [item] = toasts()
    expect(item.hasAttribute('data-starting-style')).toBe(true)
    await waitFor(() => !item.hasAttribute('data-starting-style'))
    await waitFor(() => manager.toasts[0].transitionStatus === undefined)
    expect(manager.toasts[0].id).toBe(id)
  })

  it('keeps a closed toast mounted until its exit animation finishes', async (t) => {
    addStyle(
      t,
      '.toast { transition: opacity 200ms linear } .toast[data-ending-style] { opacity: 0 }',
    )
    let removed = 0
    let closed = 0
    let { act, manager, byId } = setup(t)
    let id = ''
    await act(() => {
      id = manager.add({ title: 'Bye', onClose: () => closed++, onRemove: () => removed++ })
    })
    await waitFor(() => manager.toasts[0].transitionStatus === undefined)

    await act(() => manager.close(id))
    let node = byId(id)!
    expect(node).not.toBe(null)
    expect(node.hasAttribute('data-ending-style')).toBe(true)
    expect(closed).toBe(1)
    expect(removed).toBe(0)

    await sleep(80)
    expect(byId(id)).not.toBe(null)
    expect(removed).toBe(0)

    await waitFor(() => byId(id) === null)
    expect(removed).toBe(1)
    expect(manager.toasts.length).toBe(0)
  })

  it('closes with the close part', async (t) => {
    let { act, manager, toasts } = setup(t)
    await act(() => {
      manager.add({ title: 'Closable' })
    })
    await act(() => (toasts()[0].querySelector('.close') as HTMLButtonElement).click())
    expect(toasts()[0].hasAttribute('data-ending-style')).toBe(true)
    await waitFor(() => toasts().length === 0)
  })

  it('applies actionProps to the action part', async (t) => {
    let clicks = 0
    let { act, manager, toasts } = setup(t)
    await act(() => {
      manager.add({
        title: 'Deleted',
        type: 'success',
        actionProps: { children: 'Undo', 'data-test': 'undo', onClick: () => clicks++ },
      })
    })
    let button = toasts()[0].querySelector('.action') as HTMLButtonElement
    expect(button.textContent).toBe('Undo')
    expect(button.getAttribute('type')).toBe('button')
    expect(button.getAttribute('data-test')).toBe('undo')
    expect(button.getAttribute('data-type')).toBe('success')
    button.click()
    expect(clicks).toBe(1)
  })

  it('auto-dismisses after the timeout', async (t) => {
    let { act, manager, toasts } = setup(t, { timeout: 100 })
    await act(() => {
      manager.add({ title: 'Default timeout' })
      manager.add({ title: 'Own timeout', timeout: 300 })
      manager.add({ title: 'Sticky', timeout: 0 })
    })
    expect(toasts().length).toBe(3)
    await sleep(180)
    expect(manager.toasts.find((item) => item.title === 'Default timeout')).toBe(undefined)
    expect(manager.toasts.length).toBe(2)
    await sleep(250)
    expect(manager.toasts.map((item) => item.title)).toEqual(['Sticky'])
  })

  it('auto-dismisses with fake timers', async (t) => {
    let timers = t.useFakeTimers()
    let { act, manager } = setup(t, { timeout: 1000 })
    await act(() => {
      manager.add({ title: 'Tick' })
    })
    timers.advance(999)
    expect(manager.toasts[0].transitionStatus).not.toBe('ending')
    timers.advance(1)
    expect(manager.toasts.length === 0 || manager.toasts[0].transitionStatus === 'ending').toBe(
      true,
    )
  })

  it('restarts the timer when a promise settles', async (t) => {
    let { act, manager } = setup(t, { timeout: 100 })
    let resolve!: () => void
    await act(() => {
      void manager.promise(new Promise<void>((done) => (resolve = done)), {
        loading: 'Saving…',
        success: 'Saved',
        error: 'Failed',
      })
    })
    await sleep(150)
    expect(manager.toasts[0].type).toBe('loading')
    resolve()
    await sleep(20)
    expect(manager.toasts[0].type).toBe('success')
    await waitFor(() => manager.toasts.length === 0)
  })

  it('pauses timers while hovered and expands the viewport', async (t) => {
    let { act, manager, viewport, toasts } = setup(t, { timeout: 150 })
    await act(() => {
      manager.add({ title: 'Hover me' })
    })
    await act(() =>
      viewport.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' })),
    )
    expect(viewport.hasAttribute('data-expanded')).toBe(true)
    expect(toasts()[0].hasAttribute('data-expanded')).toBe(true)
    expect(toasts()[0].querySelector('.content')!.hasAttribute('data-expanded')).toBe(true)

    await sleep(250)
    expect(manager.toasts.length).toBe(1)
    expect(manager.toasts[0].transitionStatus).not.toBe('ending')

    await act(() =>
      viewport.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' })),
    )
    expect(viewport.hasAttribute('data-expanded')).toBe(false)
    await waitFor(() => manager.toasts.length === 0)
  })

  it('pauses timers while focus is inside the viewport', async (t) => {
    let { act, manager, viewport, toasts } = setup(t, { timeout: 150 })
    await act(() => {
      manager.add({ title: 'Focus me' })
    })
    await act(() => toasts()[0].focus())
    expect(viewport.hasAttribute('data-expanded')).toBe(true)
    await sleep(250)
    expect(manager.toasts.length).toBe(1)

    await act(() => toasts()[0].blur())
    expect(viewport.hasAttribute('data-expanded')).toBe(false)
    await waitFor(() => manager.toasts.length === 0)
  })

  it('pauses timers while the window is blurred', async (t) => {
    let { act, manager } = setup(t, { timeout: 150 })
    await act(() => {
      manager.add({ title: 'Blur' })
    })
    window.dispatchEvent(new Event('blur'))
    await sleep(250)
    expect(manager.toasts.length).toBe(1)
    window.dispatchEvent(new Event('focus'))
    await waitFor(() => manager.toasts.length === 0)
  })

  it('moves focus into the viewport with F6 and back', async (t) => {
    let { act, manager, viewport } = setup(t)
    let outside = document.createElement('button')
    outside.textContent = 'Outside'
    document.body.append(outside)
    t.after(() => outside.remove())
    outside.focus()

    // No toasts: F6 is left alone.
    let empty = new KeyboardEvent('keydown', { key: 'F6', bubbles: true, cancelable: true })
    outside.dispatchEvent(empty)
    expect(empty.defaultPrevented).toBe(false)
    expect(document.activeElement).toBe(outside)

    await act(() => {
      manager.add({ title: 'Jump here' })
    })
    await act(() =>
      outside.dispatchEvent(new KeyboardEvent('keydown', { key: 'F6', bubbles: true })),
    )
    expect(document.activeElement).toBe(viewport)
    expect(viewport.hasAttribute('data-expanded')).toBe(true)

    await act(() =>
      viewport.dispatchEvent(new KeyboardEvent('keydown', { key: 'F6', bubbles: true })),
    )
    expect(document.activeElement).toBe(outside)
    expect(viewport.hasAttribute('data-expanded')).toBe(false)
  })

  it('marks toasts beyond the limit', async (t) => {
    let { act, manager, toasts } = setup(t, { limit: 2 })
    await act(() => {
      manager.add({ title: '1' })
      manager.add({ title: '2' })
      manager.add({ title: '3' })
    })
    let [three, two, one] = toasts()
    expect(three.hasAttribute('data-limited')).toBe(false)
    expect(two.hasAttribute('data-limited')).toBe(false)
    expect(one.hasAttribute('data-limited')).toBe(true)
    expect(one.inert).toBe(true)
    expect(manager.toasts.length).toBe(3)

    // Closing a visible toast brings the limited one back.
    await act(() => manager.close(three.dataset.id))
    expect(one.hasAttribute('data-limited')).toBe(false)
    expect(one.inert).toBe(false)
  })

  it('keeps the closing toast in place while the stack moves', async (t) => {
    addStyle(
      t,
      '.toast { transition: opacity 150ms linear } .toast[data-ending-style] { opacity: 0 }',
    )
    let { act, manager, byId } = setup(t)
    let first = ''
    let second = ''
    await act(() => {
      first = manager.add({ title: 'First' })
      second = manager.add({ title: 'Second' })
    })
    await waitFor(() => byId(first)!.style.getPropertyValue('--toast-index') === '1')
    await act(() => manager.close(second))
    await nextFrame()
    expect(byId(second)!.style.getPropertyValue('--toast-index')).toBe('0')
    expect(byId(first)!.style.getPropertyValue('--toast-index')).toBe('0')
    expect(byId(first)!.style.getPropertyValue('--toast-offset-y')).toBe('0px')
  })

  it('dismisses with a swipe in an allowed direction', async (t) => {
    let { act, manager, toasts } = setup(t)
    await act(() => {
      manager.add({ title: 'Swipe me' })
    })
    let node = toasts()[0]
    let pointer = { pointerId: 7, bubbles: true, button: 0, isPrimary: true }

    await act(() => {
      node.dispatchEvent(
        new PointerEvent('pointerdown', { ...pointer, clientX: 100, clientY: 100 }),
      )
      node.dispatchEvent(
        new PointerEvent('pointermove', { ...pointer, clientX: 120, clientY: 101 }),
      )
    })
    expect(node.hasAttribute('data-swiping')).toBe(true)
    expect(node.style.getPropertyValue('--toast-swipe-movement-x')).toBe('20px')
    expect(node.style.getPropertyValue('--toast-swipe-movement-y')).toBe('0px')

    await act(() => {
      node.dispatchEvent(
        new PointerEvent('pointermove', { ...pointer, clientX: 180, clientY: 101 }),
      )
      node.dispatchEvent(new PointerEvent('pointerup', { ...pointer, clientX: 180, clientY: 101 }))
    })
    expect(node.hasAttribute('data-swiping')).toBe(false)
    expect(node.getAttribute('data-swipe-direction')).toBe('right')
    expect(node.hasAttribute('data-ending-style')).toBe(true)
    expect(node.style.getPropertyValue('--toast-swipe-movement-x')).toBe('80px')
    await waitFor(() => toasts().length === 0)
  })

  it('snaps back from a short or disallowed swipe', async (t) => {
    let { act, manager, toasts } = setup(t, { swipeDirection: ['down'] })
    await act(() => {
      manager.add({ title: 'Stay' })
    })
    let node = toasts()[0]
    let pointer = { pointerId: 3, bubbles: true, button: 0 }

    // Up is not allowed: the movement is dampened and the toast stays.
    await act(() => {
      node.dispatchEvent(new PointerEvent('pointerdown', { ...pointer, clientX: 0, clientY: 200 }))
      node.dispatchEvent(new PointerEvent('pointermove', { ...pointer, clientX: 0, clientY: 100 }))
    })
    expect(node.style.getPropertyValue('--toast-swipe-movement-y')).toBe('-10px')
    await act(() =>
      node.dispatchEvent(new PointerEvent('pointerup', { ...pointer, clientX: 0, clientY: 100 })),
    )
    expect(node.hasAttribute('data-ending-style')).toBe(false)
    expect(node.hasAttribute('data-swiping')).toBe(false)
    expect(node.style.getPropertyValue('--toast-swipe-movement-y')).toBe('0px')

    // A short swipe down snaps back.
    await act(() => {
      node.dispatchEvent(new PointerEvent('pointerdown', { ...pointer, clientX: 0, clientY: 0 }))
      node.dispatchEvent(new PointerEvent('pointermove', { ...pointer, clientX: 0, clientY: 15 }))
    })
    await sleep(50)
    await act(() =>
      node.dispatchEvent(new PointerEvent('pointerup', { ...pointer, clientX: 0, clientY: 15 })),
    )
    expect(node.hasAttribute('data-ending-style')).toBe(false)

    // Pointer down on a button doesn't start a swipe.
    let close = node.querySelector('.close')!
    await act(() => {
      close.dispatchEvent(new PointerEvent('pointerdown', { ...pointer, clientX: 0, clientY: 0 }))
      node.dispatchEvent(new PointerEvent('pointermove', { ...pointer, clientX: 0, clientY: 80 }))
      node.dispatchEvent(new PointerEvent('pointerup', { ...pointer, clientX: 0, clientY: 80 }))
    })
    expect(node.hasAttribute('data-ending-style')).toBe(false)
    expect(manager.toasts.length).toBe(1)
  })

  it('pauses timers while swiping', async (t) => {
    let { act, manager, toasts } = setup(t, { timeout: 120 })
    await act(() => {
      manager.add({ title: 'Hold' })
    })
    let node = toasts()[0]
    let pointer = { pointerId: 9, bubbles: true, button: 0 }
    await act(() => {
      node.dispatchEvent(new PointerEvent('pointerdown', { ...pointer, clientX: 0, clientY: 0 }))
      node.dispatchEvent(new PointerEvent('pointermove', { ...pointer, clientX: 0, clientY: 10 }))
    })
    await sleep(200)
    expect(manager.toasts[0].transitionStatus).not.toBe('ending')
    await act(() =>
      node.dispatchEvent(new PointerEvent('pointerup', { ...pointer, clientX: 0, clientY: 10 })),
    )
    await waitFor(() => manager.toasts.length === 0)
  })

  it('uses a provided manager and exposes it on the context', async (t) => {
    let manager = toast.createToastManager()
    let seen: toast.ToastContextValue | undefined
    function Probe(handle: Handle) {
      seen = handle.context.get(toast.Context)
      return () => null
    }
    let result = render(
      <toast.Context toastManager={manager}>
        <Probe />
      </toast.Context>,
    )
    t.after(result.cleanup)
    expect(seen!.toastManager).toBe(manager)
    let id = seen!.add({ title: 'Via context' })
    expect(manager.toasts[0].id).toBe(id)
  })

  it('removes closed toasts that the app never rendered', async (t) => {
    let manager = toast.createToastManager()
    let result = render(
      <toast.Context toastManager={manager}>
        <p>No list</p>
      </toast.Context>,
    )
    t.after(result.cleanup)
    let id = ''
    await result.act(() => {
      id = manager.add({ title: 'Invisible' })
    })
    await result.act(() => manager.close(id))
    await waitFor(() => manager.toasts.length === 0)
  })

  it('supports no-argument mixin calls', async (t) => {
    let manager = toast.createToastManager()
    function Bare(handle: Handle) {
      let ctx = handle.context.get(toast.Context)
      return () => (
        <div mix={toast.viewport()}>
          {ctx.toasts.map((item) => (
            <div key={item.id} class="toast" mix={toast.root({ toast: item })}>
              <div mix={toast.content()}>
                <span mix={toast.title()}>{item.title}</span>
                <span mix={toast.description()}>{item.description}</span>
                <button class="action" mix={toast.action()}>
                  Act
                </button>
                <button class="close" mix={toast.close()}>
                  Close
                </button>
              </div>
            </div>
          ))}
          <div class="bare-root" mix={toast.root()} />
        </div>
      )
    }
    let clicks = 0
    let result = render(
      <toast.Context toastManager={manager}>
        <Bare />
      </toast.Context>,
    )
    t.after(result.cleanup)
    await result.act(() => {
      manager.add({ title: 'Bare', actionProps: { onClick: () => clicks++ } })
    })
    let bare = result.$('.bare-root') as HTMLElement
    expect(bare.getAttribute('role')).toBe('dialog')
    let node = result.$('.toast') as HTMLElement
    ;(node.querySelector('.action') as HTMLButtonElement).click()
    expect(clicks).toBe(1)
    await result.act(() => (node.querySelector('.close') as HTMLButtonElement).click())
    expect(manager.toasts[0]?.transitionStatus ?? 'ending').toBe('ending')
  })
})
