// Adapted from @remix-run/ui 0.13.0 (packages/ui/src/tabs.ts).
// https://github.com/remix-run/remix - Copyright (c) 2025 Shopify Inc. MIT License.

import {
  attrs,
  createMixin,
  on,
  ref,
  type Dispatched,
  type ElementProps,
  type Handle,
  type MixinFactory,
  type MixinHandle,
  type RemixNode,
} from '@remix-run/component'

import { getDirection } from './lib/direction.ts'
import { getRovingMove, getRovingTargetIndex } from './lib/roving-focus.ts'

const TABS_CHANGE_EVENT = 'stems:tabs-change' as const

export type TabsOrientation = 'horizontal' | 'vertical'

/** Where the newly active tab sits relative to the previously active one. */
export type TabsActivationDirection = 'left' | 'right' | 'up' | 'down' | 'none'

export interface TabsContextProps {
  /**
   * The value of the active tab (controlled). `null` means no tab is active.
   * Tabs are controlled whenever this is not `undefined`.
   */
  value?: string | null
  /**
   * The initially active tab (uncontrolled). `null` means no tab is active. When omitted, the
   * first enabled tab becomes active.
   */
  defaultValue?: string | null
  /** Called when the user activates a different tab. */
  onValueChange?: (value: string, event: TabsChangeEvent) => void
  /**
   * Layout direction of the tab list. Horizontal lists use Left/Right arrows (mirrored in RTL),
   * vertical lists use Up/Down.
   * @default 'horizontal'
   */
  orientation?: TabsOrientation
  children?: RemixNode
}

export interface TabsListOptions {
  /**
   * Whether moving focus with the arrow keys also activates the focused tab. When `false`, tabs
   * are activated with Enter, Space, or a click.
   * @default false
   */
  activateOnFocus?: boolean
  /**
   * Whether arrow-key focus wraps from the last tab to the first (and back).
   * @default true
   */
  loopFocus?: boolean
}

export interface TabsTabOptions {
  /** Identifies the tab and its panel. */
  value: string
  /** Disabled tabs can't be focused or activated. */
  disabled?: boolean
}

export interface TabsPanelOptions {
  /** The value of the tab that shows this panel. */
  value: string
}

/** Shared state, read with `handle.context.get(tabs.Context)`. */
export interface TabsContextValue {
  /** The active tab's value, or `null` when no tab is active. */
  readonly value: string | null
  readonly orientation: TabsOrientation
  readonly activationDirection: TabsActivationDirection
  isActive(value: string): boolean
  getTabId(value: string): string
  getPanelId(value: string): string
  /** Activates a tab as if the user had clicked it. Disabled tabs are ignored. */
  activate(value: string): void
  /** @internal */
  _register(kind: 'tab' | 'panel', value: string, entry: RegisteredItem): void
  /** @internal */
  _unregister(kind: 'tab' | 'panel', value: string, entry: RegisteredItem): void
  /** @internal */
  _isTabbable(value: string): boolean
  /** @internal */
  _panelIndex(value: string): number
  /** @internal */
  _valueForNode(node: Element): string | undefined
  /** @internal */
  _activeTabNode(): HTMLElement | null
  /** @internal */
  _activate(value: string): void
  /** @internal */
  _setNode(kind: 'root' | 'list', node: HTMLElement | null): void
  /** @internal */
  _listNode(): HTMLElement | null
}

interface RegisteredItem {
  disabled: boolean
  getNode(): HTMLElement | null
}

/** Dispatched (bubbling) from the activated tab when the user activates a different tab. */
export class TabsChangeEvent extends Event {
  readonly value: string
  readonly previousValue: string | null
  readonly activationDirection: TabsActivationDirection

  constructor(
    value: string,
    previousValue: string | null,
    activationDirection: TabsActivationDirection,
  ) {
    super(TABS_CHANGE_EVENT, { bubbles: true })
    this.value = value
    this.previousValue = previousValue
    this.activationDirection = activationDirection
  }
}

declare global {
  interface HTMLElementEventMap {
    [TABS_CHANGE_EVENT]: TabsChangeEvent
  }
}

type TabsChangeHandler<target extends HTMLElement> = (
  event: Dispatched<TabsChangeEvent, target>,
  signal: AbortSignal,
) => void | Promise<void>

function encodeIdPart(value: string): string {
  return encodeURIComponent(value).replace(/%/g, '-')
}

function getTabsContext(handle: Handle<unknown, unknown> | MixinHandle): TabsContextValue {
  return handle.context.get(TabsProvider)
}

function isDisabledTab(node: Element) {
  return node.hasAttribute('disabled') || node.getAttribute('aria-disabled') === 'true'
}

function getListTabs(list: HTMLElement): HTMLElement[] {
  return [...list.querySelectorAll<HTMLElement>('[role="tab"]')].filter(
    (node) => node.closest('[role="tablist"]') === list,
  )
}

