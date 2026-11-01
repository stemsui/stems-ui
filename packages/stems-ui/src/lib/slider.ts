/**
 * Pure value math for `stems-ui/slider`: sanitizing values, keyboard stepping, collisions
 * between range thumbs, pointer position → value, and the inline positioning styles.
 */

import { clamp, roundToStep } from './number.ts'

export type SliderOrientation = 'horizontal' | 'vertical'
export type ThumbCollisionBehavior = 'push' | 'swap' | 'none'
export type ThumbAlignment = 'center' | 'edge' | 'edge-client-only'

export interface SliderRange {
  min: number
  max: number
  step: number
  /** Minimum distance between neighboring thumbs (`minStepsBetweenValues * step`). */
  minDistance: number
}

/** Clamps every value into the range, snaps it to the step, and sorts ascending. */
export function sanitizeValues(values: readonly number[], range: SliderRange): number[] {
  return values
    .map((value) =>
      Number.isFinite(value)
        ? clamp(roundToStep(value, range.step, range.min), range.min, range.max)
        : range.min,
    )
    .sort((a, b) => a - b)
}

/** Converts a value to its position along the range as a 0-100 percentage. */
export function valueToPercent(value: number, min: number, max: number): number {
  if (max === min) return 0
  return clamp(((value - min) * 100) / (max - min), 0, 100)
}

/** The allowed interval for thumb `index` given its neighbors (used by keyboard and `none`). */
export function thumbBounds(
  values: readonly number[],
  index: number,
  range: SliderRange,
): [number, number] {
  let lower = index > 0 ? values[index - 1] + range.minDistance : range.min
  let upper = index < values.length - 1 ? values[index + 1] - range.minDistance : range.max
  return [Math.max(range.min, lower), Math.min(range.max, upper)]
}

/** Sets thumb `index` to `value`, clamped between its neighbors. */
export function setThumbValue(
  values: readonly number[],
  index: number,
  value: number,
  range: SliderRange,
): number[] {
  let next = [...values]
  let [lower, upper] = thumbBounds(values, index, range)
  next[index] = clamp(value, lower, Math.max(lower, upper))
  return next
}

export interface CollisionResult {
  values: number[]
  /** The index of the thumb being moved after the change (changes when thumbs swap). */
  activeIndex: number
}

/**
 * Moves thumb `index` to `value` during a pointer interaction, following Base UI's
 * `thumbCollisionBehavior`:
 * - `push`: neighbors are pushed along, keeping `minDistance`, and stay where they were pushed.
 * - `swap`: the thumb passes its neighbor and the active index moves with it.
 * - `none`: the thumb stops at its neighbor.
 */
export function moveThumb(
  values: readonly number[],
  index: number,
  value: number,
  range: SliderRange,
  behavior: ThumbCollisionBehavior,
): CollisionResult {
  let count = values.length
  let target = clamp(value, range.min, range.max)
  if (count < 2 || behavior === 'none') {
    return { values: setThumbValue(values, index, target, range), activeIndex: index }
  }

  if (behavior === 'push') {
    let next = [...values]
    let lowest = range.min + index * range.minDistance
    let highest = range.max - (count - 1 - index) * range.minDistance
    next[index] = clamp(target, lowest, Math.max(lowest, highest))
    for (let i = index + 1; i < count; i++) {
      next[i] = Math.max(next[i], next[i - 1] + range.minDistance)
    }
    for (let i = index - 1; i >= 0; i--) {
      next[i] = Math.min(next[i], next[i + 1] - range.minDistance)
    }
    return { values: next, activeIndex: index }
  }

  // swap
  let others = values.filter((_, i) => i !== index)
  // Ties keep the current order: a thumb only swaps once it passes its neighbor.
  let activeIndex = 0
  values.forEach((other, i) => {
    if (i !== index && (other < target || (other === target && i < index))) activeIndex++
  })
  let next = [...others.slice(0, activeIndex), target, ...others.slice(activeIndex)]
  return { values: setThumbValue(next, activeIndex, target, range), activeIndex }
}

