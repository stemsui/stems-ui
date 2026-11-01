/**
 * Swipe-to-dismiss math for the drawer: tracks a pointer drag along the dismiss direction,
 * measures release velocity, and decides whether the release dismisses.
 */

export type SwipeDirection = 'up' | 'down' | 'left' | 'right'

/** Distance (px) a pointer must move before a press becomes a swipe. */
export const SWIPE_START_THRESHOLD = 6
/** Fraction of the popup size past which a release dismisses. */
export const SWIPE_DISMISS_FRACTION = 0.4
/** Release velocity (px/ms) that dismisses even short swipes. */
export const SWIPE_DISMISS_VELOCITY = 0.5
/** Minimum distance (px) for a velocity-based dismissal. */
export const SWIPE_MIN_FLICK_DISTANCE = 16

export function swipeAxis(direction: SwipeDirection): 'x' | 'y' {
  return direction === 'left' || direction === 'right' ? 'x' : 'y'
}

/** +1 when the dismiss direction points along the positive screen axis (right / down). */
function sign(direction: SwipeDirection) {
  return direction === 'down' || direction === 'right' ? 1 : -1
}

interface Sample {
  time: number
  delta: number
}

export interface SwipeTracker {
  readonly direction: SwipeDirection
  /** Distance moved in the dismiss direction (negative when dragged the other way). */
  readonly delta: number
  /** Distance moved across the swipe axis (absolute). */
  readonly cross: number
  move(x: number, y: number, time: number): void
  /** Release velocity in the dismiss direction, in px/ms, over the last ~100ms. */
  velocity(time: number): number
}

export function createSwipeTracker(
  direction: SwipeDirection,
  startX: number,
  startY: number,
  startTime: number,
): SwipeTracker {
  let axis = swipeAxis(direction)
  let s = sign(direction)
  let delta = 0
  let cross = 0
  let samples: Sample[] = [{ time: startTime, delta: 0 }]

  return {
    direction,
    get delta() {
      return delta
    },
    get cross() {
      return cross
    },
    move(x, y, time) {
      let dx = x - startX
      let dy = y - startY
      delta = (axis === 'x' ? dx : dy) * s
      cross = Math.abs(axis === 'x' ? dy : dx)
      samples.push({ time, delta })
      if (samples.length > 20) samples.shift()
    },
    velocity(time) {
      let recent = samples.filter((sample) => time - sample.time <= 100)
      if (recent.length < 2) return 0
      let first = recent[0]
      let last = recent[recent.length - 1]
      let elapsed = last.time - first.time
      if (elapsed <= 0) return 0
      return (last.delta - first.delta) / elapsed
    },
  }
}

/** Movement applied to the popup: the drag distance, damped when dragged against the edge. */
export function swipeMovement(delta: number): number {
  if (delta >= 0) return delta
  return -Math.sqrt(-delta) * 2
}

export function swipeProgress(movement: number, size: number): number {
  if (size <= 0) return movement > 0 ? 1 : 0
  return Math.min(1, Math.max(0, movement / size))
}

export function shouldDismiss(movement: number, size: number, velocity: number): boolean {
  if (movement <= 0) return false
  if (movement >= size * SWIPE_DISMISS_FRACTION) return true
  return velocity >= SWIPE_DISMISS_VELOCITY && movement >= SWIPE_MIN_FLICK_DISTANCE
}

/**
 * Base UI's `--drawer-swipe-strength`: a 0.1–1 factor for the release transition duration.
 * The less distance left and the faster the flick, the shorter the transition.
 */
export function swipeStrength(movement: number, size: number, velocity: number): number {
  let remaining = 1 - swipeProgress(movement, size)
  let speed = velocity > SWIPE_DISMISS_VELOCITY ? SWIPE_DISMISS_VELOCITY / velocity : 1
  return Math.min(1, Math.max(0.1, remaining * speed))
}

/** `--drawer-swipe-movement-x` / `-y` values for a movement in the dismiss direction. */
export function swipeMovementVars(
  direction: SwipeDirection,
  movement: number,
): { x: string; y: string } {
  let offset = `${Math.round(movement * sign(direction) * 100) / 100}px`
  return swipeAxis(direction) === 'x' ? { x: offset, y: '0px' } : { x: '0px', y: offset }
}