function stateAttrs(context: TabsContextValue) {
  return {
    'data-orientation': context.orientation,
    'data-activation-direction': context.activationDirection,
  }
}

function TabsProvider(handle: Handle<TabsContextProps, TabsContextValue>): () => RemixNode {
  // `undefined` means "not chosen yet": the first enabled tab to register becomes active.
  let uncontrolledValue: string | null | undefined
  let initialized = false
  let tabs = new Map<string, RegisteredItem>()
  let panels = new Map<string, RegisteredItem>()
  let rootNode: HTMLElement | null = null
  let listNode: HTMLElement | null = null
  let renderedValue: string | null = null
  let hasRendered = false
  let activationDirection: TabsActivationDirection = 'none'

  function isControlled() {
    return handle.props.value !== undefined
  }

  function getOrientation(): TabsOrientation {
    return handle.props.orientation ?? 'horizontal'
  }

  function getValue(): string | null {
    if (isControlled()) return handle.props.value ?? null
    if (!initialized) {
      uncontrolledValue = handle.props.defaultValue
      initialized = true
    }
    return uncontrolledValue ?? null
  }

  function getNode(map: Map<string, RegisteredItem>, value: string | null) {
    if (value === null) return null
    let node = map.get(value)?.getNode() ?? null
    return node?.isConnected ? node : null
  }

  function computeDirection(previous: string | null, next: string | null): TabsActivationDirection {
    if (previous === null || next === null || previous === next) return 'none'
    let horizontal = getOrientation() === 'horizontal'
    let previousNode = getNode(tabs, previous)
    let nextNode = getNode(tabs, next)

    if (previousNode && nextNode) {
      let a = previousNode.getBoundingClientRect()
      let b = nextNode.getBoundingClientRect()
      if (horizontal && a.left !== b.left) return b.left < a.left ? 'left' : 'right'
      if (!horizontal && a.top !== b.top) return b.top < a.top ? 'up' : 'down'
    }

    // No layout to compare (e.g. hidden list): fall back to document order.
    let order = [...tabs.keys()]
    let previousIndex = order.indexOf(previous)
    let nextIndex = order.indexOf(next)
    if (previousIndex === -1 || nextIndex === -1) return 'none'
    let forward = nextIndex > previousIndex
    if (!horizontal) return forward ? 'down' : 'up'
    let rtl = getDirection(nextNode ?? listNode ?? rootNode) === 'rtl'
    return forward !== rtl ? 'right' : 'left'
  }

  function activate(value: string) {
    if (tabs.get(value)?.disabled) return
    let previousValue = getValue()
    if (previousValue === value) return

    let direction = computeDirection(previousValue, value)
    if (!isControlled()) uncontrolledValue = value

    let event = new TabsChangeEvent(value, previousValue, direction)
    let target = getNode(tabs, value) ?? listNode ?? rootNode
    target?.dispatchEvent(event)
    handle.props.onValueChange?.(value, event)

    if (!isControlled()) void handle.update()
  }

  function isActive(value: string) {
    return getValue() === value
  }

  handle.context.set({
    get value() {
      return getValue()
    },
    get orientation() {
      return getOrientation()
    },
    get activationDirection() {
      return activationDirection
    },
    isActive,
    getTabId(value) {
      return `${handle.id}-${encodeIdPart(value)}-tab`
    },
    getPanelId(value) {
      return `${handle.id}-${encodeIdPart(value)}-panel`
    },
    activate,
    _register(kind, value, entry) {
      let map = kind === 'tab' ? tabs : panels
      map.set(value, entry)
      if (kind === 'tab' && !entry.disabled && !isControlled()) {
        getValue()
        if (uncontrolledValue === undefined) {
          uncontrolledValue = value
          // The pick happens mid-render, so treat it as the value already on screen.
          renderedValue = value
        }
      }
    },
    _unregister(kind, value, entry) {
      let map = kind === 'tab' ? tabs : panels
      if (map.get(value) === entry) map.delete(value)
    },
    _isTabbable(value) {
      let current = getValue()
      if (current !== null) return current === value
      for (let [tabValue, entry] of tabs) {
        if (!entry.disabled) return tabValue === value
      }
      return false
    },
    _panelIndex(value) {
      return [...panels.keys()].indexOf(value)
    },
    _valueForNode(node) {
      for (let [value, entry] of tabs) {
        if (entry.getNode() === node) return value
      }
      return undefined
    },
    _activeTabNode() {
      return getNode(tabs, getValue())
    },
    _activate: activate,
    _setNode(kind, node) {
      if (kind === 'root') rootNode = node
      else listNode = node
    },
    _listNode() {
      return listNode?.isConnected ? listNode : null
    },
  })

  return () => {
    let value = getValue()
    if (value !== renderedValue) {
      // Runs before children re-render, so the previous tab is still registered and laid out.
      activationDirection = hasRendered ? computeDirection(renderedValue, value) : 'none'
      renderedValue = value
    }
    hasRendered = true
    return handle.props.children
  }
}

