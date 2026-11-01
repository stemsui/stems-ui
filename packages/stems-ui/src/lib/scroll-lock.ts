// Adapted from @remix-run/ui 0.13.0 (packages/ui/src/lib/scroll-lock.ts).
// https://github.com/remix-run/remix - Copyright (c) 2025 Shopify Inc. MIT License.

type ScrollLockState = {
  count: number
  documentOverflow: string
  documentScrollbarGutter: string
  scrollX: number
  scrollY: number
}

const scrollLocks = new WeakMap<Document, ScrollLockState>()

export function lockScroll(targetDocument: Document | undefined = globalThis.document): () => void {
  if (!targetDocument?.body || !targetDocument.defaultView) {
    return () => {}
  }

  let document = targetDocument
  let documentElement = document.documentElement
  let view = document.defaultView!
  let state = scrollLocks.get(document)

  if (!state) {
    let scrollX = view.scrollX
    let scrollY = view.scrollY
    let scrollbarWidth =
      documentElement.clientWidth > 0
        ? Math.max(view.innerWidth - documentElement.clientWidth, 0)
        : 0
    let computedScrollbarGutter = view.getComputedStyle(documentElement).scrollbarGutter

    state = {
      count: 0,
      documentOverflow: documentElement.style.overflow,
      documentScrollbarGutter: documentElement.style.scrollbarGutter,
      scrollX,
      scrollY,
    }

    documentElement.style.overflow = 'hidden'
    if (scrollbarWidth > 0 && computedScrollbarGutter === 'auto') {
      documentElement.style.scrollbarGutter = 'stable'
    }

    scrollLocks.set(document, state)
  }

  state.count++

  let unlocked = false

  return () => {
    if (unlocked) {
      return
    }

    unlocked = true

    let currentState = scrollLocks.get(document)
    if (!currentState) {
      return
    }

    currentState.count--
    if (currentState.count > 0) {
      return
    }

    scrollLocks.delete(document)

    documentElement.style.overflow = currentState.documentOverflow
    documentElement.style.scrollbarGutter = currentState.documentScrollbarGutter
    view.scrollTo(currentState.scrollX, currentState.scrollY)
  }
}
