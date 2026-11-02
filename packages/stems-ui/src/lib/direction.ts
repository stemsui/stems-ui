import { createElement } from '@remix-run/component'
import type { Handle, MixinHandle, RemixNode } from '@remix-run/component'

export type TextDirection = 'ltr' | 'rtl'

/**
 * Resolves the text direction that applies to `node`.
 *
 * Uses the nearest `dir` attribute (`dir="auto"` is skipped), then the computed CSS `direction`,
 * then `'ltr'`. Read it when handling a keyboard event rather than caching it, so direction
 * changes take effect immediately.
 *
 * `<DirectionProvider>` renders a `display: contents` element with `dir`, so this lookup honors it
 * without any extra wiring.
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

export interface DirectionProviderProps {
  /**
   * The reading direction of the text.
   * @default 'ltr'
   */
  direction?: TextDirection
  children?: RemixNode
}

export interface DirectionContextValue {
  /** The provider's direction. */
  readonly direction: TextDirection
}

/**
 * Sets the text direction for a subtree.
 *
 * Renders `<div dir={direction} style="display: contents">` around its children. The element
 * generates no box, so layout is unchanged, and a generic `div` adds nothing to the accessibility
 * tree. Because the direction lives in the DOM, `getDirection(node)` (read at event time by every
 * Stems widget) and CSS logical properties both honor it, including in server-rendered HTML.
 * Components can also read it during render with `getDirectionFromContext(handle)`.
 */
export function DirectionProvider(
  handle: Handle<DirectionProviderProps, DirectionContextValue>,
): () => RemixNode {
  let direction: TextDirection = 'ltr'
  handle.context.set({
    get direction() {
      return direction
    },
  })

  return () => {
    direction = handle.props.direction === 'rtl' ? 'rtl' : 'ltr'
    return createElement(
      'div',
      { dir: direction, style: { display: 'contents' }, 'data-direction-provider': '' },
      handle.props.children,
    )
  }
}

/**
 * Returns the direction of the nearest `<DirectionProvider>` above a component or mixin, or
 * `undefined` without one. Use it for render-time decisions (Base UI's `useDirection`); at event
 * time prefer `getDirection(node)`, which also sees `dir` attributes set by the app.
 */
export function getDirectionFromContext(
  handle: Handle<any, any> | MixinHandle<any, any>,
): TextDirection | undefined {
  let value = (handle.context as { get(key: unknown): unknown }).get(DirectionProvider) as
    DirectionContextValue | undefined
  return value?.direction
}
