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

export type { CollapsiblePanelOptions } from './lib/collapsible-panel.ts'

const COLLAPSIBLE_CHANGE_EVENT = 'stems:collapsible-change' as const

declare global {
  interface HTMLElementEventMap {
    [COLLAPSIBLE_CHANGE_EVENT]: CollapsibleChangeEvent
  }
}

/** Bubbling event dispatched when a collapsible opens or closes. */
export class CollapsibleChangeEvent extends Event {
  readonly open: boolean

  constructor(open: boolean) {
    super(COLLAPSIBLE_CHANGE_EVENT, { bubbles: true })
    this.open = open
  }
}

export interface CollapsibleContextProps {
  children?: RemixNode
  /** Whether the panel is open (controlled). */
  open?: boolean
  /**
   * Whether the panel is initially open (uncontrolled).
   * @default false
   */
  defaultOpen?: boolean
  /** Called with the next open state when the trigger is pressed or the panel is revealed. */
  onOpenChange?: (open: boolean, event?: Event) => void
  /**
   * Whether the trigger ignores user interaction.
   * @default false
   */
  disabled?: boolean
}

interface CollapsibleContextValue {
  readonly open: boolean
  readonly disabled: boolean
  readonly panelId: string
  setOpen(open: boolean, event?: Event): void
  update(): Promise<AbortSignal>
  registerRoot(node: HTMLElement, signal: AbortSignal): void
}

function CollapsibleProvider(
  handle: Handle<CollapsibleContextProps, CollapsibleContextValue>,
): () => RemixNode {
  let uncontrolledOpen = handle.props.defaultOpen ?? false
  let rootNode: HTMLElement | null = null

  function isOpen() {
    return handle.props.open ?? uncontrolledOpen
  }

  handle.context.set({
    get open() {
      return isOpen()
    },
    get disabled() {
      return handle.props.disabled ?? false
    },
    panelId: `${handle.id}-panel`,
    setOpen(open, event) {
      if (open === isOpen()) return

      if (handle.props.open === undefined) {
        uncontrolledOpen = open
        void handle.update()
      }

      handle.props.onOpenChange?.(open, event)
      let target = rootNode ?? (event?.target instanceof Element ? event.target : null)
      target?.dispatchEvent(new CollapsibleChangeEvent(open))
    },
    update() {
      return handle.update()
    },
    registerRoot(node, signal) {
      rootNode = node
      signal.addEventListener('abort', () => {
        if (rootNode === node) rootNode = null
      })
    },
  })

  return () => handle.props.children
}

function getContext(handle: MixinHandle<HTMLElement>) {
  return handle.context.get(CollapsibleProvider)
}

const rootMixin: MixinFactory<HTMLElement, [], ElementProps> = createMixin<
  HTMLElement,
  [],
  ElementProps
>((handle) => {
  let context = getContext(handle)
  let signal = handle.signal

  handle.addEventListener('insert', (event) => {
    context.registerRoot(event.node, signal)
  })

  return () =>
    attrs({
      'data-open': context.open ? '' : undefined,
      'data-closed': context.open ? undefined : '',
      'data-disabled': context.disabled ? '' : undefined,
    })
})

const triggerMixin: MixinFactory<HTMLElement, [], ElementProps> = createMixin<
  HTMLElement,
  [],
  ElementProps
>((handle, hostType) => {
  let context = getContext(handle)
  let isButton = hostType === 'button'

  function toggle(event: Event) {
    if (context.disabled) return
    context.setOpen(!context.open, event)
  }

  return () => {
    let open = context.open
    let disabled = context.disabled

    return [
      attrs({
        type: isButton ? 'button' : undefined,
        role: isButton ? undefined : 'button',
        tabIndex: isButton ? undefined : disabled ? -1 : 0,
        'aria-controls': context.panelId,
        'aria-expanded': open ? 'true' : 'false',
        'aria-disabled': !isButton && disabled ? 'true' : undefined,
        disabled: isButton && disabled ? true : undefined,
        'data-panel-open': open ? '' : undefined,
        'data-disabled': disabled ? '' : undefined,
      }),
      on<HTMLElement, 'click'>('click', toggle),
      !isButton &&
        on<HTMLElement, 'keydown'>('keydown', (event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return
          event.preventDefault()
          toggle(event)
        }),
    ]
  }
})

const panelMixin = createCollapsiblePanelMixin({
  cssVarPrefix: 'collapsible',
  getState(handle) {
    let context = getContext(handle)
    return {
      get open() {
        return context.open
      },
      get panelId() {
        return context.panelId
      },
      hiddenUntilFound: false,
      revealFromMatch(event) {
        context.setOpen(true, event)
      },
      update: () => context.update(),
    }
  },
})

/**
 * Provider that owns the open state. Props: `open` / `defaultOpen` / `onOpenChange`, `disabled`.
 */
export const Context: (
  handle: Handle<CollapsibleContextProps, CollapsibleContextValue>,
) => () => RemixNode = CollapsibleProvider

/**
 * Optional root element: `data-open` / `data-closed` / `data-disabled`, and the target of
 * `stems:collapsible-change` events.
 */
export const root = rootMixin

/**
 * The button that toggles the panel: `aria-expanded`, `aria-controls`, `data-panel-open`,
 * `data-disabled`, native `disabled`. Non-button hosts get `role="button"`, `tabIndex`, and
 * Enter/Space activation.
 */
export const trigger = triggerMixin

/**
 * The panel: `id`, `hidden` while closed (or `hidden="until-found"`), `data-open` /
 * `data-closed`, `data-starting-style` / `data-ending-style`, and the
 * `--collapsible-panel-height` / `--collapsible-panel-width` CSS variables.
 */
export const panel: MixinFactory<HTMLElement, [options?: CollapsiblePanelOptions], ElementProps> =
  panelMixin

/** Listens for the bubbling `stems:collapsible-change` event. */
export function onCollapsibleChange<target extends HTMLElement>(
  handler: (
    event: Dispatched<CollapsibleChangeEvent, target>,
    signal: AbortSignal,
  ) => void | Promise<void>,
  captureBoolean?: boolean,
): ReturnType<typeof on<target, typeof COLLAPSIBLE_CHANGE_EVENT>> {
  return on(COLLAPSIBLE_CHANGE_EVENT, handler, captureBoolean)
}
