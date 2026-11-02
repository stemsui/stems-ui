import { expect } from 'remix/assert'
import { describe, it } from 'remix/test'

import {
  closestIndex,
  createSwipeTracker,
  findSnapPoint,
  oppositeDirection,
  resolveSnapPointHeight,
  resolveSnapPoints,
  resolveSnapRelease,
  shouldDismiss,
  snapMovement,
  snapProgress,
  swipeAxis,
  swipeMovement,
  swipeMovementVars,
  swipeProgress,
  swipeStrength,
} from './swipe.ts'

describe('swipe', () => {
  it('maps directions to axes', () => {
    expect(swipeAxis('down')).toBe('y')
    expect(swipeAxis('up')).toBe('y')
    expect(swipeAxis('left')).toBe('x')
    expect(swipeAxis('right')).toBe('x')
  })

  it('measures movement in the dismiss direction', () => {
    let down = createSwipeTracker('down', 0, 0, 0)
    down.move(3, 40, 10)
    expect(down.delta).toBe(40)
    expect(down.cross).toBe(3)

    let up = createSwipeTracker('up', 0, 100, 0)
    up.move(0, 60, 10)
    expect(up.delta).toBe(40)

    let left = createSwipeTracker('left', 100, 0, 0)
    left.move(70, 5, 10)
    expect(left.delta).toBe(30)
    expect(left.cross).toBe(5)
  })

  it('computes release velocity over recent samples', () => {
    let tracker = createSwipeTracker('down', 0, 0, 0)
    tracker.move(0, 10, 300)
    tracker.move(0, 40, 320)
    tracker.move(0, 80, 340)
    expect(tracker.velocity(340)).toBe(70 / 40)
    expect(tracker.velocity(1000)).toBe(0)
  })

  it('damps movement against the dismiss direction', () => {
    expect(swipeMovement(25)).toBe(25)
    expect(swipeMovement(-25)).toBe(-10)
  })

  it('decides dismissal from distance or velocity', () => {
    expect(shouldDismiss(90, 200, 0)).toBe(true)
    expect(shouldDismiss(50, 200, 0.1)).toBe(false)
    expect(shouldDismiss(30, 200, 1)).toBe(true)
    expect(shouldDismiss(10, 200, 2)).toBe(false)
    expect(shouldDismiss(-10, 200, 2)).toBe(false)
  })

  it('computes progress, strength, and CSS variables', () => {
    expect(swipeProgress(50, 200)).toBe(0.25)
    expect(swipeProgress(300, 200)).toBe(1)
    expect(swipeProgress(-5, 200)).toBe(0)
    expect(swipeStrength(0, 200, 0)).toBe(1)
    expect(swipeStrength(100, 200, 0)).toBe(0.5)
    expect(swipeStrength(100, 200, 2)).toBe(0.125)
    expect(swipeStrength(199, 200, 5)).toBe(0.1)
    expect(swipeMovementVars('down', 12)).toEqual({ x: '0px', y: '12px' })
    expect(swipeMovementVars('up', 12)).toEqual({ x: '0px', y: '-12px' })
    expect(swipeMovementVars('left', 12)).toEqual({ x: '-12px', y: '0px' })
  })

  it('maps directions to their opposites', () => {
    expect(oppositeDirection('down')).toBe('up')
    expect(oppositeDirection('up')).toBe('down')
    expect(oppositeDirection('left')).toBe('right')
    expect(oppositeDirection('right')).toBe('left')
  })
})

