import type { MixinHandle } from '@remix-run/component'

/**
 * Base UI's transition status: `'starting'` while an element begins animating in, `'ending'`
 * while it animates out, `undefined` otherwise.
 */
export type TransitionStatus = 'starting' | 'ending' | undefined

export interface PresenceOptions<node extends HTMLElement = HTMLElement> {
  /**
   * Re-renders the host after an asynchronous status change. Defaults to the mixin's
   * `handle.update()`; pass the owning Context provider's `handle.update()` to re-render the
   * whole widget from fresh props instead.
   */
  update?(): unknown
  /**
   * Called after the commit that shows the element (with `data-starting-style` when animated),
   * before the starting style is removed. Measure the element or call `showPopover()` here.
   */
  onBeforeEnter?(node: node): void
  /** Called once the enter animation has finished, or right away when it was skipped. */
  onAfterEnter?(node: node): void
  /**
   * Called synchronously from `sync(false)`, during render, while the DOM still shows the open
   * state. Snapshot sizes here so the exit can animate from them.
   */
  onBeforeExit?(node: node): void
  /**
   * Called once the exit animation has finished (or right away when it was skipped), just
   * before `present` turns `false`. Call `hidePopover()` / `close()` here.
   */
  onAfterExit?(node: node): void
}

export interface PresenceTransitionAttrs {
  'data-starting-style'?: ''
  'data-ending-style'?: ''
}

export interface Presence<node extends HTMLElement = HTMLElement> {
  /** The last open state passed to `sync()`. */
  readonly open: boolean
  /** Whether the element should be shown: it is open, or it is still animating out. */
  readonly present: boolean
  readonly transitionStatus: TransitionStatus
  /** The bound host node, or `null` before insertion (and always on the server). */
  readonly node: node | null
  /**
   * Reports the current open state. Call it at the top of the mixin's render function. The first
   * call sets the initial state without a transition, so server HTML and hydration match.
   */
  sync(open: boolean): void
  /**
   * Applies an open-state change reported by the next `sync()` call instantly, without starting
   * or ending styles. The flag is cleared by that call whether or not the state changed.
   */
  skipTransition(): void
  /** `data-starting-style` / `data-ending-style` for the current transition status. */
  attrs(): PresenceTransitionAttrs
}

/**
 * Drives the Base UI enter/exit lifecycle for an element that stays mounted while closed.
 *
 * - Enter: `present` turns `true` and `data-starting-style` is rendered in the same commit. After
 *   the commit `onBeforeEnter` runs, and on the next animation frame the attribute is removed so
 *   CSS transitions from the starting style. `onAfterEnter` runs when animations finish.
 * - Exit: `onBeforeExit` runs during render, then `data-ending-style` is rendered while `present`
 *   stays `true`. When the element's animations finish, `onAfterExit` runs and `present` turns
 *   `false` (the host re-renders so it can hide the element).
 * - Reversing mid-transition cancels the pending one. Re-opening while exiting skips the
 *   starting style, so CSS animates from the current size.
 *
 * Create it during mixin setup: it listens to the handle's `insert` / `remove` events, schedules
 * work with `handle.queueTask`, and re-renders the host with `options.update` (default
 * `handle.update()`).
 */
