import { attrs, createMixin, on } from '@remix-run/component'
import type {
  Dispatched,
  ElementProps,
  Handle,
  MixinFactory,
  MixinHandle,
  RemixNode,
} from '@remix-run/component'

import { Context as FieldsetContext, type FieldsetContextValue } from './fieldset.ts'
import { flag } from './lib/checkable.ts'
import { getDirection } from './lib/direction.ts'
import { getRovingMove, getRovingTargetIndex } from './lib/roving-focus.ts'

const TOGGLE_BUTTON_GROUP_CHANGE_EVENT = 'stems:toggle-button-group-change' as const

declare global {
  interface HTMLElementEventMap {
    [TOGGLE_BUTTON_GROUP_CHANGE_EVENT]: ToggleButtonGroupChangeEvent
  }
}

/**
 * Bubbling event dispatched (`stems:toggle-button-group-change`) from the toggle button the user
 * pressed or released, after the group value changes.
 */
export class ToggleButtonGroupChangeEvent extends Event {
  /** The values of the pressed toggle buttons. */
  readonly value: readonly string[]

  constructor(value: readonly string[]) {
    super(TOGGLE_BUTTON_GROUP_CHANGE_EVENT, { bubbles: true })
    this.value = value
  }
}

type ToggleButtonGroupChangeHandler<target extends HTMLElement> = (
  event: Dispatched<ToggleButtonGroupChangeEvent, target>,
  signal: AbortSignal,
) => void | Promise<void>

export type ToggleButtonGroupOrientation = 'horizontal' | 'vertical'

/** Props for `<toggleButtonGroup.Context>`. They match Base UI's `ToggleGroup` props. */
export interface ToggleButtonGroupContextProps {
  children?: RemixNode
  /** Values of the pressed toggle buttons. Controlled when not `undefined`. */
  value?: readonly string[]
  /** Values of the initially pressed toggle buttons (uncontrolled). */
  defaultValue?: readonly string[]
  /** Called with the next group value and the DOM event that caused the change. */
  onValueChange?: (value: string[], event: Event) => void
  /**
   * Whether several buttons can be pressed at once. When `false`, pressing a button releases the
   * others.
   * @default false
   */
  multiple?: boolean
  /**
   * Whether every toggle button in the group ignores user interaction. An enclosing
   * `<fieldset.Context disabled>` also disables it.
   * @default false
   */
  disabled?: boolean
  /**
   * Which arrow keys move focus: Left/Right (mirrored in RTL) or Up/Down.
   * @default 'horizontal'
   */
  orientation?: ToggleButtonGroupOrientation
  /**
   * Whether arrow-key focus wraps from the last button to the first (and back).
   * @default true
   */
  loopFocus?: boolean
}

/** State provided by `<toggleButtonGroup.Context>`, readable with `handle.context.get(...)`. */
export interface ToggleButtonGroupContextValue {
  readonly value: readonly string[]
  readonly multiple: boolean
  readonly disabled: boolean
  readonly orientation: ToggleButtonGroupOrientation
  readonly loopFocus: boolean
  /** @internal */
  _isPressed(value: string): boolean
  /** @internal */
  _setPressed(value: string, pressed: boolean, event: Event, origin: Element | undefined): void
  /** @internal */
  _register(entry: ToggleButtonGroupItem): void
  /** @internal */
  _unregister(entry: ToggleButtonGroupItem): void
  /** @internal Whether this button is the group's single tab stop. */
  _isTabbable(entry: ToggleButtonGroupItem): boolean
  /** @internal Makes a focused button the tab stop. */
  _setActive(entry: ToggleButtonGroupItem): void
  /** @internal Moves focus for an arrow, Home, or End key. Returns whether it handled it. */
  _navigate(entry: ToggleButtonGroupItem, event: KeyboardEvent): boolean
}

/** @internal */
export interface ToggleButtonGroupItem {
  disabled: boolean
  getNode(): HTMLElement | undefined
}

