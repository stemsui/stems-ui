// Behavior adapted from Base UI 1.9.0 (packages/react/src/scroll-area).
// https://github.com/mui/base-ui - Copyright (c) 2024 Material-UI SAS. MIT License.

import { attrs, createElement, createMixin, on, ref } from '@remix-run/component'
import type {
  ElementProps,
  Handle,
  MixinFactory,
  MixinHandle,
  RemixNode,
} from '@remix-run/component'

import { splitOptions } from './lib/collapsible-panel.ts'
import { getDirection } from './lib/direction.ts'
import {
  MIN_THUMB_SIZE,
  OVERFLOW_EDGE_VARS,
  SCROLL_TIMEOUT,
  getHiddenState,
  getOffset,
  mergeStyle,
  normalizeScrollOffset,
  normalizeThreshold,
  overscrollThumb,
  registerOverflowVars,
  scrollFromStart,
  type NormalizedThreshold,
  type OverflowEdgeThreshold,
  type OverflowEdges,
  type ScrollAreaOrientation,
  type StyleRecord,
} from './lib/scroll-area.ts'

export type {
  OverflowEdgeThreshold,
  OverflowEdges,
  ScrollAreaOrientation,
} from './lib/scroll-area.ts'

export interface ScrollAreaContextProps {
  /**
   * The threshold in pixels that must be passed before the overflow edge attributes apply. A
   * number for every edge, or an object per edge.
   * @default 0
   */
  overflowEdgeThreshold?: OverflowEdgeThreshold
  children?: RemixNode
}

/** A snapshot of the scroll area's state (Base UI's `ScrollArea.Root.State`). */
export interface ScrollAreaState {
  /** Whether the pointer is over the scroll area. */
  readonly hovering: boolean
  /** Whether the user is scrolling either axis. */
  readonly scrolling: boolean
  readonly scrollingX: boolean
  readonly scrollingY: boolean
  /** Whether the content is wider than the viewport. */
  readonly hasOverflowX: boolean
  /** Whether the content is taller than the viewport. */
  readonly hasOverflowY: boolean
  readonly overflowXStart: boolean
  readonly overflowXEnd: boolean
  readonly overflowYStart: boolean
  readonly overflowYEnd: boolean
  /** Whether the corner is hidden (fewer than two scrollbars are needed). */
  readonly cornerHidden: boolean
}

export interface ScrollAreaContextValue {
  /** The current state. Reading it doesn't subscribe to changes. */
  readonly state: ScrollAreaState
  /**
   * Re-measures the viewport. Size changes of the viewport and `content()` are observed
   * automatically; call this after changes neither observer can see.
   */
  measure(): void
}

export interface ScrollAreaScrollbarOptions {
  /**
   * Whether the scrollbar controls vertical or horizontal scroll.
   * @default 'vertical'
   */
  orientation?: ScrollAreaOrientation
  /**
   * Keep the scrollbar visible when its axis has no overflow, instead of setting `hidden`.
   * @default false
   */
  keepMounted?: boolean
}

export interface ScrollAreaThumbOptions {
  /**
   * The orientation of the scrollbar this thumb is in. Without it the thumb reads it from its
   * scrollbar once mounted, so pass it for correct server-rendered markup of horizontal thumbs.
   */
  orientation?: ScrollAreaOrientation
}

type AttrRecord = Record<string, string | number | boolean | undefined>

interface MutableState {
  hovering: boolean
  scrollingX: boolean
  scrollingY: boolean
  hiddenX: boolean
  hiddenY: boolean
  hiddenCorner: boolean
  edges: OverflowEdges
  measured: boolean
  thumbWidth: number
  thumbHeight: number
  cornerWidth: number
  cornerHeight: number
}

interface ScrollbarEntry {
  orientation: ScrollAreaOrientation
  keepMounted: boolean
}

interface ThumbEntry {
  orientation: ScrollAreaOrientation | undefined
}

type Part = 'root' | 'viewport' | 'content' | 'corner'

const VERTICAL: ScrollAreaOrientation = 'vertical'

function flag(value: boolean): '' | undefined {
  return value ? '' : undefined
}

/**
 * Owns the measured state. Scroll and resize updates write attributes and CSS variables to the
 * registered parts directly instead of re-rendering, so scrolling never re-renders the content.
 * Mixin renders read the same state, so a re-render by the app agrees with the DOM.
 */
class ScrollAreaStore {
  state: MutableState = {
    hovering: false,
    scrollingX: false,
    scrollingY: false,
    hiddenX: true,
    hiddenY: true,
    hiddenCorner: true,
    edges: { xStart: false, xEnd: false, yStart: false, yEnd: false },
    measured: false,
    thumbWidth: 0,
    thumbHeight: 0,
    cornerWidth: 0,
    cornerHeight: 0,
  }
  threshold: NormalizedThreshold = normalizeThreshold(undefined)