export function createPresence<node extends HTMLElement>(
  handle: MixinHandle<node>,
  options: PresenceOptions<node> = {},
): Presence<node> {
  let node: node | null = null
  let open: boolean | undefined
  let present = false
  let status: TransitionStatus
  let skipNext = false
  let controller: AbortController | null = null
  let update = options.update ?? (() => handle.update())

  handle.addEventListener('insert', (event) => {
    node = event.node
  })

  handle.addEventListener('remove', () => {
    cancel()
    node = null
  })

  function cancel() {
    controller?.abort()
    controller = null
  }

  function begin() {
    cancel()
    controller = new AbortController()
    return controller.signal
  }

  function enter(instant: boolean) {
    let signal = begin()
    let wasExiting = status === 'ending'
    present = true

    if (instant || wasExiting) {
      status = undefined
      handle.queueTask((node) => {
        if (signal.aborted) return
        options.onBeforeEnter?.(node)
        if (instant) {
          options.onAfterEnter?.(node)
          return
        }
        void waitForAnimations(node, signal).then(() => {
          if (!signal.aborted) options.onAfterEnter?.(node)
        })
      })
      return
    }

    status = 'starting'
    handle.queueTask((node) => {
      if (signal.aborted) return
      options.onBeforeEnter?.(node)
      // Make sure the starting style has been computed before it is removed.
      void node.offsetHeight

      let frame = requestAnimationFrame(() => {
        if (signal.aborted) return
        status = undefined
        node.removeAttribute('data-starting-style')
        void update()
        void waitForAnimations(node, signal).then(() => {
          if (!signal.aborted) options.onAfterEnter?.(node)
        })
      })
      signal.addEventListener('abort', () => cancelAnimationFrame(frame), { once: true })
    })
  }

  function exit(instant: boolean) {
    let signal = begin()

    if (instant || !node) {
      status = undefined
      present = false
      if (node) {
        handle.queueTask((node) => {
          if (!signal.aborted) options.onAfterExit?.(node)
        })
      }
      return
    }

    options.onBeforeExit?.(node)
    // Flush the current (open) style so the ending style transitions from it, even if the
    // element was shown moments ago and never styled.
    void getComputedStyle(node).opacity
    status = 'ending'
    present = true

    handle.queueTask((node) => {
      if (signal.aborted) return
      void waitForAnimations(node, signal).then(() => {
        if (signal.aborted) return
        controller = null
        options.onAfterExit?.(node)
        status = undefined
        present = false
        void update()
      })
    })
  }

  return {
    get open() {
      return open ?? false
    },
    get present() {
      return present
    },
    get transitionStatus() {
      return status
    },
    get node() {
      return node
    },
    sync(nextOpen) {
      if (open === undefined) {
        open = nextOpen
        present = nextOpen
        return
      }
      let skip = skipNext
      skipNext = false
      if (nextOpen === open) return

      open = nextOpen
      let instant = skip || !node

      if (nextOpen) enter(instant)
      else exit(instant)
    },
    skipTransition() {
      skipNext = true
    },
    attrs() {
      return {
        'data-starting-style': status === 'starting' ? '' : undefined,
        'data-ending-style': status === 'ending' ? '' : undefined,
      }
    },
  }
}

/**
 * Resolves once the element's own CSS transitions and animations have finished.
 *
 * Waits one animation frame first so style changes from the latest commit have created their
 * animations. Unlike `waitForCssTransition`, this also covers CSS keyframe animations (shadcn's
 * `animate-accordion-up`), and a transition that is reversed mid-flight (which cancels the old
 * one and starts a new one) keeps it waiting. Infinite animations are ignored. Resolves early
 * when `signal` aborts.
 */
export function waitForAnimations(node: Element, signal: AbortSignal): Promise<void> {
  return new Promise<void>((resolve) => {
    if (signal.aborted) {
      resolve()
      return
    }

    let frame = requestAnimationFrame(() => {
      void settle().then(done)
    })

    function done() {
      signal.removeEventListener('abort', onAbort)
      resolve()
    }

    function onAbort() {
      cancelAnimationFrame(frame)
      done()
    }

    signal.addEventListener('abort', onAbort, { once: true })

    async function settle() {
      while (!signal.aborted) {
        let running = getRunningAnimations(node)
        if (running.length === 0) return
        await Promise.race([
          Promise.allSettled(running.map((animation) => animation.finished)),
          new Promise<void>((abort) =>
            signal.addEventListener('abort', () => abort(), { once: true }),
          ),
        ])
      }
    }
  })
}

function getRunningAnimations(node: Element): Animation[] {
  if (typeof node.getAnimations !== 'function') return []

  return node.getAnimations().filter((animation) => {
    if (animation.playState === 'finished' || animation.playState === 'idle') return false
    let iterations = animation.effect?.getComputedTiming().iterations
    return iterations !== Infinity
  })
}