describe('snap points', () => {
  it('resolves fractions, pixels, px and rem strings', () => {
    expect(resolveSnapPointHeight(0.5, 800, 16)).toBe(400)
    expect(resolveSnapPointHeight(1, 800, 16)).toBe(800)
    expect(resolveSnapPointHeight(148, 800, 16)).toBe(148)
    expect(resolveSnapPointHeight('148px', 800, 16)).toBe(148)
    expect(resolveSnapPointHeight(' 10rem ', 800, 20)).toBe(200)
    expect(resolveSnapPointHeight('50%', 800, 16)).toBe(null)
    expect(resolveSnapPointHeight(Number.NaN, 800, 16)).toBe(null)
    expect(resolveSnapPointHeight(0.5, 0, 16)).toBe(null)
  })

  it('clamps to the popup and dedupes points that resolve to the same height', () => {
    let points = resolveSnapPoints(['100px', 0.25, '600px', 1], 500, 800, 16)
    // 0.25 * 800 = 200; 600px and 1 both clamp to the 500px popup, so only `1` is kept.
    expect(points).toEqual([
      { value: '100px', height: 100, offset: 400 },
      { value: 0.25, height: 200, offset: 300 },
      { value: 1, height: 500, offset: 0 },
    ])
    expect(resolveSnapPoints([0.5], 0, 800, 16)).toEqual([])
    expect(resolveSnapPoints([], 500, 800, 16)).toEqual([])
  })

  it('finds the active point exactly or by closest height', () => {
    let points = resolveSnapPoints(['100px', 1], 500, 800, 16)
    expect(findSnapPoint(points, 1, 500, 800, 16)?.offset).toBe(0)
    expect(findSnapPoint(points, '120px', 500, 800, 16)?.value).toBe('100px')
    expect(findSnapPoint(points, null, 500, 800, 16)).toBe(undefined)
    expect(closestIndex([0, 300, 400], 320)).toBe(1)
    expect(closestIndex([], 1)).toBe(-1)
  })

  it('follows the pointer, damping only past the fully open position', () => {
    expect(snapMovement(300, 50)).toBe(50)
    expect(snapMovement(300, -200)).toBe(-200)
    expect(snapMovement(300, -316)).toBe(-304)
    expect(snapMovement(0, -16)).toBe(-4)
  })

  it('reports progress between the two most open points', () => {
    let points = resolveSnapPoints(['100px', 1], 500, 800, 16)
    expect(snapProgress(points, 0)).toBe(0)
    expect(snapProgress(points, 200)).toBe(0.5)
    expect(snapProgress(points, 400)).toBe(1)
    expect(snapProgress(points, 500)).toBe(1)
    expect(snapProgress(points.slice(0, 1), 0)).toBe(null)
  })

  it('settles a slow release on the closest point, or closes past the lowest one', () => {
    // Offsets: 400 (100px), 200 (300px), 0 (1).
    let points = resolveSnapPoints(['100px', '300px', 1], 500, 800, 16)
    let base = { points, popupHeight: 500, sequential: false, velocity: 0 }
    let release = (currentOffset: number, delta: number, velocity = 0) =>
      resolveSnapRelease({ ...base, currentOffset, delta, velocity })

    expect(release(400, -150)).toEqual({ type: 'snap', point: points[1] })
    expect(release(400, -380)).toEqual({ type: 'snap', point: points[2] })
    expect(release(0, 80)).toEqual({ type: 'snap', point: points[2] })
    expect(release(0, 130)).toEqual({ type: 'snap', point: points[1] })
    expect(release(400, 60)).toEqual({ type: 'close', point: points[0] })
    expect(release(400, 40)).toEqual({ type: 'snap', point: points[0] })
  })

  it('skips points on fast flicks and closes on fast downward flicks', () => {
    let points = resolveSnapPoints(['100px', '300px', 1], 500, 800, 16)
    let base = { points, popupHeight: 500, sequential: false }
    // A fast upward flick travels velocity * 300px further: 340 - 210 lands on 300px,
    // 340 - 450 skips to the top.
    expect(resolveSnapRelease({ ...base, currentOffset: 400, delta: -60, velocity: -0.7 })).toEqual(
      { type: 'snap', point: points[1] },
    )
    expect(resolveSnapRelease({ ...base, currentOffset: 400, delta: -60, velocity: -1.5 })).toEqual(
      { type: 'snap', point: points[2] },
    )
    expect(resolveSnapRelease({ ...base, currentOffset: 0, delta: 20, velocity: 0.6 }).type).toBe(
      'close',
    )
    // A flick back against the drag counts as no velocity.
    expect(resolveSnapRelease({ ...base, currentOffset: 400, delta: -150, velocity: 2 })).toEqual({
      type: 'snap',
      point: points[1],
    })
  })

  it('moves one point at a time with snapToSequentialPoints', () => {
    let points = resolveSnapPoints(['100px', '300px', 1], 500, 800, 16)
    let base = { points, popupHeight: 500, sequential: true }
    // A fast short flick advances exactly one point.
    expect(resolveSnapRelease({ ...base, currentOffset: 400, delta: -30, velocity: -3 })).toEqual({
      type: 'snap',
      point: points[1],
    })
    expect(resolveSnapRelease({ ...base, currentOffset: 0, delta: 30, velocity: 3 })).toEqual({
      type: 'snap',
      point: points[1],
    })
    // Dragging far still passes multiple points.
    expect(resolveSnapRelease({ ...base, currentOffset: 400, delta: -390, velocity: 0 })).toEqual({
      type: 'snap',
      point: points[2],
    })
    // A fast downward flick from the lowest point closes.
    expect(resolveSnapRelease({ ...base, currentOffset: 400, delta: 10, velocity: 1 }).type).toBe(
      'close',
    )
  })
})
