// Geometry helpers for `stems-ui/scroll-area`.
// Adapted from Base UI 1.9.0 (scroll-area/viewport, scroll-area/utils/getOffset, utils/scrollEdges).
// https://github.com/mui/base-ui - Copyright (c) 2024 Material-UI SAS. MIT License.

import type { TextDirection } from './direction.ts'

export type ScrollAreaOrientation = 'vertical' | 'horizontal'

/** Pixels the user must scroll past an edge before that edge's overflow attribute applies. */
export type OverflowEdgeThreshold =
  number | Partial<{ xStart: number; xEnd: number; yStart: number; yEnd: number }>

export interface OverflowEdges {
  xStart: boolean
  xEnd: boolean
  yStart: boolean
  yEnd: boolean
}

export interface NormalizedThreshold {
  xStart: number
  xEnd: number
  yStart: number
  yEnd: number
}

/** How long `data-scrolling` stays after the last scroll, in milliseconds. */
export const SCROLL_TIMEOUT = 500
/** The smallest thumb size, in pixels. */
export const MIN_THUMB_SIZE = 16
/** Scroll offsets this close to an edge snap to it (sub-pixel rounding). */
export const SCROLL_EDGE_TOLERANCE_PX = 1

export const OVERFLOW_EDGE_VARS = [
  '--scroll-area-overflow-x-start',
  '--scroll-area-overflow-x-end',
  '--scroll-area-overflow-y-start',
  '--scroll-area-overflow-y-end',
] as const

export function normalizeThreshold(
  threshold: OverflowEdgeThreshold | undefined,
): NormalizedThreshold {
  let values =
    typeof threshold === 'number'
      ? { xStart: threshold, xEnd: threshold, yStart: threshold, yEnd: threshold }
      : threshold
  return {
    xStart: Math.max(0, values?.xStart || 0),
    xEnd: Math.max(0, values?.xEnd || 0),
    yStart: Math.max(0, values?.yStart || 0),
    yEnd: Math.max(0, values?.yEnd || 0),
  }
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/**
 * Clamps a scroll offset to `[0, max]` and snaps values within a pixel of an edge to that edge.
 */
export function normalizeScrollOffset(value: number, max: number): number {
  if (max <= 0) return 0
  let clamped = clamp(value, 0, max)
  let start = clamped
  let end = max - clamped
  let nearStart = start <= SCROLL_EDGE_TOLERANCE_PX
  let nearEnd = end <= SCROLL_EDGE_TOLERANCE_PX
  if (nearStart && nearEnd) return start <= end ? 0 : max
  if (nearStart) return 0
  if (nearEnd) return max
  return clamped
}

/** Sum of an element's start and end padding (or margin) along an axis. */
export function getOffset(
  element: Element | null | undefined,
  prop: 'padding' | 'margin',
  axis: 'x' | 'y',
): number {
  if (!element) return 0
  let styles = getComputedStyle(element)
  let key = `${prop}${axis === 'x' ? 'Inline' : 'Block'}` as const
  let start = parseFloat(styles[`${key}Start`]) || 0
  // Safari misreports `marginInlineEnd` in RTL; assume symmetric margins like Base UI.
  if (axis === 'x' && prop === 'margin') return start * 2
  return start + (parseFloat(styles[`${key}End`]) || 0)
}

/** Whether the viewport has no overflow on each axis. */
export function getHiddenState(viewport: HTMLElement): { x: boolean; y: boolean; corner: boolean } {
  let y = viewport.clientHeight >= viewport.scrollHeight
  let x = viewport.clientWidth >= viewport.scrollWidth
  return { x, y, corner: x || y }
}

/**
 * The scroll offset measured from the inline-start edge. RTL viewports scroll from `0` down to
 * `-max` in current browsers.
 */
export function scrollFromStart(scrollLeft: number, direction: TextDirection): number {
  return direction === 'rtl' ? -scrollLeft : scrollLeft
}

/**
 * Sizes an overscrolling thumb (Safari rubber-banding) and returns its offset along the track.
 */
export function overscrollThumb(
  thumb: HTMLElement,
  sizeVar: string,
  fromStart: number,
  maxScroll: number,
  content: number,
  size: number,
  maxThumbOffset: number,
): number {
  let clamped = clamp(fromStart, 0, maxScroll)
  let overscroll = fromStart - clamped
  let nextSize = Math.max(MIN_THUMB_SIZE, (size * content) / (content + Math.abs(overscroll)))
  if (overscroll) thumb.style.setProperty(sizeVar, `${nextSize}px`)
  else thumb.style.removeProperty(sizeVar)
  let offset = maxScroll ? (clamped / maxScroll) * maxThumbOffset : 0
  return offset + (overscroll > 0 ? size - nextSize : 0)
}

export type StyleRecord = Record<string, string | number | undefined>

function toKebab(name: string): string {
  return name.startsWith('--') ? name : name.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`)
}

/**
 * Merges a part's style: `defaults` (layout the host may override), then the host's `style`
 * (object or string), then `owned` (state the part must control).
 */
export function mergeStyle(defaults: StyleRecord, hostStyle: unknown, owned: StyleRecord): unknown {
  let defined = (record: StyleRecord) =>
    Object.entries(record).filter(([, value]) => value !== undefined) as [string, string | number][]
  if (typeof hostStyle === 'string' && hostStyle.trim() !== '') {
    let text = (entries: [string, string | number][]) =>
      entries.map(([key, value]) => `${toKebab(key)}:${value}`).join(';')
    let before = text(defined(defaults))
    let after = text(defined(owned))
    return [before, hostStyle.replace(/;?\s*$/, ''), after].filter(Boolean).join(';')
  }
  let host = hostStyle && typeof hostStyle === 'object' ? (hostStyle as StyleRecord) : {}
  return {
    ...Object.fromEntries(defined(defaults)),
    ...host,
    ...Object.fromEntries(defined(owned)),
  }
}

let overflowVarsRegistered = false

/**
 * Registers the viewport overflow variables as non-inherited, like Base UI, so deep subtrees don't
 * recalculate style on every scroll frame. Children opt in with `inherit`. Skipped in WebKit,
 * where `inherit` doesn't work on non-inherited registered properties.
 */
export function registerOverflowVars(): void {
  if (overflowVarsRegistered) return
  overflowVarsRegistered = true
  if (typeof CSS === 'undefined' || !('registerProperty' in CSS)) return
  let ua = typeof navigator === 'undefined' ? '' : navigator.userAgent
  let webkit = /AppleWebKit/.test(ua) && !/Chrome|Chromium|Edg|Firefox/.test(ua)
  if (webkit) return
  for (let name of OVERFLOW_EDGE_VARS) {
    try {
      CSS.registerProperty({ name, syntax: '<length>', inherits: false, initialValue: '0px' })
    } catch {
      // already registered
    }
  }
}