function trackNode(
  context: TabsContextValue,
  kind: 'root' | 'list',
): ReturnType<typeof ref<HTMLElement>> {
  return ref((node: HTMLElement, signal) => {
    context._setNode(kind, node)
    signal.addEventListener('abort', () => {
      context._setNode(kind, null)
    })
  })
}

const rootMixin: MixinFactory<HTMLElement, [], ElementProps> = createMixin<
  HTMLElement,
  [],
  ElementProps
>((handle) => {
  let context = getTabsContext(handle)

  return () => [attrs(stateAttrs(context)), trackNode(context, 'root')]
})

const listMixin: MixinFactory<HTMLElement, [options?: TabsListOptions], ElementProps> = createMixin<
  HTMLElement,
  [options?: TabsListOptions],
  ElementProps
>((handle) => {
  let context = getTabsContext(handle)
  let listNode: HTMLElement | null = null

  return (...args: [options: TabsListOptions | undefined, props: ElementProps]) => {
    // Called as `list()`, the runtime passes the host props in the first slot, not the options.
    let options: TabsListOptions = (args.length > 1 ? args[0] : undefined) ?? {}
    let activateOnFocus = options.activateOnFocus ?? false
    let loopFocus = options.loopFocus ?? true
    let orientation = context.orientation

    return [
      attrs({
        role: 'tablist',
        // `aria-orientation` defaults to horizontal on tablists.
        'aria-orientation': orientation === 'vertical' ? 'vertical' : undefined,
        ...stateAttrs(context),
      }),
      trackNode(context, 'list'),
      ref((node: HTMLElement) => {
        listNode = node
      }),
      on<HTMLElement, 'keydown'>('keydown', (event) => {
        if (!listNode || event.altKey || event.ctrlKey || event.metaKey) return
        let target = event.target instanceof Element ? event.target : null
        let tab = target?.closest<HTMLElement>('[role="tab"]')
        if (!tab || tab.closest('[role="tablist"]') !== listNode) return

        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          let value = context._valueForNode(tab)
          if (value !== undefined && !isDisabledTab(tab)) context._activate(value)
          return
        }

        let move = getRovingMove(event.key, orientation, getDirection(listNode))
        if (!move) return
        event.preventDefault()

        let items = getListTabs(listNode)
        let index = items.indexOf(tab)
        let targetIndex = getRovingTargetIndex(items.length, index, move, {
          loop: loopFocus,
          isEnabled: (i) => !isDisabledTab(items[i]),
        })
        if (targetIndex === -1 || targetIndex === index) return

        let next = items[targetIndex]
        next.focus()
        if (activateOnFocus) {
          let value = context._valueForNode(next)
          if (value !== undefined) context._activate(value)
        }
      }),
    ]
  }
})

const tabMixin: MixinFactory<HTMLElement, [options: TabsTabOptions], ElementProps> = createMixin<
  HTMLElement,
  [options: TabsTabOptions],
  ElementProps
>((handle, hostType) => {
  let context = getTabsContext(handle)
  let tabNode: HTMLElement | null = null
  let entry: RegisteredItem = { disabled: false, getNode: () => tabNode }
  let registeredValue: string | null = null
  let isButton = hostType === 'button'

  handle.signal.addEventListener('abort', () => {
    if (registeredValue !== null) context._unregister('tab', registeredValue, entry)
  })

  return (options, props) => {
    let { value } = options
    let disabled = options.disabled === true || props.disabled === true

    if (registeredValue !== null && registeredValue !== value) {
      context._unregister('tab', registeredValue, entry)
    }
    entry.disabled = disabled
    context._register('tab', value, entry)
    registeredValue = value

    let active = context.isActive(value)

    return [
      attrs({
        role: 'tab',
        id: context.getTabId(value),
        'aria-controls': context.getPanelId(value),
        'aria-selected': active ? 'true' : 'false',
        // Native buttons use `disabled`; other hosts can't, so they get `aria-disabled`.
        disabled: isButton && disabled ? true : undefined,
        'aria-disabled': !isButton && disabled ? 'true' : undefined,
        tabIndex: !disabled && context._isTabbable(value) ? 0 : -1,
        type: isButton ? 'button' : undefined,
        'data-active': active ? '' : undefined,
        'data-disabled': disabled ? '' : undefined,
        ...stateAttrs(context),
      }),
      ref((node: HTMLElement, signal) => {
        tabNode = node
        signal.addEventListener('abort', () => {
          if (tabNode === node) tabNode = null
        })
      }),
      on('click', () => {
        if (!disabled) context._activate(value)
      }),
    ]
  }
})

