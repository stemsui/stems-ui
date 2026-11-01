// Adapted from @remix-run/ui 0.13.0 (packages/ui/src/accordion.tsx).
// https://github.com/remix-run/remix - Copyright (c) 2025 Shopify Inc. MIT License.

import { attrs, createMixin, on } from '@remix-run/component'
import type {
  Dispatched,
  ElementProps,
  Handle,
  MixinFactory,
  MixinHandle,
  RemixNode,
} from '@remix-run/component'

import { createCollapsiblePanelMixin } from './lib/collapsible-panel.ts'
import type { CollapsiblePanelOptions } from './lib/collapsible-panel.ts'
import { getDirection, horizontalArrowStep } from './lib/direction.ts'

const ACCORDION_CHANGE_EVENT = 'stems:accordion-change' as const

declare global {
  interface HTMLElementEventMap {
    [ACCORDION_CHANGE_EVENT]: AccordionChangeEvent
  }
}

/** Bubbling event dispatched when an accordion item opens or closes. */
export class AccordionChangeEvent extends Event {
  /** The values of every open item after the change. */
  readonly value: string[]
  /** The value of the item that was toggled. */
  readonly itemValue: string
  /** Whether the toggled item is now open. */
  readonly open: boolean

  constructor(value: string[], init: { itemValue: string; open: boolean }) {
    super(ACCORDION_CHANGE_EVENT, { bubbles: true })
    this.value = value
    this.itemValue = init.itemValue
    this.open = init.open
  }
}

export type AccordionOrientation = 'horizontal' | 'vertical'

export type AccordionPanelOptions = CollapsiblePanelOptions

export interface AccordionContextProps {
  children?: RemixNode
  /** The values of the open items (controlled). */
  value?: string[]
  /** The values of the initially open items (uncontrolled). */
  defaultValue?: string[]
  /** Called with the values of the open items when an item opens or closes. */
  onValueChange?: (value: string[], event?: Event) => void
  /**
   * Whether multiple items can be open at the same time.
   * @default false
   */
  multiple?: boolean
  /**
   * Whether the accordion ignores user interaction.
   * @default false
   */
  disabled?: boolean
  /**
   * The visual orientation. Controls whether ArrowUp/ArrowDown or ArrowLeft/ArrowRight move
   * focus between triggers.
   * @default 'vertical'
   */
  orientation?: AccordionOrientation
  /**
   * Whether arrow-key focus wraps from the last trigger to the first and back.
   * @default true
   */
  loopFocus?: boolean
  /**
   * Default `hiddenUntilFound` for every panel: closed panels use `hidden="until-found"` so
   * find-in-page can reveal and open them.
   * @default false
   */
  hiddenUntilFound?: boolean
  /**
   * Accepted for Base UI parity. Stems panels are always kept mounted (with `hidden`).
   * @default false
   */
  keepMounted?: boolean
}

export interface AccordionItemContextProps {
  children?: RemixNode
  /** Identifies the item in the accordion value. Defaults to a generated id. */
  value?: string
  /**
   * Whether the item ignores user interaction.
   * @default false
   */
  disabled?: boolean
  /** Called with the item's next open state when it opens or closes. */
  onOpenChange?: (open: boolean, event?: Event) => void
}

type FocusMove = 'first' | 'last' | -1 | 1

interface RegisteredItem {
  readonly disabled: boolean
  getTriggerNode(): HTMLElement | null
}

interface AccordionContextValue {
  readonly disabled: boolean
  readonly hiddenUntilFound: boolean
  readonly loopFocus: boolean
  readonly multiple: boolean
  readonly orientation: AccordionOrientation
  isOpen(value: string): boolean
  setItemOpen(itemValue: string, open: boolean, event?: Event): void
  focusTrigger(from: HTMLElement, move: FocusMove): void
  registerItem(item: RegisteredItem): number
  registerRoot(node: HTMLElement, signal: AbortSignal): void
}

interface AccordionItemContextValue {
  readonly disabled: boolean
  readonly index: number
  readonly open: boolean
  readonly panelId: string
  readonly triggerId: string
  readonly value: string
  setOpen(open: boolean, event?: Event): void
  update(): Promise<AbortSignal>
  setTriggerId(id: string | undefined): void
  setTriggerNode(node: HTMLElement | null): void
}

