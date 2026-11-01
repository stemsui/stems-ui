import { expect } from 'remix/assert'
import { describe, it } from 'remix/test'

import {
  closestThumbIndex,
  fractionToValue,
  indicatorPositionStyle,
  mergeOwnedStyle,
  moveThumb,
  pointerToFraction,
  sanitizeValues,
  setThumbValue,
  thumbPositionStyle,
} from './slider.ts'

const range = { min: 0, max: 100, step: 1, minDistance: 0 }

describe('lib/slider', () => {
  it('sanitizes values: clamps, snaps, sorts', () => {
    expect(sanitizeValues([120, -5, 33.4], range)).toEqual([0, 33, 100])
    expect(sanitizeValues([Number.NaN], range)).toEqual([0])
    expect(sanitizeValues([7], { ...range, step: 5, min: 1 })).toEqual([6])
  })

  it('clamps a thumb between its neighbors', () => {
    expect(setThumbValue([20, 60], 0, 80, range)).toEqual([60, 60])
    expect(setThumbValue([20, 60], 0, 80, { ...range, minDistance: 10 })).toEqual([50, 60])
    expect(setThumbValue([20, 60], 1, -4, { ...range, minDistance: 10 })).toEqual([20, 30])
  })

  it('pushes neighbors', () => {
    expect(moveThumb([20, 40, 60], 0, 70, range, 'push')).toEqual({
      values: [70, 70, 70],
      activeIndex: 0,
    })
    expect(moveThumb([20, 40, 60], 0, 95, { ...range, minDistance: 5 }, 'push')).toEqual({
      values: [90, 95, 100],
      activeIndex: 0,
    })
    expect(moveThumb([20, 40], 1, 10, range, 'push')).toEqual({ values: [10, 10], activeIndex: 1 })
  })

  it('swaps past neighbors', () => {
    expect(moveThumb([20, 60], 0, 80, range, 'swap')).toEqual({ values: [60, 80], activeIndex: 1 })
    expect(moveThumb([20, 60], 0, 60, range, 'swap')).toEqual({ values: [60, 60], activeIndex: 0 })
    expect(moveThumb([20, 60], 1, 5, range, 'swap')).toEqual({ values: [5, 20], activeIndex: 0 })
  })

  it("stops at neighbors with 'none'", () => {
    expect(moveThumb([20, 60], 0, 80, range, 'none')).toEqual({ values: [60, 60], activeIndex: 0 })
  })

  it('finds the closest thumb, separating overlapping thumbs by press direction', () => {
    expect(closestThumbIndex([20, 60], 30)).toBe(0)
    expect(closestThumbIndex([20, 60], 50)).toBe(1)
    expect(closestThumbIndex([50, 50], 70)).toBe(1)
    expect(closestThumbIndex([50, 50], 30)).toBe(0)
  })

  it('maps pointer positions, honoring RTL, vertical, and edge alignment', () => {
    let rect = { left: 100, right: 300, top: 0, bottom: 200, width: 200, height: 200 }
    let base = { orientation: 'horizontal' as const, rtl: false, rect, thumbSize: 0 }
    expect(pointerToFraction(150, 0, base)).toBe(0.25)
    expect(pointerToFraction(50, 0, base)).toBe(0)
    expect(pointerToFraction(150, 0, { ...base, rtl: true })).toBe(0.75)
    expect(pointerToFraction(0, 50, { ...base, orientation: 'vertical' })).toBe(0.75)
    expect(pointerToFraction(110, 0, { ...base, thumbSize: 20 })).toBe(0)
    expect(pointerToFraction(200, 0, { ...base, thumbSize: 20 })).toBe(0.5)
    expect(fractionToValue(0.333, { ...range, step: 10 })).toBe(30)
  })

  it('builds Base UI-style position styles', () => {
    expect(thumbPositionStyle(25, 'horizontal', 'center', false, false)).toEqual({
      position: 'absolute',
      zIndex: undefined,
      insetInlineStart: '25%',
      top: '50%',
      translate: '-50% -50%',
    })
    expect(thumbPositionStyle(25, 'horizontal', 'edge', true, true).translate).toBe('25% -50%')
    expect(thumbPositionStyle(25, 'vertical', 'center', false, false).bottom).toBe('25%')
    expect(indicatorPositionStyle(20, 60, 'horizontal')).toEqual({
      position: 'relative',
      height: 'inherit',
      insetInlineStart: '20%',
      width: '40%',
    })
    expect(indicatorPositionStyle(0, 30, 'vertical').height).toBe('30%')
  })

  it('merges owned style into object and string host styles', () => {
    expect(mergeOwnedStyle({ width: '5%' }, { color: 'red', width: '1px' })).toEqual({
      color: 'red',
      width: '5%',
    })
    expect(mergeOwnedStyle({ insetInlineStart: '5%' }, 'color: red')).toBe(
      'color: red;inset-inline-start:5%',
    )
    expect(mergeOwnedStyle({ top: undefined }, undefined)).toEqual({})
  })
})
