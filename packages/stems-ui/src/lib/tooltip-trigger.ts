/**
 * Trigger behavior for hint popups that open on hover and keyboard focus (tooltip, preview card).
 *
 * Unlike `createPopupTrigger`, the trigger is not a popup button: it renders no role and no
 * `aria-haspopup` / `aria-expanded` (Base UI's Tooltip and PreviewCard triggers don't either),
 * and a press doesn't toggle the popup.
 *
 * - Hover: opens after `delay` (reason `'trigger-hover'`) through `store.hover`, so moving the
 *   pointer toward the popup keeps it open (hover-aim). With `hoverablePopup: false` it closes as
 *   soon as the pointer leaves the trigger (after `closeDelay`).
 * - Focus: opens on `:focus-visible` focus only (not when a pointer press focused the trigger),
 *   after `focusDelay` (reason `'trigger-focus'`); blur closes unless focus moved into the popup
 *   or another trigger.
 * - Press (`closeOnClick`): closes with reason `'trigger-press'` and cancels a pending hover open.
 *   After a press-close, focusing the same trigger again doesn't reopen until the pointer leaves
 *   or the trigger blurs; the same applies after the window lost focus while the trigger was
 *   focused (so returning to the tab doesn't pop the hint up).
 */

import { attrs, on } from '@remix-run/component'
import type { ElementProps, MixInput, MixinHandle } from '@remix-run/component'

import { setTriggerPayload } from './popup.ts'
import type { PopupStore, PopupTriggerEntry } from './popup.ts'
import { writeAttributes } from './popup-handle.ts'

export interface HintTriggerSettings {
  /** Hover-open delay in ms (already resolved against a delay group). */
  delay: number
  /** Hover-close delay in ms. */
  closeDelay: number
  /** Delay before opening on keyboard focus, in ms. */
  focusDelay: number
  /** Ignore hover and focus. */
  disabled: boolean
  /** Close when the trigger is pressed. */
  closeOnClick: boolean
  /** Whether the pointer may move from the trigger onto the popup without closing it. */
  hoverablePopup: boolean
  /** Report pointer moves over the trigger (for cursor tracking). */
  trackPointer: boolean
  /** The trigger's `payload` (`store.payload` while it's the active trigger). */
  payload?: unknown
}

export interface HintTriggerHooks {
  /** Called with `pointerenter` / `pointermove` events while `trackPointer` is set. */
  onPointer?(event: PointerEvent): void
  /** Whether the trigger is detached from its `Context` (`TriggerBinding.detached`). */
  isDetached?(): boolean
}

export interface HintTrigger {
  /** The trigger's registration (registered on first access). */
  readonly entry: PopupTriggerEntry
  /** Writes `data-popup-open` to the element (for detached triggers). */
  refresh(): void
  /**
   * Call from the trigger mixin's render function. `getSettings` is read at event time, so a
   * delay group's state is current when the pointer enters.
   */
  render(getSettings: () => HintTriggerSettings): MixInput<HTMLElement, ElementProps>
}