function AccordionProvider(
  handle: Handle<AccordionContextProps, AccordionContextValue>,
): () => RemixNode {
  let rootNode: HTMLElement | null = null
  let registeredItems: RegisteredItem[] = []
  let uncontrolledValue = [...(handle.props.defaultValue ?? [])]

  function getValue() {
    return handle.props.value ?? uncontrolledValue
  }

  function setItemOpen(itemValue: string, open: boolean, event?: Event) {
    let current = getValue()
    if (current.includes(itemValue) === open) return

    let next = open
      ? handle.props.multiple
        ? [...current, itemValue]
        : [itemValue]
      : current.filter((value) => value !== itemValue)

    if (handle.props.value === undefined) {
      uncontrolledValue = next
      void handle.update()
    }

    handle.props.onValueChange?.(next, event)
    let target = rootNode ?? (event?.target instanceof Element ? event.target : null)
    target?.dispatchEvent(new AccordionChangeEvent(next, { itemValue, open }))
  }

  function focusTrigger(from: HTMLElement, move: FocusMove) {
    let triggers = registeredItems
      .filter((item) => !item.disabled)
      .map((item) => item.getTriggerNode())
      .filter((node): node is HTMLElement => node !== null && node.isConnected)
      .sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1))
    if (triggers.length === 0) return

    let target: number
    if (move === 'first') {
      target = 0
    } else if (move === 'last') {
      target = triggers.length - 1
    } else {
      let current = triggers.indexOf(from)
      target = current === -1 ? (move === 1 ? 0 : triggers.length - 1) : current + move
      if (target < 0) target = handle.props.loopFocus === false ? 0 : triggers.length - 1
      if (target >= triggers.length) target = handle.props.loopFocus === false ? current : 0
    }

    triggers[target]?.focus()
  }

  handle.context.set({
    get disabled() {
      return handle.props.disabled ?? false
    },
    get hiddenUntilFound() {
      return handle.props.hiddenUntilFound ?? false
    },
    get loopFocus() {
      return handle.props.loopFocus ?? true
    },
    get multiple() {
      return handle.props.multiple ?? false
    },
    get orientation() {
      return handle.props.orientation ?? 'vertical'
    },
    isOpen(value) {
      return getValue().includes(value)
    },
    setItemOpen,
    focusTrigger,
    registerItem(item) {
      let index = registeredItems.indexOf(item)
      if (index !== -1) return index
      registeredItems.push(item)
      return registeredItems.length - 1
    },
    registerRoot(node, signal) {
      rootNode = node
      signal.addEventListener('abort', () => {
        if (rootNode === node) rootNode = null
      })
    },
  })

  return () => {
    // Items register (and get their index) in render order on every provider render.
    registeredItems = []
    return handle.props.children
  }
}

function AccordionItemProvider(
  handle: Handle<AccordionItemContextProps, AccordionItemContextValue>,
): () => RemixNode {
  let accordion = handle.context.get(AccordionProvider)
  let triggerNode: HTMLElement | null = null
  let customTriggerId: string | undefined
  let value = handle.props.value ?? handle.id
  let disabled = false
  let open = false
  let index = 0

  let entry: RegisteredItem = {
    get disabled() {
      return disabled
    },
    getTriggerNode: () => triggerNode,
  }

  handle.context.set({
    get disabled() {
      return disabled
    },
    get index() {
      return index
    },
    get open() {
      return open
    },
    panelId: `${handle.id}-panel`,
    get triggerId() {
      return customTriggerId ?? `${handle.id}-trigger`
    },
    get value() {
      return value
    },
    setOpen(next, event) {
      if (next === accordion.isOpen(value)) return
      handle.props.onOpenChange?.(next, event)
      accordion.setItemOpen(value, next, event)
    },
    update() {
      return handle.update()
    },
    setTriggerId(id) {
      customTriggerId = id
    },
    setTriggerNode(node) {
      triggerNode = node
    },
  })

  return () => {
    accordion = handle.context.get(AccordionProvider)
    value = handle.props.value ?? handle.id
    disabled = accordion.disabled || handle.props.disabled === true
    open = accordion.isOpen(value)
    index = accordion.registerItem(entry)
    return handle.props.children
  }
}

function getAccordionContext(handle: MixinHandle<HTMLElement>) {
  return handle.context.get(AccordionProvider)
}

function getItemContext(handle: MixinHandle<HTMLElement>) {
  return handle.context.get(AccordionItemProvider)
}

function itemStateAttrs(item: AccordionItemContextValue): ElementProps {
  return {
    'data-open': item.open ? '' : undefined,
    'data-disabled': item.disabled ? '' : undefined,
    'data-index': String(item.index),
  }
}

const rootMixin: MixinFactory<HTMLElement, [], ElementProps> = createMixin<
  HTMLElement,
  [],
  ElementProps
>((handle) => {
  let accordion = getAccordionContext(handle)
  let signal = handle.signal

  handle.addEventListener('insert', (event) => {
    accordion.registerRoot(event.node, signal)
  })

  return () =>
    attrs({
      'data-orientation': accordion.orientation,
      'data-disabled': accordion.disabled ? '' : undefined,
    })
})

const itemMixin: MixinFactory<HTMLElement, [], ElementProps> = createMixin<
  HTMLElement,
  [],
  ElementProps
>((handle) => {
  let item = getItemContext(handle)
  return () => attrs(itemStateAttrs(item))
})

const headerMixin: MixinFactory<HTMLElement, [], ElementProps> = createMixin<
  HTMLElement,
  [],
  ElementProps
>((handle) => {
  let item = getItemContext(handle)
  return () => attrs(itemStateAttrs(item))
})

const triggerMixin: MixinFactory<HTMLElement, [], ElementProps> = createMixin<
  HTMLElement,
  [],
  ElementProps