function ToggleButtonGroupProvider(
  handle: Handle<ToggleButtonGroupContextProps, ToggleButtonGroupContextValue>,
): () => RemixNode {
  let uncontrolledValue: readonly string[] = handle.props.defaultValue ?? []
  let items = new Set<ToggleButtonGroupItem>()
  let active: ToggleButtonGroupItem | undefined
  // A toggle button group is not a form control (no Field integration, like Base UI), but it
  // follows an enclosing fieldset's `disabled`.
  let fieldset = handle.context.get(FieldsetContext) as FieldsetContextValue | undefined

  function isControlled() {
    return handle.props.value !== undefined
  }

  function getValue(): readonly string[] {
    return isControlled() ? (handle.props.value ?? []) : uncontrolledValue
  }

  /** Buttons in document order once mounted (registration order before that). */
  function getItems(): ToggleButtonGroupItem[] {
    let list = [...items]
    if (list.every((item) => item.getNode()?.isConnected)) {
      list.sort((a, b) => {
        let position = a.getNode()!.compareDocumentPosition(b.getNode()!)
        return position & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
      })
    }
    return list
  }

  let context: ToggleButtonGroupContextValue = {
    get value() {
      return getValue()
    },
    get multiple() {
      return handle.props.multiple === true
    },
    get disabled() {
      return handle.props.disabled === true || fieldset?.disabled === true
    },
    get orientation() {
      return handle.props.orientation ?? 'horizontal'
    },
    get loopFocus() {
      return handle.props.loopFocus ?? true
    },
    _isPressed(value) {
      return getValue().includes(value)
    },
    _setPressed(value, pressed, event, origin) {
      let current = getValue()
      if (current.includes(value) === pressed) return
      let next: string[]
      if (pressed) next = context.multiple ? [...current, value] : [value]
      else next = current.filter((item) => item !== value)

      if (!isControlled()) {
        uncontrolledValue = next
        void handle.update()
      }
      handle.props.onValueChange?.(next, event)
      origin?.dispatchEvent(new ToggleButtonGroupChangeEvent(next))
    },
    _register(entry) {
      items.add(entry)
    },
    _unregister(entry) {
      items.delete(entry)
      if (active === entry) active = undefined
    },
    _isTabbable(entry) {
      if (entry.disabled) return false
      if (active && items.has(active) && !active.disabled) return active === entry
      return getItems().find((item) => !item.disabled) === entry
    },
    _setActive(entry) {
      if (active === entry) return
      active = entry
      void handle.update()
    },
    _navigate(entry, event) {
      if (event.altKey || event.ctrlKey || event.metaKey) return false
      let move = getRovingMove(event.key, context.orientation, getDirection(entry.getNode()))
      if (!move) return false
      event.preventDefault()

      let list = getItems()
      let index = list.indexOf(entry)
      let target = getRovingTargetIndex(list.length, index, move, {
        loop: context.loopFocus,
        isEnabled: (i) => !list[i]!.disabled,
      })
      if (target !== -1 && target !== index) list[target]!.getNode()?.focus()
      return true
    },
  }

  handle.context.set(context)

  return () => handle.props.children
}

/** @internal Reads the enclosing toggle button group, if any. */
export function getToggleButtonGroup(
  handle: Handle<any, any> | MixinHandle<any, any>,
): ToggleButtonGroupContextValue | undefined {
  return handle.context.get(ToggleButtonGroupProvider) as ToggleButtonGroupContextValue | undefined
}

const rootMixin: MixinFactory<HTMLElement, [], ElementProps> = createMixin<
  HTMLElement,
  [],
  ElementProps
>((handle) => {
  let context = getToggleButtonGroup(handle)
  if (!context) {
    throw new Error('toggleButtonGroup.root() must be rendered inside <toggleButtonGroup.Context>')
  }
  let group = context

  return () =>
    attrs({
      role: 'group',
      'data-orientation': group.orientation,
      'data-disabled': flag(group.disabled),
      'data-multiple': flag(group.multiple),
    })
})

/**
 * Provider that owns the pressed values. Toggle buttons (`stems-ui/toggle-button`) rendered
 * inside it read and update it, identified by their `value`, and form a single tab stop.
 */
export const Context = ToggleButtonGroupProvider

/**
 * The `role="group"` element around the toggle buttons. Sets `data-orientation`,
 * `data-disabled`, and `data-multiple`.
 */
export const root = rootMixin

/** Listens for the bubbling `stems:toggle-button-group-change` event. */
export function onToggleButtonGroupChange<target extends HTMLElement>(
  handler: ToggleButtonGroupChangeHandler<target>,
  captureBoolean?: boolean,
): ReturnType<typeof on<target, typeof TOGGLE_BUTTON_GROUP_CHANGE_EVENT>> {
  return on(TOGGLE_BUTTON_GROUP_CHANGE_EVENT, handler, captureBoolean)
}
