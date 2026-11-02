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

export function oppositeDirection(direction: SwipeDirection): SwipeDirection {
  return direction === 'up'
    ? 'down'
    : direction === 'down'
      ? 'up'
      : direction === 'left'
        ? 'right'
        : 'left'
}

// ---------------------------------------------------------------------------------------------
// Snap points. Snapping logic adapted from Base UI 1.9 (drawer/root/useDrawerSnapPoints and
// drawer/viewport/DrawerViewport), https://github.com/mui/base-ui - MIT License.

/**
 * A snap point: a number from 0 to 1 is a fraction of the viewport height, a number above 1 is a
 * pixel height, and a string is a `px` or `rem` height (`'148px'`, `'30rem'`).
 */
export type SnapPoint = number | string

export interface ResolvedSnapPoint {
  readonly value: SnapPoint
  /** The visible height of the popup at this point (px). */
  readonly height: number
  /** How far the popup is moved toward its closed position at this point (px). */
  readonly offset: number
}

/** Release velocity (px/ms) at which a release travels further than the drag distance. */
export const SNAP_VELOCITY_THRESHOLD = 0.5
/** Extra distance (px) per px/ms of release velocity. */
export const SNAP_VELOCITY_MULTIPLIER = 300
/** Release velocity cap (px/ms) for the extra distance. */
export const MAX_SNAP_VELOCITY = 4
/** Release velocity (px/ms) toward the dismiss direction that closes from any snap point. */
export const SNAP_DISMISS_VELOCITY = 0.5

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function resolveSnapPointHeight(
  point: SnapPoint,
  viewportHeight: number,
  rootFontSize: number,
): number | null {
  if (!Number.isFinite(viewportHeight) || viewportHeight <= 0) return null
  if (typeof point === 'number') {
    if (!Number.isFinite(point)) return null
    return point <= 1 ? clamp(point, 0, 1) * viewportHeight : point
  }
  let trimmed = point.trim()
  let value = Number.parseFloat(trimmed)
  if (!Number.isFinite(value)) return null
  if (trimmed.endsWith('rem')) return value * rootFontSize
  if (trimmed.endsWith('px')) return value
  return null
}

/**
 * Resolves snap points against the measured popup and viewport. Heights are clamped to what
 * fits; points that resolve within 1px of a later point are dropped.
 */
export function resolveSnapPoints(
  points: readonly SnapPoint[],
  popupHeight: number,
  viewportHeight: number,
  rootFontSize: number,
): ResolvedSnapPoint[] {
  if (points.length === 0 || popupHeight <= 0 || viewportHeight <= 0) return []
  let maxHeight = Math.min(popupHeight, viewportHeight)
  let resolved: ResolvedSnapPoint[] = []
  for (let value of points) {
    let height = resolveSnapPointHeight(value, viewportHeight, rootFontSize)
    if (height === null) continue
    height = clamp(height, 0, maxHeight)
    resolved.push({ value, height, offset: Math.max(0, popupHeight - height) })
  }
  let deduped: ResolvedSnapPoint[] = []
  for (let index = resolved.length - 1; index >= 0; index--) {
    let point = resolved[index]
    if (deduped.some((other) => Math.abs(other.height - point.height) <= 1)) continue
    deduped.unshift(point)
  }
  return deduped
}

/** Index of the value closest to `target`, or `-1` when `values` is empty. */
export function closestIndex(values: readonly number[], target: number): number {
  let closest = -1
  let distance = Infinity
  values.forEach((value, index) => {
    let next = Math.abs(value - target)
    if (next < distance) {
      distance = next
      closest = index
    }
  })
  return closest
}

/**
 * The resolved snap point for `active`: an exact match, or else the closest resolved point to
 * the height `active` resolves to.
 */
export function findSnapPoint(
  resolved: readonly ResolvedSnapPoint[],
  active: SnapPoint | null,
  popupHeight: number,
  viewportHeight: number,
  rootFontSize: number,
): ResolvedSnapPoint | undefined {
  if (active === null || resolved.length === 0) return undefined
  let exact = resolved.find((point) => Object.is(point.value, active))
  if (exact) return exact
  let height = resolveSnapPointHeight(active, viewportHeight, rootFontSize)
  if (height === null) return undefined
  height = clamp(height, 0, Math.min(popupHeight, viewportHeight))
  return resolved[
    closestIndex(
      resolved.map((point) => point.height),
      height,
    )
  ]
}