>((handle, hostType) => {
  let accordion = getAccordionContext(handle)
  let item = getItemContext(handle)
  let isButton = hostType === 'button'

  handle.addEventListener('insert', (event) => {
    item.setTriggerNode(event.node)
  })

  handle.addEventListener('remove', () => {
    item.setTriggerNode(null)
  })

  function toggle(event: Event) {
    if (item.disabled) return
    item.setOpen(!item.open, event)
  }

  function onKeyDown(event: KeyboardEvent) {
    let node = event.currentTarget as HTMLElement
    let move: FocusMove | 0 = 0

    switch (event.key) {
      case 'Home':
        move = 'first'
        break
      case 'End':
        move = 'last'
        break
      case 'ArrowDown':
      case 'ArrowUp':
        if (accordion.orientation === 'vertical') move = event.key === 'ArrowDown' ? 1 : -1
        break
      case 'ArrowLeft':
      case 'ArrowRight':
        if (accordion.orientation === 'horizontal') {
          move = horizontalArrowStep(event.key, getDirection(node))
        }
        break
      case 'Enter':
      case ' ':
        if (!isButton) {
          event.preventDefault()
          toggle(event)
        }
        return
    }

    if (move === 0) return
    event.preventDefault()
    accordion.focusTrigger(node, move)
  }

  return (props) => {
    let disabled = item.disabled
    // Panels label themselves with the trigger id, so respect an explicit host id.
    item.setTriggerId(typeof props?.id === 'string' ? props.id : undefined)

    return [
      attrs({
        type: isButton ? 'button' : undefined,
        role: isButton ? undefined : 'button',
        tabIndex: isButton ? undefined : disabled ? -1 : 0,
        id: item.triggerId,
        'aria-controls': item.panelId,
        'aria-expanded': item.open ? 'true' : 'false',
        'aria-disabled': !isButton && disabled ? 'true' : undefined,
        disabled: isButton && disabled ? true : undefined,
        'data-panel-open': item.open ? '' : undefined,
        'data-disabled': disabled ? '' : undefined,
        'data-index': String(item.index),
      }),
      on<HTMLElement, 'click'>('click', toggle),
      on<HTMLElement, 'keydown'>('keydown', onKeyDown),
    ]
  }
})

const panelMixin = createCollapsiblePanelMixin({
  cssVarPrefix: 'accordion',
  getState(handle) {
    let accordion = getAccordionContext(handle)
    let item = getItemContext(handle)
    return {
      get open() {
        return item.open
      },
      get panelId() {
        return item.panelId
      },
      get hiddenUntilFound() {
        return accordion.hiddenUntilFound
      },
      revealFromMatch(event) {
        item.setOpen(true, event)
      },
      update: () => item.update(),
      attrs() {
        return {
          role: 'region',
          'aria-labelledby': item.triggerId,
          'data-orientation': accordion.orientation,
          'data-disabled': item.disabled ? '' : undefined,
          'data-index': String(item.index),
        }
      },
    }
  },
})

/**
 * Provider that owns the open items. Props: `value` / `defaultValue` / `onValueChange`
 * (`string[]`), `multiple`, `disabled`, `orientation`, `loopFocus`, `hiddenUntilFound`.
 */
export const Context: (
  handle: Handle<AccordionContextProps, AccordionContextValue>,
) => () => RemixNode = AccordionProvider

/** Provider for one item. Props: `value`, `disabled`, `onOpenChange`. */
export const ItemContext: (
  handle: Handle<AccordionItemContextProps, AccordionItemContextValue>,
) => () => RemixNode = AccordionItemProvider

/** Root element: `data-orientation`, `data-disabled`; target of `stems:accordion-change`. */
export const root = rootMixin

/** Item element: `data-open`, `data-disabled`, `data-index`. */
export const item = itemMixin

/** Heading element around the trigger (app picks `<h3>` etc.): `data-open`, `data-disabled`, `data-index`. */
export const header = headerMixin

/**
 * Trigger button: `id`, `aria-expanded`, `aria-controls`, native `disabled`, `data-panel-open`,
 * `data-disabled`, `data-index`, arrow-key / Home / End focus movement.
 */
export const trigger = triggerMixin

/**
 * Panel: `role="region"`, `aria-labelledby`, `hidden` while closed (or `hidden="until-found"`),
 * `data-open` / `data-closed`, `data-orientation`, `data-disabled`, `data-index`,
 * `data-starting-style` / `data-ending-style`, and `--accordion-panel-height` / `-width`.
 */
export const panel: MixinFactory<HTMLElement, [options?: AccordionPanelOptions], ElementProps> =
  panelMixin

/** Listens for the bubbling `stems:accordion-change` event. */
export function onAccordionChange<target extends HTMLElement>(
  handler: (
    event: Dispatched<AccordionChangeEvent, target>,
    signal: AbortSignal,
  ) => void | Promise<void>,
  captureBoolean?: boolean,
): ReturnType<typeof on<target, typeof ACCORDION_CHANGE_EVENT>> {
  return on(ACCORDION_CHANGE_EVENT, handler, captureBoolean)
}
