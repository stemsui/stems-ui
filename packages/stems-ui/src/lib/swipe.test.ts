import { expect } from 'remix/assert'
import { describe, it } from 'remix/test'

import {
  createSwipeTracker,
  shouldDismiss,
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
})