/**
 * Movement for a drag of `delta` (dismiss direction) from a snap point at `baseOffset`: follows
 * the pointer, damped only once the popup would travel past its fully open position.
 */
export function snapMovement(baseOffset: number, delta: number): number {
  let next = baseOffset + delta
  if (next >= 0) return delta
  return -Math.sqrt(-next) - baseOffset
}

/**
 * Base UI's `--drawer-swipe-progress` with snap points: 0 at the most open point, 1 at the next
 * one, so a backdrop fades out as the drawer moves to a lower point. `null` with fewer than two
 * points.
 */
export function snapProgress(
  resolved: readonly ResolvedSnapPoint[],
  offset: number,
): number | null {
  if (resolved.length < 2) return null
  let offsets = resolved.map((point) => point.offset).sort((a, b) => a - b)
  let range = offsets[1] - offsets[0]
  if (range <= 0) return null
  return clamp((offset - offsets[0]) / range, 0, 1)
}

export type SnapRelease =
  | { type: 'snap'; point: ResolvedSnapPoint }
  /** Close the drawer; `point` is where it would have settled. */
  | { type: 'close'; point: ResolvedSnapPoint }

export interface SnapReleaseInput {
  points: readonly ResolvedSnapPoint[]
  /** The offset of the snap point the drag started from. */
  currentOffset: number
  /** The drag distance in the dismiss direction. */
  delta: number
  /** The release velocity in the dismiss direction (px/ms). */
  velocity: number
  popupHeight: number
  /** Base UI's `snapToSequentialPoints`: no velocity-based skipping. */
  sequential: boolean
}

/** Where a released drag settles: a snap point, or closed. `points` must not be empty. */
export function resolveSnapRelease(input: SnapReleaseInput): SnapRelease {
  let { points, currentOffset, delta, velocity, popupHeight, sequential } = input
  let direction = Math.sign(delta)
  // A release that flicks back against the drag is treated as having no velocity.
  if (direction !== 0 && Math.sign(velocity) !== 0 && Math.sign(velocity) !== direction) {
    velocity = 0
  }
  let dragTarget = clamp(currentOffset + delta, 0, popupHeight)
  let fast = Math.abs(velocity) >= SNAP_VELOCITY_THRESHOLD
  let velocityOffset = fast
    ? clamp(velocity, -MAX_SNAP_VELOCITY, MAX_SNAP_VELOCITY) * SNAP_VELOCITY_MULTIPLIER
    : 0
  let target = sequential ? dragTarget : clamp(dragTarget + velocityOffset, 0, popupHeight)

  if (sequential) {
    let ordered = [...points].sort((a, b) => a.offset - b.offset)
    let offsets = ordered.map((point) => point.offset)
    let currentIndex = closestIndex(offsets, currentOffset)
    let point = ordered[closestIndex(offsets, target)]
    let effective = target
    if (direction !== 0 && fast) {
      let adjacentIndex = clamp(currentIndex + direction, 0, ordered.length - 1)
      if (adjacentIndex !== currentIndex) {
        let adjacent = ordered[adjacentIndex]
        if (direction > 0 ? target < adjacent.offset : target > adjacent.offset) {
          point = adjacent
          effective = adjacent.offset
        }
      } else if (direction > 0) {
        return { type: 'close', point }
      }
    }
    if (Math.abs(effective - popupHeight) < Math.abs(effective - point.offset)) {
      return { type: 'close', point }
    }
    return { type: 'snap', point }
  }

  let point =
    points[
      closestIndex(
        points.map((candidate) => candidate.offset),
        target,
      )
    ]
  if (velocity >= SNAP_DISMISS_VELOCITY && delta > 0) return { type: 'close', point }
  if (Math.abs(target - popupHeight) < Math.abs(target - point.offset)) {
    return { type: 'close', point }
  }
  return { type: 'snap', point }
}

/** `--drawer-swipe-movement-x` / `-y` values for a movement in the dismiss direction. */
export function swipeMovementVars(
  direction: SwipeDirection,
  movement: number,
): { x: string; y: string } {
  let offset = `${Math.round(movement * sign(direction) * 100) / 100}px`
  return swipeAxis(direction) === 'x' ? { x: offset, y: '0px' } : { x: '0px', y: offset }
}