  parts: Partial<Record<Part, HTMLElement>> = {}
  scrollbars = new Map<HTMLElement, ScrollbarEntry>()
  thumbs = new Map<HTMLElement, ThumbEntry>()
  /** Whether the app set `tabIndex` on the viewport (then the store leaves it alone). */
  viewportHostTabIndex = false

  touchModality = false
  programmaticScroll = true
  lastPosition = { x: 0, y: 0 }
  drag: {
    pointerId: number | null
    orientation: ScrollAreaOrientation
    startX: number
    startY: number
    startTop: number
    startLeft: number
    savedSnap: string | null
  } = {
    pointerId: null,
    orientation: VERTICAL,
    startX: 0,
    startY: 0,
    startTop: 0,
    startLeft: 0,
    savedSnap: null,
  }

  timers: {
    x?: ReturnType<typeof setTimeout>
    y?: ReturnType<typeof setTimeout>
    end?: ReturnType<typeof setTimeout>
  } = {}
  observer: ResizeObserver | null = null
  refreshQueued = false
  disposed = false

  readonly publicValue: ScrollAreaContextValue

  constructor() {
    let store = this
    let state = this.state
    this.publicValue = {
      state: {
        get hovering() {
          return state.hovering
        },
        get scrolling() {
          return state.scrollingX || state.scrollingY
        },
        get scrollingX() {
          return state.scrollingX
        },
        get scrollingY() {
          return state.scrollingY
        },
        get hasOverflowX() {
          return !state.hiddenX
        },
        get hasOverflowY() {
          return !state.hiddenY
        },
        get overflowXStart() {
          return state.edges.xStart
        },
        get overflowXEnd() {
          return state.edges.xEnd
        },
        get overflowYStart() {
          return state.edges.yStart
        },
        get overflowYEnd() {
          return state.edges.yEnd
        },
        get cornerHidden() {
          return state.hiddenCorner
        },
      },
      measure() {
        store.compute()
      },
    }
  }

  // -- Attributes -------------------------------------------------------------------------------

  sharedAttrs(): AttrRecord {
    let s = this.state
    return {
      'data-scrolling': flag(s.scrollingX || s.scrollingY),
      'data-has-overflow-x': flag(!s.hiddenX),
      'data-has-overflow-y': flag(!s.hiddenY),
      'data-overflow-x-start': flag(s.edges.xStart),
      'data-overflow-x-end': flag(s.edges.xEnd),
      'data-overflow-y-start': flag(s.edges.yStart),
      'data-overflow-y-end': flag(s.edges.yEnd),
    }
  }

  rootAttrs(): AttrRecord {
    return { role: 'presentation', ...this.sharedAttrs() }
  }

  rootStyle(): StyleRecord {
    return {
      '--scroll-area-corner-height': `${this.state.cornerHeight}px`,
      '--scroll-area-corner-width': `${this.state.cornerWidth}px`,
    }
  }

  viewportAttrs(): AttrRecord {
    let s = this.state
    // Keep non-scrollable viewports out of the tab order, like Base UI.
    // https://accessibilityinsights.io/info-examples/web/scrollable-region-focusable/
    return { ...this.sharedAttrs(), tabIndex: s.hiddenX && s.hiddenY ? -1 : 0 }
  }

  contentAttrs(): AttrRecord {
    return { role: 'presentation', ...this.sharedAttrs() }
  }

  scrollbarAttrs(entry: ScrollbarEntry): AttrRecord {
    let s = this.state
    let vertical = entry.orientation === VERTICAL
    let hidden = vertical ? s.hiddenY : s.hiddenX
    return {
      'aria-hidden': 'true',
      'data-orientation': entry.orientation,
      ...this.sharedAttrs(),
      'data-scrolling': flag(vertical ? s.scrollingY : s.scrollingX),
      'data-hovering': flag(s.hovering),
      hidden: !entry.keepMounted && hidden ? true : undefined,
    }
  }

  scrollbarStyle(orientation: ScrollAreaOrientation): StyleRecord {
    return orientation === VERTICAL
      ? { '--scroll-area-thumb-height': `${this.state.thumbHeight}px` }
      : { '--scroll-area-thumb-width': `${this.state.thumbWidth}px` }
  }

  thumbAttrs(orientation: ScrollAreaOrientation): AttrRecord {
    let s = this.state
    return {
      'data-orientation': orientation,
      'data-scrolling': flag(orientation === VERTICAL ? s.scrollingY : s.scrollingX),
    }
  }

  thumbStyle(): StyleRecord {
    return { visibility: this.state.measured ? undefined : 'hidden' }
  }

  cornerAttrs(): AttrRecord {
    return { 'aria-hidden': 'true', hidden: this.state.hiddenCorner ? true : undefined }
  }

  cornerStyle(): StyleRecord {
    return { width: `${this.state.cornerWidth}px`, height: `${this.state.cornerHeight}px` }
  }

  // -- Registration -----------------------------------------------------------------------------

