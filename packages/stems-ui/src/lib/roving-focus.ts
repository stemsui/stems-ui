import { horizontalArrowStep, type TextDirection } from './direction.ts'

/** Which arrow keys move focus in a composite widget. */
export type RovingOrientation = 'horizontal' | 'vertical' | 'both'

/** A logical focus move within a composite widget. */
export type RovingMove = 'first' | 'last' | 'next' | 'previous'

/**
 * Maps a key to a logical focus move for a composite widget (tablist, toolbar, radio group,
 * toggle group, ...). Horizontal arrows respect `direction`, so ArrowLeft means "next" in RTL.
 * Returns `null` for keys the widget doesn't handle with the given orientation.
 */
export function getRovingMove(
  key: string,
  orientation: RovingOrientation,
  direction: TextDirection,
): RovingMove | null {
  if (key === 'Home') return 'first'
  if (key === 'End') return 'last'

  if (orientation !== 'vertical') {
    let step = horizontalArrowStep(key, direction)
    if (step === 1) return 'next'
    if (step === -1) return 'previous'
  }

  if (orientation !== 'horizontal') {
    if (key === 'ArrowDown') return 'next'
    if (key === 'ArrowUp') return 'previous'
  }

  return null
}

export interface RovingTargetOptions {
  /** Wrap from the last item to the first (and back) for `next` / `previous`. */
  loop: boolean
  /** Items that return `false` are skipped. Defaults to every item being enabled. */
  isEnabled?: (index: number) => boolean
}

/**
 * Resolves the index of the item a move lands on, skipping disabled items.
 *
 * `currentIndex` may be `-1` (nothing focused yet): `next` then lands on the first enabled item and
 * `previous` on the last. `next` / `previous` return `currentIndex` when there is nowhere to go (the
 * end of a non-looping list, or no other enabled item). Otherwise returns `-1` when no enabled item
 * exists.
 */
export function getRovingTargetIndex(
  count: number,
  currentIndex: number,
  move: RovingMove,
  options: RovingTargetOptions,
): number {
  let isEnabled = options.isEnabled ?? (() => true)

  function scan(start: number, step: 1 | -1, wrap: boolean): number {
    for (let offset = 0; offset < count; offset++) {
      let index = start + offset * step
      if (wrap) index = ((index % count) + count) % count
      else if (index < 0 || index >= count) return -1
      if (isEnabled(index)) return index
    }
    return -1
  }

  if (count === 0) return -1

  switch (move) {
    case 'first':
      return scan(0, 1, false)
    case 'last':
      return scan(count - 1, -1, false)
    case 'next': {
      if (currentIndex < 0) return scan(0, 1, false)
      let target = scan(currentIndex + 1, 1, options.loop)
      return target === -1 ? currentIndex : target
    }
    case 'previous': {
      if (currentIndex < 0) return scan(count - 1, -1, false)
      let target = scan(currentIndex - 1, -1, options.loop)
      return target === -1 ? currentIndex : target
    }
  }
}
