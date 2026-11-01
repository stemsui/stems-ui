export type TextDirection = 'ltr' | 'rtl'

/**
 * Resolves the text direction that applies to `node`.
 *
 * Uses the nearest `dir` attribute (`dir="auto"` is skipped), then the computed CSS `direction`,
 * then `'ltr'`. Read it when handling a keyboard event rather than caching it, so direction
 * changes take effect immediately.
 */
export function getDirection(node: Element | null | undefined): TextDirection {
  if (!node) return 'ltr'

  let dirHost = node.closest('[dir="rtl"], [dir="ltr"]')
  if (dirHost) {
    return dirHost.getAttribute('dir') === 'rtl' ? 'rtl' : 'ltr'
  }

  let view = node.ownerDocument.defaultView
  if (view) {
    return view.getComputedStyle(node).direction === 'rtl' ? 'rtl' : 'ltr'
  }

  return 'ltr'
}

/**
 * Maps a physical horizontal arrow key to a logical step for the given direction:
 * `1` means "next", `-1` means "previous", and `0` means the key isn't horizontal.
 */
export function horizontalArrowStep(key: string, direction: TextDirection): -1 | 0 | 1 {
  if (key === 'ArrowRight') return direction === 'rtl' ? -1 : 1
  if (key === 'ArrowLeft') return direction === 'rtl' ? 1 : -1
  return 0
}
