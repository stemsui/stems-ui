import { focusFirst, getTabbableElements } from './tabbable.ts'

/** How the user opened or closed a dialog (Base UI's `InteractionType`). */
export type DialogInteractionType = 'mouse' | 'touch' | 'pen' | 'keyboard' | ''

/**
 * Where focus goes when a dialog opens (`initialFocus`) or closes (`finalFocus`), following Base
 * UI's Popup props:
 *
 * - `true` / `undefined` / `null`: the default behavior.
 * - `false`: don't move focus.
 * - an element: focus it.
 * - a CSS selector: focus the first match inside the popup (or the document for `finalFocus`),
 *   falling back to the default when nothing matches. Remix has no refs, so this stands in for
 *   Base UI's `RefObject`.
 * - a function of the interaction type: return an element to focus it, `true` or `null` for the
 *   default, `false` or `undefined` to leave focus alone.
 */
export type DialogFocusTarget =
  | boolean
  | null
  | string
  | HTMLElement
  | ((interaction: DialogInteractionType) => boolean | HTMLElement | null | void)

/** `true` = use the default, `false` = leave focus alone, or the element to focus. */
export function resolveFocusTarget(
  target: DialogFocusTarget | undefined,
  interaction: DialogInteractionType,
  scope: ParentNode,
): boolean | HTMLElement {
  if (target === undefined || target === null || target === true) return true
  if (target === false) return false
  if (typeof target === 'string') {
    return scope.querySelector<HTMLElement>(target) ?? true
  }
  if (typeof target === 'function') {
    let result = target(interaction)
    if (result === true || result === null) return true
    if (result === false || result === undefined) return false
    return result
  }
  return target
}

/**
 * Moves focus into a freshly opened popup: `[autofocus]` or the first tabbable element, or the
 * popup itself when opened by touch (so the virtual keyboard doesn't pop up), as Base UI does.
 */
export function focusPopupDefault(popup: HTMLElement, interaction: DialogInteractionType) {
  if (interaction === 'touch') {
    focusSelf(popup)
    return
  }
  focusFirst(popup, { preventScroll: true })
}

export function focusSelf(node: HTMLElement) {
  if (!node.hasAttribute('tabindex')) node.setAttribute('tabindex', '-1')
  node.focus({ preventScroll: true })
}

/**
 * Keeps Tab and Shift+Tab inside `container`, wrapping at either end. Native modal dialogs make
 * the page inert but still let Tab leave for the browser UI; Base UI traps focus, so we do too.
 * Returns whether the event was handled.
 */
export function trapTabKey(container: HTMLElement, event: KeyboardEvent): boolean {
  if (event.key !== 'Tab' || event.defaultPrevented || event.altKey || event.ctrlKey) return false
  if (event.metaKey) return false

  let tabbables = getTabbableElements(container)
  let doc = container.ownerDocument
  let active = doc.activeElement as HTMLElement | null

  if (tabbables.length === 0) {
    event.preventDefault()
    focusSelf(container)
    return true
  }

  let first = tabbables[0]
  let last = tabbables[tabbables.length - 1]

  if (event.shiftKey) {
    if (active === first || active === container || !container.contains(active)) {
      event.preventDefault()
      last.focus()
      return true
    }
    return false
  }

  if (active === last || !container.contains(active)) {
    event.preventDefault()
    first.focus()
    return true
  }
  return false
}