  setPart(part: Part, node: HTMLElement, signal: AbortSignal) {
    this.parts[part] = node
    if (part === 'viewport' || part === 'content') this.observe()
    signal.addEventListener('abort', () => {
      if (this.parts[part] === node) delete this.parts[part]
      if (part === 'viewport' || part === 'content') this.observe()
    })
    this.queueRefresh()
  }

  addScrollbar(node: HTMLElement, entry: ScrollbarEntry, signal: AbortSignal) {
    this.scrollbars.set(node, entry)
    signal.addEventListener('abort', () => this.scrollbars.delete(node))
    this.queueRefresh()
  }

  addThumb(node: HTMLElement, entry: ThumbEntry, signal: AbortSignal) {
    this.thumbs.set(node, entry)
    signal.addEventListener('abort', () => this.thumbs.delete(node))
    this.queueRefresh()
  }

  scrollbar(orientation: ScrollAreaOrientation): HTMLElement | undefined {
    for (let [node, entry] of this.scrollbars) {
      if (entry.orientation === orientation && node.isConnected) return node
    }
  }

  thumbOrientation(node: HTMLElement): ScrollAreaOrientation {
    let explicit = this.thumbs.get(node)?.orientation
    if (explicit) return explicit
    for (let [scrollbar, entry] of this.scrollbars) {
      if (scrollbar.contains(node)) return entry.orientation
    }
    return VERTICAL
  }

  thumb(orientation: ScrollAreaOrientation): HTMLElement | undefined {
    let scrollbar = this.scrollbar(orientation)
    for (let node of this.thumbs.keys()) {
      if (!node.isConnected) continue
      if (scrollbar ? scrollbar.contains(node) : this.thumbOrientation(node) === orientation) {
        return node
      }
    }
  }

  observe() {
    this.observer?.disconnect()
    if (typeof ResizeObserver === 'undefined' || this.disposed) return
    this.observer ??= new ResizeObserver(() => this.compute())
    if (this.parts.viewport) this.observer.observe(this.parts.viewport)
    if (this.parts.content) this.observer.observe(this.parts.content)
  }

  /** Re-applies every part's state and re-measures, once per microtask. */
  queueRefresh() {
    if (this.refreshQueued || this.disposed) return
    this.refreshQueued = true
    queueMicrotask(() => {
      this.refreshQueued = false
      if (this.disposed) return
      this.apply()
      this.compute()
    })
  }

  dispose() {
    this.disposed = true
    this.observer?.disconnect()
    clearTimeout(this.timers.x)
    clearTimeout(this.timers.y)
    clearTimeout(this.timers.end)
  }

  // -- DOM writes -------------------------------------------------------------------------------

  apply() {
    let { root, viewport, content, corner } = this.parts
    if (root) {
      writeAttrs(root, this.rootAttrs())
      writeStyle(root, this.rootStyle())
    }
    if (viewport) {
      let attributes = this.viewportAttrs()
      if (this.viewportHostTabIndex) delete attributes.tabIndex
      writeAttrs(viewport, attributes)
    }
    if (content) writeAttrs(content, this.contentAttrs())
    if (corner) {
      writeAttrs(corner, this.cornerAttrs())
      writeStyle(corner, this.cornerStyle())
    }
    for (let [node, entry] of this.scrollbars) {
      writeAttrs(node, this.scrollbarAttrs(entry))
      writeStyle(node, this.scrollbarStyle(entry.orientation))
    }
    for (let [node, entry] of this.thumbs) {
      let orientation = this.thumbOrientation(node)
      writeAttrs(node, this.thumbAttrs(orientation))
      // A thumb without an explicit orientation rendered as vertical; fix its size property.
      if (!entry.orientation) fixThumbSize(node, orientation)
      writeStyle(node, this.thumbStyle())
    }
  }

  update(patch: Partial<MutableState>) {
    let changed = false
    for (let key in patch) {
      let name = key as keyof MutableState
      let next = patch[name]
      let prev = this.state[name]
      if (name === 'edges') {
        let a = prev as OverflowEdges
        let b = next as OverflowEdges
        if (
          a.xStart === b.xStart &&
          a.xEnd === b.xEnd &&
          a.yStart === b.yStart &&
          a.yEnd === b.yEnd
        )
          continue
      } else if (prev === next) {
        continue
      }
      ;(this.state as unknown as Record<string, unknown>)[name] = next
      changed = true
    }
    if (changed) this.apply()
    return changed
  }

  // -- Measurement ------------------------------------------------------------------------------

