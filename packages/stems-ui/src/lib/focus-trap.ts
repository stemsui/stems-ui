import { getTabbableElements } from './tabbable.ts'

/**
 * Keeps Tab / Shift+Tab focus cycling inside `container` until the returned function is called.
 *
 * Only the wrap-around is handled (Tab on the last tabbable element moves to the first, Shift+Tab
 * on the first moves to the last), so the browser's own tab order applies in between. When
 * `container` has no tabbable content, Tab keeps focus on the container itself.
 *
 * Nested traps work: the innermost container handles the key first and calls `preventDefault()`,
 * and outer traps ignore keys that were already handled.
 */
export function trapFocus(container: HTMLElement): () => void {
  function onKeyDown(event: KeyboardEvent) {
    if (event.key !== 'Tab' || event.defaultPrevented) return
    if (event.altKey || event.ctrlKey || event.metaKey) return

    let items = getTabbableElements(container)
    let active = container.ownerDocument.activeElement
    if (items.length === 0) {
      event.preventDefault()
      container.focus()
      return
    }

    let first = items[0]
    let last = items[items.length - 1]
    let outside = !active || !container.contains(active)

    if (event.shiftKey) {
      if (outside || active === first || active === container) {
        event.preventDefault()
        last.focus()
      }
    } else if (outside || active === last) {
      event.preventDefault()
      first.focus()
    }
  }

  container.addEventListener('keydown', onKeyDown)
  return () => container.removeEventListener('keydown', onKeyDown)
}

// How many active `inertOthers()` calls made each element inert. Elements that were already inert
// before the first call are never touched.
const inertCounts = new WeakMap<Element, number>()

const SKIPPED_TAGS = new Set(['SCRIPT', 'STYLE', 'TEMPLATE', 'LINK', 'META', 'NOSCRIPT'])

/**
 * Makes everything in the document inert except the `keep` elements, their ancestors, and live
 * regions (`[aria-live]`), so pointer, focus, and assistive-technology interaction is limited to
 * the kept subtrees (a modal popup and its backdrop). Returns a function that restores the
 * previous state. Calls nest: an element stays inert until every call that marked it is undone.
 */
export function inertOthers(keep: Array<Element | null | undefined>): () => void {
  let kept = keep.filter((node): node is Element => !!node && node.isConnected)
  if (kept.length === 0) return () => {}

  let doc = kept[0].ownerDocument
  let ancestors = new Set<Element>()
  for (let node of kept) {
    let current: Element | null = node.parentElement
    while (current) {
      ancestors.add(current)
      current = current.parentElement
    }
  }

  let marked: Element[] = []

  function visit(parent: Element) {
    for (let child of parent.children) {
      if (kept.includes(child)) continue
      if (ancestors.has(child)) {
        visit(child)
        continue
      }
      if (SKIPPED_TAGS.has(child.tagName) || child.hasAttribute('aria-live')) continue

      let count = inertCounts.get(child) ?? 0
      if (count === 0 && child.hasAttribute('inert')) continue
      inertCounts.set(child, count + 1)
      if (count === 0) child.setAttribute('inert', '')
      marked.push(child)
    }
  }

  visit(doc.body)

  let restored = false
  return () => {
    if (restored) return
    restored = true
    for (let node of marked) {
      let count = (inertCounts.get(node) ?? 1) - 1
      if (count <= 0) {
        inertCounts.delete(node)
        node.removeAttribute('inert')
      } else {
        inertCounts.set(node, count)
      }
    }
  }
}