/**
 * Picks the thumb a press at `value` should move: the closest one. When thumbs overlap, a press
 * above them picks the last and a press below picks the first, so the thumbs can be separated.
 */
export function closestThumbIndex(values: readonly number[], value: number): number {
  let closest = 0
  let distance = Infinity
  for (let i = 0; i < values.length; i++) {
    let d = Math.abs(values[i] - value)
    if (d < distance || (d === distance && value > values[i])) {
      closest = i
      distance = d
    }
  }
  return closest
}

export interface PointerGeometry {
  orientation: SliderOrientation
  rtl: boolean
  /** The control's bounding rect. */
  rect: { left: number; right: number; top: number; bottom: number; width: number; height: number }
  /** Thumb size along the axis, for `thumbAlignment="edge"` (0 for center alignment). */
  thumbSize: number
}

/** The 0-1 position of a pointer along the slider axis. */
export function pointerToFraction(x: number, y: number, geometry: PointerGeometry): number {
  let { rect, thumbSize } = geometry
  let size: number
  let offset: number
  if (geometry.orientation === 'vertical') {
    size = rect.height
    offset = rect.bottom - y
  } else {
    size = rect.width
    offset = geometry.rtl ? rect.right - x : x - rect.left
  }
  let usable = size - thumbSize
  if (usable <= 0) return 0
  return clamp((offset - thumbSize / 2) / usable, 0, 1)
}

/** Converts a 0-1 fraction to a stepped value in the range. */
export function fractionToValue(fraction: number, range: SliderRange): number {
  let raw = range.min + fraction * (range.max - range.min)
  return clamp(roundToStep(raw, range.step, range.min), range.min, range.max)
}

type StyleObject = Record<string, string | number | undefined>

/** Inline position for a thumb (Base UI's thumb style). */
export function thumbPositionStyle(
  percent: number,
  orientation: SliderOrientation,
  alignment: ThumbAlignment,
  rtl: boolean,
  active: boolean,
): StyleObject {
  let edge = alignment !== 'center'
  let style: StyleObject = { position: 'absolute', zIndex: active ? 1 : undefined }
  if (orientation === 'vertical') {
    style.bottom = `${percent}%`
    style.left = '50%'
    // Edge alignment: translating by the thumb's own size × percent keeps it inside the control.
    style.translate = `-50% ${edge ? percent : 50}%`
  } else {
    style.insetInlineStart = `${percent}%`
    style.top = '50%'
    let x = edge ? percent : 50
    style.translate = `${rtl ? x : -x}% -50%`
  }
  return style
}

/** Inline position and size for the indicator (Base UI's indicator style). */
export function indicatorPositionStyle(
  startPercent: number,
  endPercent: number,
  orientation: SliderOrientation,
): StyleObject {
  let size = `${Math.max(0, endPercent - startPercent)}%`
  if (orientation === 'vertical') {
    return { position: 'absolute', width: 'inherit', bottom: `${startPercent}%`, height: size }
  }
  return {
    position: 'relative',
    height: 'inherit',
    insetInlineStart: `${startPercent}%`,
    width: size,
  }
}

function toKebab(name: string) {
  return name.startsWith('--') ? name : name.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`)
}

/**
 * Merges owned style declarations over the host's `style` (object or string). Owned keys win
 * because they carry the widget's state; every other host declaration is kept.
 */
export function mergeOwnedStyle(owned: StyleObject, hostStyle: unknown): unknown {
  let defined = Object.entries(owned).filter(([, value]) => value !== undefined)
  if (typeof hostStyle === 'string' && hostStyle.trim() !== '') {
    let ownedText = defined.map(([key, value]) => `${toKebab(key)}:${value}`).join(';')
    return `${hostStyle.replace(/;?\s*$/, ';')}${ownedText}`
  }
  let base = hostStyle && typeof hostStyle === 'object' ? (hostStyle as StyleObject) : {}
  return { ...base, ...Object.fromEntries(defined) }
}
