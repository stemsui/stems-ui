const CANDIDATES = [
  'a[href]',
  'area[href]',
  'button',
  'input:not([type="hidden"])',
  'select',
  'textarea',
  'iframe',
  'audio[controls]',
  'video[controls]',
  'summary',
  '[contenteditable]:not([contenteditable="false"])',
  '[tabindex]',
].join(',')

/**
 * Elements inside `root` that are reachable with the Tab key, in DOM order (positive `tabindex`
 * ordering is ignored on purpose; it's an anti-pattern). Uses `checkVisibility()` so elements in
 * `display: none`, `visibility: hidden`, `hidden`, or `inert` subtrees are skipped.
 */
export function getTabbableElements(root: ParentNode): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(CANDIDATES)].filter(isTabbable)
}

export function isTabbable(node: HTMLElement): boolean {
  if (node.tabIndex < 0) return false
  if ((node as HTMLButtonElement).disabled) return false
  if (node.closest('[inert]')) return false
  if (typeof node.checkVisibility === 'function') {
    return node.checkVisibility({ visibilityProperty: true })
  }
  return node.getClientRects().length > 0
}

/**
 * Moves focus into `root`: the first `[autofocus]` descendant if any, else the first tabbable
 * element, else `root` itself (made programmatically focusable). Returns the focused element.
 */
export function focusFirst(root: HTMLElement, options: FocusOptions = {}): HTMLElement {
  let autofocus = root.querySelector<HTMLElement>('[autofocus]')
  let target =
    (autofocus && isTabbable(autofocus) ? autofocus : null) ?? getTabbableElements(root)[0] ?? root
  if (target === root && !root.hasAttribute('tabindex')) {
    root.setAttribute('tabindex', '-1')
  }
  target.focus(options)
  return target
}