  compute() {
    let viewport = this.parts.viewport
    if (!viewport || this.disposed) return
    registerOverflowVars()

    if (!this.state.measured) this.update({ measured: true })

    let contentHeight = viewport.scrollHeight
    let contentWidth = viewport.scrollWidth
    if (contentHeight === 0 || contentWidth === 0) return

    // Apply the overflow state first, so newly needed scrollbars are laid out before measuring.
    let hidden = getHiddenState(viewport)
    let hiddenChanged = this.update({
      hiddenX: hidden.x,
      hiddenY: hidden.y,
      hiddenCorner: hidden.corner,
    })

    let viewportHeight = viewport.clientHeight
    let viewportWidth = viewport.clientWidth
    let scrollTop = viewport.scrollTop
    let scrollLeft = viewport.scrollLeft
    let direction = getDirection(viewport)

    let scrollbarY = this.scrollbar('vertical')
    let scrollbarX = this.scrollbar('horizontal')
    let thumbY = this.thumb('vertical')
    let thumbX = this.thumb('horizontal')

    let ratioX = viewportWidth / contentWidth
    let ratioY = viewportHeight / contentHeight
    let maxScrollLeft = Math.max(0, contentWidth - viewportWidth)
    let maxScrollTop = Math.max(0, contentHeight - viewportHeight)

    let leftFromStart = hidden.x
      ? 0
      : normalizeScrollOffset(scrollFromStart(scrollLeft, direction), maxScrollLeft)
    let leftFromEnd = hidden.x ? 0 : maxScrollLeft - leftFromStart
    let topFromStart = hidden.y ? 0 : normalizeScrollOffset(scrollTop, maxScrollTop)
    let topFromEnd = hidden.y ? 0 : maxScrollTop - topFromStart

    let cornerWidth = 0
    let cornerHeight = 0
    if (!hidden.x && !hidden.y) {
      cornerWidth = scrollbarY?.offsetWidth || 0
      cornerHeight = scrollbarX?.offsetHeight || 0
    }

    // Scrollbars end at the corner via `--scroll-area-corner-*`. Until the corner has been sized,
    // subtract it from the measured track lengths.
    let cornerUnsized = this.state.cornerWidth === 0 && this.state.cornerHeight === 0
    let cornerWidthOffset = cornerUnsized ? cornerWidth : 0
    let cornerHeightOffset = cornerUnsized ? cornerHeight : 0

    let scrollbarXOffset = getOffset(scrollbarX, 'padding', 'x')
    let scrollbarYOffset = getOffset(scrollbarY, 'padding', 'y')
    let thumbXOffset = getOffset(thumbX, 'margin', 'x')
    let thumbYOffset = getOffset(thumbY, 'margin', 'y')

    let idealWidth = (hidden.x ? 0 : viewportWidth) - scrollbarXOffset - thumbXOffset
    let idealHeight = (hidden.y ? 0 : viewportHeight) - scrollbarYOffset - thumbYOffset
    let maxWidth = scrollbarX
      ? Math.min(scrollbarX.offsetWidth - cornerWidthOffset, idealWidth)
      : idealWidth
    let maxHeight = scrollbarY
      ? Math.min(scrollbarY.offsetHeight - cornerHeightOffset, idealHeight)
      : idealHeight
    let thumbWidth = Math.max(MIN_THUMB_SIZE, maxWidth * ratioX)
    let thumbHeight = Math.max(MIN_THUMB_SIZE, maxHeight * ratioY)

    if (scrollbarY && thumbY) {
      let maxOffset = scrollbarY.offsetHeight - thumbHeight - scrollbarYOffset - thumbYOffset
      let offset = overscrollThumb(
        thumbY,
        '--scroll-area-thumb-height',
        scrollTop,
        maxScrollTop,
        contentHeight,
        thumbHeight,
        maxOffset,
      )
      thumbY.style.transform = `translate3d(0,${offset}px,0)`
    }
    if (scrollbarX && thumbX) {
      let maxOffset = scrollbarX.offsetWidth - thumbWidth - scrollbarXOffset - thumbXOffset
      let offset = overscrollThumb(
        thumbX,
        '--scroll-area-thumb-width',
        scrollFromStart(scrollLeft, direction),
        maxScrollLeft,
        contentWidth,
        thumbWidth,
        maxOffset,
      )
      thumbX.style.transform = `translate3d(${direction === 'rtl' ? -offset : offset}px,0,0)`
    }

    let metrics = [leftFromStart, leftFromEnd, topFromStart, topFromEnd]
    OVERFLOW_EDGE_VARS.forEach((name, index) => {
      viewport.style.setProperty(name, `${metrics[index]}px`)
    })

    let threshold = this.threshold
    let cornerChanged = this.update({
      thumbWidth,
      thumbHeight,
      cornerWidth: this.parts.corner ? cornerWidth : this.state.cornerWidth,
      cornerHeight: this.parts.corner ? cornerHeight : this.state.cornerHeight,
      edges: {
        xStart: !hidden.x && leftFromStart > threshold.xStart,
        xEnd: !hidden.x && leftFromEnd > threshold.xEnd,
        yStart: !hidden.y && topFromStart > threshold.yStart,
        yEnd: !hidden.y && topFromEnd > threshold.yEnd,
      },
    })

    // Showing a scrollbar or resizing the corner changes track lengths; measure once more.
    if (hiddenChanged || cornerChanged) this.queueRefresh()
  }

