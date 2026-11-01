import { expect } from 'remix/assert'
import { describe, it } from 'remix/test'
import { attrs, createMixin } from 'remix/component'
import type { Handle } from 'remix/component'
import { render } from 'remix/component/test'

import { createPresence, waitForAnimations } from './presence.ts'
import type { Presence } from './presence.ts'

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

function addStyle(t: T, css: string) {
  let style = document.createElement('style')
  style.textContent = css
  document.head.append(style)
  t.after(() => style.remove())
}

function setup(t: T, initialOpen: boolean) {
  let log: string[] = []
  let presence: Presence | undefined

  const surface = createMixin<HTMLElement, [open: boolean]>((handle) => {
    presence = createPresence(handle, {
      onBeforeEnter: () => log.push('beforeEnter'),
      onAfterEnter: () => log.push('afterEnter'),
      onBeforeExit: (node) => log.push(`beforeExit:${node.hasAttribute('data-ending-style')}`),
      onAfterExit: () => log.push('afterExit'),
    })
    return (open) => {
      presence!.sync(open)
      return attrs({ hidden: presence!.present ? undefined : true, ...presence!.attrs() })
    }
  })

  let open = initialOpen
  let owner: Handle | undefined
  function App(handle: Handle) {
    owner = handle
    return () => <div class="surface" mix={surface(open)} />
  }

  let result = render(<App />)
  t.after(result.cleanup)
  let node = result.$('.surface')!

  async function setOpen(next: boolean) {
    open = next
    await result.act(() => owner!.update())
  }

  return { node, log, setOpen, presence: () => presence! }
}

describe('presence', () => {
  it('starts in the initial state without transitions', (t) => {
    let open = setup(t, true)
    expect(open.node.hasAttribute('hidden')).toBe(false)
    expect(open.presence().transitionStatus).toBe(undefined)

    let closed = setup(t, false)
    expect(closed.node.hasAttribute('hidden')).toBe(true)
    expect(closed.log).toEqual([])
  })

  it('runs the enter lifecycle', async (t) => {
    let { node, log, setOpen, presence } = setup(t, false)

    await setOpen(true)
    expect(node.hasAttribute('hidden')).toBe(false)
    expect(node.getAttribute('data-starting-style')).toBe('')
    expect(presence().transitionStatus).toBe('starting')
    expect(log).toEqual(['beforeEnter'])

    await waitFor(() => log.includes('afterEnter'))
    expect(node.hasAttribute('data-starting-style')).toBe(false)
    expect(presence().transitionStatus).toBe(undefined)
  })

  it('keeps the element present until the exit animation finishes', async (t) => {
    addStyle(
      t,
      `.surface { opacity: 1; transition: opacity 80ms linear; } .surface[data-ending-style] { opacity: 0; }`,
    )
    let { node, log, setOpen, presence } = setup(t, true)

    await setOpen(false)
    // onBeforeExit runs before the DOM shows the ending style.
    expect(log).toEqual(['beforeExit:false'])
    expect(node.getAttribute('data-ending-style')).toBe('')
    expect(presence().present).toBe(true)
    expect(node.hasAttribute('hidden')).toBe(false)

    await nextFrame()
    await nextFrame()
    expect(node.hasAttribute('hidden')).toBe(false)

    await waitFor(() => node.hasAttribute('hidden'))
    expect(log).toEqual(['beforeExit:false', 'afterExit'])
    expect(node.hasAttribute('data-ending-style')).toBe(false)
  })

  it('waits for CSS keyframe animations too', async (t) => {
    addStyle(
      t,
      `@keyframes presence-out { to { opacity: 0 } }
       .surface[data-ending-style] { animation: presence-out 80ms linear; }`,
    )
    let { node, setOpen } = setup(t, true)

    let start = performance.now()
    await setOpen(false)
    await waitFor(() => node.hasAttribute('hidden'))
    expect(performance.now() - start).toBeGreaterThanOrEqual(70)
  })

  it('reverses an exit without a starting style', async (t) => {
    addStyle(
      t,
      `.surface { opacity: 1; transition: opacity 200ms linear; } .surface[data-ending-style] { opacity: 0; }`,
    )
    let { node, log, setOpen, presence } = setup(t, true)

    await setOpen(false)
    await nextFrame()
    await setOpen(true)

    expect(node.hasAttribute('data-ending-style')).toBe(false)
    expect(node.hasAttribute('data-starting-style')).toBe(false)
    expect(presence().present).toBe(true)

    await waitFor(() => log.includes('afterEnter'))
    expect(log).not.toContain('afterExit')
    expect(node.hasAttribute('hidden')).toBe(false)
  })

  it('applies skipped transitions instantly', async (t) => {
    let { node, log, setOpen, presence } = setup(t, true)

    presence().skipTransition()
    await setOpen(false)
    expect(node.hasAttribute('hidden')).toBe(true)
    expect(node.hasAttribute('data-ending-style')).toBe(false)
    expect(log).toEqual(['afterExit'])
  })
})

describe('waitForAnimations', () => {
  it('resolves after a frame when nothing animates', async () => {
    let node = document.createElement('div')
    document.body.append(node)
    await waitForAnimations(node, new AbortController().signal)
    node.remove()
  })

  it('resolves when the signal aborts', async () => {
    let node = document.createElement('div')
    node.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 10_000 })
    document.body.append(node)
    let controller = new AbortController()
    let promise = waitForAnimations(node, controller.signal)
    await nextFrame()
    controller.abort()
    await promise
    node.remove()
  })

  it('ignores infinite animations', async () => {
    let node = document.createElement('div')
    document.body.append(node)
    node.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 100, iterations: Infinity })
    await waitForAnimations(node, new AbortController().signal)
    node.remove()
  })
})