const panelMixin: MixinFactory<HTMLElement, [options: TabsPanelOptions], ElementProps> =
  createMixin<HTMLElement, [options: TabsPanelOptions], ElementProps>((handle) => {
    let context = getTabsContext(handle)
    let entry: RegisteredItem = { disabled: false, getNode: () => null }
    let registeredValue: string | null = null

    handle.signal.addEventListener('abort', () => {
      if (registeredValue !== null) context._unregister('panel', registeredValue, entry)
    })

    return (options) => {
      let { value } = options
      if (registeredValue !== null && registeredValue !== value) {
        context._unregister('panel', registeredValue, entry)
      }
      context._register('panel', value, entry)
      registeredValue = value

      let active = context.isActive(value)

      return attrs({
        role: 'tabpanel',
        id: context.getPanelId(value),
        'aria-labelledby': context.getTabId(value),
        hidden: active ? undefined : true,
        inert: active ? undefined : true,
        tabIndex: active ? 0 : -1,
        'data-hidden': active ? undefined : '',
        'data-index': String(context._panelIndex(value)),
        ...stateAttrs(context),
      })
    }
  })

const INDICATOR_VARS = [
  '--active-tab-left',
  '--active-tab-right',
  '--active-tab-top',
  '--active-tab-bottom',
  '--active-tab-width',
  '--active-tab-height',
] as const

const indicatorMixin: MixinFactory<HTMLElement, [], ElementProps> = createMixin<
  HTMLElement,
  [],
  ElementProps
>((handle) => {
  let context = getTabsContext(handle)
  let node: HTMLElement | null = null
  let visible = false
  let lastMeasurement = ''
  let observer: ResizeObserver | null = null
  // `handle.signal` is only readable during setup and render, so keep a reference for callbacks.
  let signal = handle.signal

  signal.addEventListener('abort', () => {
    observer?.disconnect()
    observer = null
  })

  function measure() {
    if (!node || signal.aborted) return
    let list = context._listNode() ?? node.closest<HTMLElement>('[role="tablist"]')
    let tab = context._activeTabNode()
    let nextVisible = list !== null && tab !== null

    if (list && tab) {
      if (!observer && typeof ResizeObserver !== 'undefined') {
        observer = new ResizeObserver(() => measure())
      }
      if (observer) {
        observer.observe(list)
        for (let item of getListTabs(list)) observer.observe(item)
      }

      let listRect = list.getBoundingClientRect()
      let tabRect = tab.getBoundingClientRect()
      let left = tabRect.left - listRect.left - list.clientLeft + list.scrollLeft
      let top = tabRect.top - listRect.top - list.clientTop + list.scrollTop
      let width = tabRect.width
      let height = tabRect.height
      let values = [
        left,
        list.scrollWidth - left - width,
        top,
        list.scrollHeight - top - height,
        width,
        height,
      ]
      let measurement = values.join()
      if (measurement !== lastMeasurement) {
        lastMeasurement = measurement
        INDICATOR_VARS.forEach((name, i) => node!.style.setProperty(name, `${values[i]}px`))
      }
    } else if (lastMeasurement !== '') {
      lastMeasurement = ''
      for (let name of INDICATOR_VARS) node.style.removeProperty(name)
    }

    if (nextVisible !== visible) {
      visible = nextVisible
      void handle.update()
    }
  }

  return () => {
    handle.queueTask((host) => {
      node = host
      measure()
    })

    return attrs({
      role: 'presentation',
      // Hidden until the active tab has been measured on the client (and when no tab is active).
      hidden: visible ? undefined : true,
      ...stateAttrs(context),
    })
  }
})

/**
 * Provides tabs state: the active `value` (controlled or uncontrolled) and `orientation`.
 * Read it from components with `handle.context.get(tabs.Context)`.
 */
export const Context = TabsProvider

/** Groups the tabs and panels. Sets `data-orientation` and `data-activation-direction`. */
export const root = rootMixin

/** The `role="tablist"` container. Handles arrow-key, Home/End, Enter, and Space navigation. */
export const list = listMixin

/** A `role="tab"` control that activates the panel with the same `value`. */
export const tab = tabMixin

/**
 * A decorative element inside the list that tracks the active tab through the
 * `--active-tab-{left,right,top,bottom,width,height}` CSS variables.
 */
export const indicator = indicatorMixin

/** A `role="tabpanel"` region shown while the tab with the same `value` is active. */
export const panel = panelMixin

/** Listens for the bubbling `stems:tabs-change` event. */
export function onTabsChange<target extends HTMLElement>(
  handler: TabsChangeHandler<target>,
  captureBoolean?: boolean,
): ReturnType<typeof on<target, typeof TABS_CHANGE_EVENT>> {
  return on(TABS_CHANGE_EVENT, handler, captureBoolean)
}