  // -- Scrolling --------------------------------------------------------------------------------

  startScrolling(vertical: boolean) {
    let key: 'x' | 'y' = vertical ? 'y' : 'x'
    clearTimeout(this.timers[key])
    this.update(vertical ? { scrollingY: true } : { scrollingX: true })
    this.timers[key] = setTimeout(() => {
      this.update(vertical ? { scrollingY: false } : { scrollingX: false })
    }, SCROLL_TIMEOUT)
  }

  handleScroll(position: { x: number; y: number }) {
    let dx = position.x - this.lastPosition.x
    let dy = position.y - this.lastPosition.y
    this.lastPosition = position
    if (dy !== 0) this.startScrolling(true)
    if (dx !== 0) this.startScrolling(false)
  }

  onViewportScroll() {
    let viewport = this.parts.viewport
    if (!viewport) return
    this.compute()
    // Only user scrolls set `data-scrolling`. WebKit can scroll from touch without dispatching any
    // events, so every scroll in touch modality counts as the user's.
    if (this.touchModality || !this.programmaticScroll) {
      this.handleScroll({ x: viewport.scrollLeft, y: viewport.scrollTop })
    }
    clearTimeout(this.timers.end)
    this.timers.end = setTimeout(() => {
      this.programmaticScroll = true
    }, 100)
  }

  userInteraction() {
    this.programmaticScroll = false
  }

  // -- Pointer ----------------------------------------------------------------------------------

  pointerHover(event: PointerEvent) {
    this.touchModality = event.pointerType === 'touch'
    if (event.pointerType === 'touch') return
    let root = this.parts.root
    let target = event.target as Node | null
    this.update({ hovering: !!root && !!target && root.contains(target) })
  }

  disableSnap() {
    let viewport = this.parts.viewport
    if (viewport && this.drag.savedSnap === null) {
      this.drag.savedSnap = viewport.style.scrollSnapType
      viewport.style.scrollSnapType = 'none'
    }
  }

  pointerDown(event: PointerEvent, orientation: ScrollAreaOrientation) {
    if (event.button !== 0) return
    let drag = this.drag
    if (drag.pointerId !== null) {
      let active = this.thumb(drag.orientation)
      // A live drag holds capture; ignore other pointers. Without capture the release went
      // missing, so let the new pointer take over.
      if (active?.hasPointerCapture(drag.pointerId)) return
    }
    drag.pointerId = event.pointerId
    drag.startX = event.clientX
    drag.startY = event.clientY
    drag.orientation = orientation
    let viewport = this.parts.viewport
    if (viewport) {
      drag.startTop = viewport.scrollTop
      drag.startLeft = viewport.scrollLeft
      this.disableSnap()
    }
    let thumb = this.thumb(orientation)
    try {
      thumb?.setPointerCapture(event.pointerId)
    } catch {
      // synthetic pointers can't be captured
    }
  }

  pointerMove(event: PointerEvent) {
    let drag = this.drag
    if (event.pointerId !== drag.pointerId) return
    // A move without the primary button is a missed release.
    if (event.buttons % 2 === 0) {
      this.pointerUp(event)
      return
    }
    let viewport = this.parts.viewport
    if (!viewport) return
    let vertical = drag.orientation === VERTICAL
    let thumb = this.thumb(drag.orientation)
    let scrollbar = this.scrollbar(drag.orientation)
    if (!thumb || !scrollbar) return
    let axis: 'x' | 'y' = vertical ? 'y' : 'x'
    let scrollbarOffset = getOffset(scrollbar, 'padding', axis)
    let thumbOffset = getOffset(thumb, 'margin', axis)
    let thumbSize = axisSize(thumb, vertical)
    let trackSize = axisSize(scrollbar, vertical)
    let maxThumbOffset = trackSize - thumbSize - scrollbarOffset - thumbOffset
    let delta = vertical ? event.clientY - drag.startY : event.clientX - drag.startX
    let ratio = maxThumbOffset <= 0 ? 0 : delta / maxThumbOffset
    let scrollable = vertical ? viewport.scrollHeight : viewport.scrollWidth
    let size = vertical ? viewport.clientHeight : viewport.clientWidth
    let start = vertical ? drag.startTop : drag.startLeft
    let next = start + ratio * (scrollable - size)
    if (vertical) viewport.scrollTop = next
    else viewport.scrollLeft = next
    event.preventDefault()
    this.startScrolling(vertical)
  }

  pointerUp(event: PointerEvent) {
    let drag = this.drag
    if (event.pointerId !== drag.pointerId) return
    drag.pointerId = null
    let vertical = drag.orientation === VERTICAL
    clearTimeout(this.timers[vertical ? 'y' : 'x'])
    this.update(vertical ? { scrollingY: false } : { scrollingX: false })
    if (drag.savedSnap !== null) {
      if (this.parts.viewport) this.parts.viewport.style.scrollSnapType = drag.savedSnap
      drag.savedSnap = null
    }
    let thumb = this.thumb(drag.orientation)
    if (thumb?.hasPointerCapture(event.pointerId)) thumb.releasePointerCapture(event.pointerId)
  }