export function createHintTrigger(
  handle: MixinHandle<HTMLElement>,
  store: PopupStore,
  hooks: HintTriggerHooks = {},
): HintTrigger {
  let signal = handle.signal
  // Registered lazily: a detached trigger's handle is only known once its mixin renders.
  let registered: PopupTriggerEntry | null = null
  let rendered = false
  let settings: () => HintTriggerSettings
  let focusTimer = 0
  let blurTimer = 0
  let closeTimer = 0
  let blockFocus = false

  function clearTimers() {
    clearTimeout(focusTimer)
    clearTimeout(blurTimer)
    clearTimeout(closeTimer)
    focusTimer = blurTimer = closeTimer = 0
  }
  signal.addEventListener('abort', clearTimers)

  function ensureEntry() {
    return (registered ??= store._registerTrigger(signal))
  }

  handle.addEventListener('insert', (event) => {
    ensureEntry().node = event.node
    let win = event.node.ownerDocument.defaultView
    win?.addEventListener(
      'blur',
      () => {
        let node = ensureEntry().node
        if (node && !store.open && node.ownerDocument.activeElement === node) blockFocus = true
      },
      { signal },
    )
  })
  handle.addEventListener('remove', () => {
    if (registered) registered.node = null
    clearTimers()
  })

  function isActive() {
    return store.open && store.isActiveTrigger(ensureEntry())
  }

  function pressClose(event: Event) {
    blockFocus = true
    store.hover.cancel()
    clearTimeout(focusTimer)
    if (!isActive()) return
    store._setInteractionType(
      event instanceof MouseEvent && event.detail === 0 ? 'keyboard' : 'mouse',
    )
    store.setOpen(false, { reason: 'trigger-press', event, trigger: ensureEntry().node })
  }

  function onPointerEnter(event: PointerEvent) {
    if (event.pointerType === 'touch') return
    clearTimeout(closeTimer)
    let current = settings()
    let node = ensureEntry().node
    if (current.disabled || !node) return
    if (current.trackPointer) hooks.onPointer?.(event)
    if (store.open && !store.isActiveTrigger(ensureEntry())) {
      // Base UI: hovering another trigger of an open hint moves the popup to it.
      store._activateTrigger(ensureEntry())
      void store.update()
    }
    store.hover.triggerEnter(event, node, { delay: current.delay, closeDelay: current.closeDelay })
  }

  function onPointerLeave(event: PointerEvent) {
    blockFocus = false
    let current = settings()
    if (current.hoverablePopup) {
      store.hover.triggerLeave(event, { delay: current.delay, closeDelay: current.closeDelay })
      return
    }
    store.hover.cancel()
    if (!store.open || store.openReason !== 'trigger-hover') return
    let close = () => {
      closeTimer = 0
      if (store.open && store.openReason === 'trigger-hover') {
        store.setOpen(false, { reason: 'trigger-hover', event })
      }
    }
    clearTimeout(closeTimer)
    if (current.closeDelay > 0) closeTimer = window.setTimeout(close, current.closeDelay)
    else close()
  }

  function onFocus(event: FocusEvent) {
    let current = settings()
    let node = ensureEntry().node
    if (current.disabled || !node || blockFocus) return
    if (!isFocusVisible(node)) return
    clearTimeout(blurTimer)
    if (store.open) {
      if (!store.isActiveTrigger(ensureEntry())) {
        store._activateTrigger(ensureEntry())
        void store.update()
      }
      return
    }
    let open = () => {
      focusTimer = 0
      let target = ensureEntry().node
      if (!target || blockFocus || settings().disabled || store.open) return
      if (target.ownerDocument.activeElement !== target) return
      store._setInteractionType('keyboard')
      store.setOpen(true, { reason: 'trigger-focus', event, trigger: target })
    }
    clearTimeout(focusTimer)
    if (current.focusDelay > 0) focusTimer = window.setTimeout(open, current.focusDelay)
    else open()
  }

  function onBlur(event: FocusEvent) {
    blockFocus = false
    clearTimeout(focusTimer)
    clearTimeout(blurTimer)
    let related = event.relatedTarget
    // Wait for the window `blur` listener and for focus to land.
    blurTimer = window.setTimeout(() => {
      blurTimer = 0
      let node = ensureEntry().node
      if (!node || !isActive()) return
      let active = node.ownerDocument.activeElement
      // Focus left the page (window blur): keep it open.
      if (!related && active === node) return
      if (active && (store.popupNode?.contains(active) || store.containsTrigger(active))) return
      store._setInteractionType('keyboard')
      store.setOpen(false, { reason: 'trigger-focus', event })
    })
  }

  return {
    get entry() {
      return ensureEntry()
    },
    refresh() {
      let node = registered?.node
      if (node) writeAttributes(node, { 'data-popup-open': isActive() ? '' : undefined })
    },
    render(getSettings) {
      settings = getSettings
      let current = getSettings()
      let own = ensureEntry()
      own.disabled = current.disabled
      setTriggerPayload(
        handle,
        store,
        own,
        current.payload,
        !rendered || (hooks.isDetached?.() ?? false),
      )
      rendered = true
      if (current.disabled) {
        clearTimeout(focusTimer)
        focusTimer = 0
      }
      return [
        attrs({ 'data-popup-open': isActive() ? '' : undefined }),
        on<HTMLElement, 'pointerenter'>('pointerenter', onPointerEnter),
        on<HTMLElement, 'pointerleave'>('pointerleave', onPointerLeave),
        current.trackPointer &&
          on<HTMLElement, 'pointermove'>('pointermove', (event) => {
            if (event.pointerType !== 'touch') hooks.onPointer?.(event)
          }),
        on<HTMLElement, 'pointerdown'>('pointerdown', (event) => {
          if (!settings().closeOnClick) return
          if (isActive()) pressClose(event)
          else store.hover.cancel()
        }),
        on<HTMLElement, 'click'>('click', (event) => {
          if (!settings().closeOnClick) return
          if (isActive()) pressClose(event)
          else store.hover.cancel()
        }),
        on<HTMLElement, 'focus'>('focus', onFocus),
        on<HTMLElement, 'blur'>('blur', onBlur),
      ]
    },
  }
}

function isFocusVisible(node: HTMLElement) {
  try {
    return node.matches(':focus-visible')
  } catch {
    return true
  }
}