  /** Jumps so the thumb centers on the pressed track position, then drags from there. */
  trackPointerDown(event: PointerEvent, orientation: ScrollAreaOrientation) {
    if (event.button !== 0) return
    let thumb = this.thumb(orientation)
    if (thumb && event.target instanceof Node && thumb.contains(event.target)) return
    let viewport = this.parts.viewport
    let scrollbar = this.scrollbar(orientation)
    if (!viewport || !thumb || !scrollbar) return
    let vertical = orientation === VERTICAL
    let axis: 'x' | 'y' = vertical ? 'y' : 'x'
    let thumbOffset = getOffset(thumb, 'margin', axis)
    let scrollbarOffset = getOffset(scrollbar, 'padding', axis)
    let thumbSize = axisSize(thumb, vertical)
    let rect = scrollbar.getBoundingClientRect()
    let position =
      (vertical ? event.clientY - rect.top : event.clientX - rect.left) -
      thumbSize / 2 -
      scrollbarOffset +
      thumbOffset / 2
    let scrollable = vertical ? viewport.scrollHeight : viewport.scrollWidth
    let size = vertical ? viewport.clientHeight : viewport.clientWidth
    let trackSize = axisSize(scrollbar, vertical)
    let maxThumbOffset = trackSize - thumbSize - scrollbarOffset - thumbOffset
    if (maxThumbOffset <= 0) return
    let ratio = position / maxThumbOffset
    let distance = scrollable - size
    this.disableSnap()
    if (vertical) viewport.scrollTop = ratio * distance
    else if (getDirection(viewport) === 'rtl') viewport.scrollLeft = -(1 - ratio) * distance
    else viewport.scrollLeft = ratio * distance
    this.handleScroll({ x: viewport.scrollLeft, y: viewport.scrollTop })
    this.pointerDown(event, orientation)
  }

  /** The scrollbar sits outside the viewport, so wheel over it scrolls the viewport by hand. */
  scrollbarWheel(event: WheelEvent, orientation: ScrollAreaOrientation) {
    let viewport = this.parts.viewport
    if (!viewport || event.ctrlKey) return
    let horizontal = orientation !== VERTICAL
    let delta = horizontal ? event.deltaX : event.deltaY
    if (delta === 0) return
    let max = horizontal
      ? viewport.scrollWidth - viewport.clientWidth
      : viewport.scrollHeight - viewport.clientHeight
    let rtl = horizontal && getDirection(viewport) === 'rtl'
    let min = rtl ? -max : 0
    let top = rtl ? 0 : max
    let current = horizontal ? viewport.scrollLeft : viewport.scrollTop
    // At an edge, let the wheel chain to the page.
    if ((current <= min && delta < 0) || (current >= top && delta > 0)) return
    event.preventDefault()
    let next = Math.min(top, Math.max(min, current + delta))
    if (horizontal) viewport.scrollLeft = next
    else viewport.scrollTop = next
    this.handleScroll({ x: viewport.scrollLeft, y: viewport.scrollTop })
  }
}

/** Unrounded border-box size along an axis (offset sizes round to integers). */
function axisSize(element: HTMLElement, vertical: boolean): number {
  let rect = element.getBoundingClientRect()
  return vertical ? rect.height : rect.width
}

function attributeName(key: string): string {
  return key === 'tabIndex' ? 'tabindex' : key
}

function writeAttrs(node: HTMLElement, attributes: AttrRecord) {
  for (let key in attributes) {
    let value = attributes[key]
    let name = attributeName(key)
    if (value === undefined || value === false) {
      if (node.hasAttribute(name)) node.removeAttribute(name)
    } else {
      let text = value === true ? '' : String(value)
      if (node.getAttribute(name) !== text) node.setAttribute(name, text)
    }
  }
}

function toKebab(name: string): string {
  return name.startsWith('--') ? name : name.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`)
}

function writeStyle(node: HTMLElement, style: StyleRecord) {
  for (let key in style) {
    let value = style[key]
    let name = toKebab(key)
    if (value === undefined) node.style.removeProperty(name)
    else if (node.style.getPropertyValue(name) !== String(value)) {
      node.style.setProperty(name, String(value))
    }
  }
}

function thumbDefaults(orientation: ScrollAreaOrientation): StyleRecord {
  return orientation === VERTICAL
    ? { height: 'var(--scroll-area-thumb-height)' }
    : { width: 'var(--scroll-area-thumb-width)' }
}

function fixThumbSize(node: HTMLElement, orientation: ScrollAreaOrientation) {
  let [size, other] = orientation === VERTICAL ? ['height', 'width'] : ['width', 'height']
  let otherVar = `var(--scroll-area-thumb-${other})`
  if (node.style.getPropertyValue(other) === otherVar) node.style.removeProperty(other)
  if (!node.style.getPropertyValue(size)) {
    node.style.setProperty(size, `var(--scroll-area-thumb-${size})`)
  }
}

function ScrollAreaProvider(
  handle: Handle<ScrollAreaContextProps, ScrollAreaContextValue>,
): () => RemixNode {
  let store = new ScrollAreaStore()
  stores.set(store.publicValue, store)
  handle.context.set(store.publicValue)
  handle.signal.addEventListener('abort', () => store.dispose())

  return () => {
    let next = normalizeThreshold(handle.props.overflowEdgeThreshold)
    let prev = store.threshold
    if (
      next.xStart !== prev.xStart ||
      next.xEnd !== prev.xEnd ||
      next.yStart !== prev.yStart ||
      next.yEnd !== prev.yEnd
    ) {
      store.threshold = next
      store.queueRefresh()
    }
    return handle.props.children
  }
}

const stores = new WeakMap<ScrollAreaContextValue, ScrollAreaStore>()

function getStore(handle: MixinHandle): ScrollAreaStore {
  let value = handle.context.get(ScrollAreaProvider) as ScrollAreaContextValue | undefined
  let store = value && stores.get(value)
  if (!store) throw new Error('stems-ui/scroll-area: parts must render inside <scrollArea.Context>')
  return store
}

/** Re-applies DOM-owned state after a render committed (a string `style` may have reset it). */
function refreshAfterRender(handle: MixinHandle, store: ScrollAreaStore) {
  handle.queueTask(() => store.queueRefresh())
}

const rootMixin: MixinFactory<HTMLElement, [], ElementProps> = createMixin<
  HTMLElement,
  [],
  ElementProps
>((handle) => {
  let store = getStore(handle)
  return (props) => {
    refreshAfterRender(handle, store)
    return createElement(handle.element, {
      style: mergeStyle({ position: 'relative' }, props.style, store.rootStyle()),
      mix: [
        attrs(store.rootAttrs()),
        ref((node: HTMLElement, signal) => store.setPart('root', node, signal)),
        on<HTMLElement, 'pointerenter'>('pointerenter', (event) => store.pointerHover(event)),
        on<HTMLElement, 'pointermove'>('pointermove', (event) => store.pointerHover(event)),
        on<HTMLElement, 'pointerdown'>('pointerdown', (event) => {
          store.touchModality = event.pointerType === 'touch'
        }),
        on<HTMLElement, 'pointerleave'>('pointerleave', () => {
          store.update({ hovering: false })
        }),
      ],
    })
  }
})

const viewportMixin: MixinFactory<HTMLElement, [], ElementProps> = createMixin<
  HTMLElement,
  [],
  ElementProps
>((handle) => {
  let store = getStore(handle)
  let interact = () => store.userInteraction()
  return (props) => {
    let hostTabIndex = props.tabIndex !== undefined || props.tabindex !== undefined
    store.viewportHostTabIndex = hostTabIndex
    refreshAfterRender(handle, store)
    return createElement(handle.element, {
      // `scrollbar-width: none` hides the native scrollbars in Chromium, Firefox and Safari 18.2+;
      // older WebKit also needs `::-webkit-scrollbar { display: none }` from a stylesheet.
      style: mergeStyle({ overflow: 'scroll', scrollbarWidth: 'none' }, props.style, {}),
      mix: [
        attrs(store.viewportAttrs()),
        ref((node: HTMLElement, signal) => {
          store.setPart('viewport', node, signal)
          // `pointerenter` doesn't fire for a pointer that is already over the viewport.
          if (node.matches(':hover')) store.update({ hovering: true })
        }),
        on<HTMLElement, 'scroll'>('scroll', () => store.onViewportScroll()),
        on<HTMLElement, 'wheel'>('wheel', interact),
        on<HTMLElement, 'pointermove'>('pointermove', interact),
        on<HTMLElement, 'pointerenter'>('pointerenter', interact),
        on<HTMLElement, 'keydown'>('keydown', interact),
        on<HTMLElement, 'touchstart'>('touchstart', interact),
      ],
    })
  }
})

const contentMixin: MixinFactory<HTMLElement, [], ElementProps> = createMixin<
  HTMLElement,
  [],
  ElementProps
>((handle) => {
  let store = getStore(handle)
  return (props) => {
    refreshAfterRender(handle, store)
    return createElement(handle.element, {
      style: mergeStyle({ minWidth: 'fit-content' }, props.style, {}),
      mix: [
        attrs(store.contentAttrs()),
        ref((node: HTMLElement, signal) => store.setPart('content', node, signal)),
      ],
    })
  }
})

const scrollbarMixin: MixinFactory<
  HTMLElement,
  [options?: ScrollAreaScrollbarOptions],
  ElementProps
> = createMixin<HTMLElement, [options?: ScrollAreaScrollbarOptions], ElementProps>((handle) => {
  let store = getStore(handle)
  let entry: ScrollbarEntry = { orientation: VERTICAL, keepMounted: false }

  return (...args) => {
    let [options, props] = splitOptions<ScrollAreaScrollbarOptions>(args[0], args[1])
    // Mutate the registered entry so the store sees option changes without re-registering.
    entry.orientation = options?.orientation ?? VERTICAL
    entry.keepMounted = options?.keepMounted ?? false
    let vertical = entry.orientation === VERTICAL
    refreshAfterRender(handle, store)

    let defaults: StyleRecord = {
      position: 'absolute',
      touchAction: 'none',
      WebkitUserSelect: 'none',
      userSelect: 'none',
      ...(vertical
        ? { top: 0, bottom: 'var(--scroll-area-corner-height)', insetInlineEnd: 0 }
        : { insetInlineStart: 0, insetInlineEnd: 'var(--scroll-area-corner-width)', bottom: 0 }),
    }

    return createElement(handle.element, {
      style: mergeStyle(defaults, props.style, store.scrollbarStyle(entry.orientation)),
      mix: [
        attrs(store.scrollbarAttrs(entry)),
        ref((node: HTMLElement, signal) => store.addScrollbar(node, entry, signal)),
        on<HTMLElement, 'pointerdown'>('pointerdown', (event) =>
          store.trackPointerDown(event, entry.orientation),
        ),
        // Native scrollbars don't move focus when pressed.
        on<HTMLElement, 'mousedown'>('mousedown', (event) => event.preventDefault()),
        on<HTMLElement, 'pointerup'>('pointerup', (event) => store.pointerUp(event)),
        on<HTMLElement, 'pointercancel'>('pointercancel', (event) => store.pointerUp(event)),
        on<HTMLElement, 'wheel'>('wheel', (event) =>
          store.scrollbarWheel(event, entry.orientation),
        ),
      ],
    })
  }
})

const thumbMixin: MixinFactory<HTMLElement, [options?: ScrollAreaThumbOptions], ElementProps> =
  createMixin<HTMLElement, [options?: ScrollAreaThumbOptions], ElementProps>((handle) => {
    let store = getStore(handle)
    let entry: ThumbEntry = { orientation: undefined }
    let node: HTMLElement | null = null

    return (...args) => {
      let [options, props] = splitOptions<ScrollAreaThumbOptions>(args[0], args[1])
      entry.orientation = options?.orientation
      let orientation = entry.orientation ?? (node ? store.thumbOrientation(node) : VERTICAL)
      refreshAfterRender(handle, store)

      return createElement(handle.element, {
        style: mergeStyle(thumbDefaults(orientation), props.style, store.thumbStyle()),
        mix: [
          attrs(store.thumbAttrs(orientation)),
          ref((element: HTMLElement, signal) => {
            node = element
            store.addThumb(element, entry, signal)
            signal.addEventListener('abort', () => {
              if (node === element) node = null
            })
          }),
          on<HTMLElement, 'pointerdown'>('pointerdown', (event) => {
            if (node) store.pointerDown(event, store.thumbOrientation(node))
          }),
          on<HTMLElement, 'pointermove'>('pointermove', (event) => store.pointerMove(event)),
          on<HTMLElement, 'pointerup'>('pointerup', (event) => store.pointerUp(event)),
          on<HTMLElement, 'pointercancel'>('pointercancel', (event) => store.pointerUp(event)),
        ],
      })
    }
  })

const cornerMixin: MixinFactory<HTMLElement, [], ElementProps> = createMixin<
  HTMLElement,
  [],
  ElementProps
>((handle) => {
  let store = getStore(handle)
  return (props) => {
    refreshAfterRender(handle, store)
    return createElement(handle.element, {
      style: mergeStyle(
        { position: 'absolute', bottom: 0, insetInlineEnd: 0 },
        props.style,
        store.cornerStyle(),
      ),
      mix: [
        attrs(store.cornerAttrs()),
        ref((node: HTMLElement, signal) => store.setPart('corner', node, signal)),
      ],
    })
  }
})

/** Owns the scroll area's measured state. Read it with `handle.context.get(scrollArea.Context)`. */
export const Context = ScrollAreaProvider
/** Groups the parts. Tracks hover; carries the overflow attributes and corner CSS variables. */
export const root = rootMixin
/** The native scroll container. Hides native scrollbars and is focusable when it can scroll. */
export const viewport = viewportMixin
/** Wraps the content inside the viewport so content size changes are observed. */
export const content = contentMixin
/** A vertical (default) or horizontal custom scrollbar track. `hidden` without overflow. */
export const scrollbar = scrollbarMixin
/** The draggable thumb inside a scrollbar. */
export const thumb = thumbMixin
/** Fills the space where the two scrollbars meet. `hidden` unless both are needed. */
export const corner = cornerMixin
