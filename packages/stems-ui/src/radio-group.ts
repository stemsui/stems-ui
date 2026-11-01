import { attrs, createMixin, on, ref } from '@remix-run/component'
import type {
  Dispatched,
  ElementProps,
  Handle,
  MixinFactory,
  MixinHandle,
  RemixNode,
} from '@remix-run/component'

import { createFieldChange, flag, focusStaysInside } from './lib/checkable.ts'
import {
  connectFieldControl,
  type FieldContextValue,
  type FieldControlRenderResult,
} from './lib/field-control.ts'
import { getDirection } from './lib/direction.ts'
import { getRovingMove, getRovingTargetIndex } from './lib/roving-focus.ts'

const RADIO_GROUP_CHANGE_EVENT = 'stems:radio-group-change' as const

declare global {
  interface HTMLElementEventMap {
    [RADIO_GROUP_CHANGE_EVENT]: RadioGroupChangeEvent
  }
}

/**
 * Bubbling event dispatched (`stems:radio-group-change`) from the radio the user selected, after
 * the group value changes.
 */
export class RadioGroupChangeEvent extends Event {
  /** The value of the selected radio. */
  readonly value: string

  constructor(value: string) {
    super(RADIO_GROUP_CHANGE_EVENT, { bubbles: true })
    this.value = value
  }
}

type RadioGroupChangeHandler<target extends HTMLElement> = (
  event: Dispatched<RadioGroupChangeEvent, target>,
  signal: AbortSignal,
) => void | Promise<void>

export type RadioGroupOrientation = 'horizontal' | 'vertical'

/** Props for `<radioGroup.Context>`. They match Base UI's `RadioGroup` props. */
export interface RadioGroupContextProps {
  children?: RemixNode
  /** The selected radio's value. `null` selects nothing. Controlled when not `undefined`. */
  value?: string | null
  /** The initially selected radio's value (uncontrolled). */
  defaultValue?: string | null
  /** Called with the selected radio's value and the DOM event that caused the change. */
  onValueChange?: (value: string, event: Event) => void
  /**
   * Identifies the field when a form is submitted. Shared by every radio's hidden input. An
   * enclosing `field.Context`'s `name` wins.
   */
  name?: string
  /** The id of the form that owns the hidden inputs. */
  form?: string
  /**
   * Whether every radio ignores user interaction. An enclosing `<field.Context disabled>` or
   * `<fieldset.Context disabled>` also disables it.
   * @default false
   */
  disabled?: boolean
  /**
   * Whether the user is unable to select a different radio.
   * @default false
   */
  readOnly?: boolean
  /**
   * Whether a radio must be selected before the form can be submitted.
   * @default false
   */
  required?: boolean
  /**
   * Sets `aria-orientation` on the group. Arrow keys on both axes move the selection either way
   * (WAI-ARIA APG radio group).
   */
  orientation?: RadioGroupOrientation
}

/** State provided by `<radioGroup.Context>`, readable with `handle.context.get(...)`. */
export interface RadioGroupContextValue {
  /** The selected radio's value, or `null`. */
  readonly value: string | null
  readonly name: string | undefined
  readonly form: string | undefined
  readonly disabled: boolean
  readonly readOnly: boolean
  readonly required: boolean
  readonly orientation: RadioGroupOrientation | undefined
  /** @internal */
  _select(value: string, event: Event, origin: Element | undefined): void
  /** @internal */
  _register(entry: RadioGroupItem): void
  /** @internal */
  _unregister(entry: RadioGroupItem): void
  /** @internal Whether this radio is the group's single tab stop. */
  _isTabbable(entry: RadioGroupItem): boolean
  /** @internal Moves focus (and the selection) for an arrow key. Returns whether it handled it. */
  _navigate(entry: RadioGroupItem, event: KeyboardEvent): boolean
  /** @internal The field the group is the control of, if any. */
  readonly _field: FieldContextValue | undefined
  /** @internal The field wiring from the group's last render. */
  _fieldState(): FieldControlRenderResult
  /** @internal A radio of the group received focus. */
  _fieldFocus(): void
  /** @internal A radio of the group lost focus. */
  _fieldBlur(event: FocusEvent): void
}

/** @internal */
export interface RadioGroupItem {
  readonly value: string
  readonly disabled: boolean
  getNode(): HTMLElement | undefined
  /** Selects the radio as if it had been clicked. */
  select(event: Event): void
  /** Writes the radio's checked state to its hidden input. */
  syncInput(): void
  /** The hidden `<input type="radio">`. */
  getInput(): HTMLInputElement | undefined
}

function RadioGroupProvider(
  handle: Handle<RadioGroupContextProps, RadioGroupContextValue>,
): () => RemixNode {
  let uncontrolledValue: string | null = handle.props.defaultValue ?? null
  let items = new Set<RadioGroupItem>()
  // Radios register while they render, so during the first render a selected radio may not have
  // registered yet. Until the first commit, only the selected radio is tabbable; if none matched,
  // re-render once to fall back to the first enabled radio.
  let settled = false
  let needsFallback = false
  let root: HTMLElement | undefined
  let focusWithin = false
  // Inside a <field.Context>, the group is the field's control. The selected radio's hidden
  // input (or the first one) carries native validity: with `required` and nothing selected,
  // every radio in the named group reports `valueMissing`.
  let fieldChange = createFieldChange<string | null>()
  let fieldControl = connectFieldControl(handle, {
    getValue: () => fieldChange.read(getValue),
    getValidityElement: () => {
      let list = getItems()
      let selected = list.find((item) => item.value === getValue())
      return (selected ?? list[0])?.getInput()
    },
    getFocusElement: () => {
      let list = getItems()
      let selected = list.find((item) => item.value === getValue() && !item.disabled)
      return (selected ?? list.find((item) => !item.disabled) ?? list[0])?.getNode()
    },
  })
  // Set by every render, before the radios inside render.
  let fieldState: FieldControlRenderResult | undefined

  function isControlled() {
    return handle.props.value !== undefined
  }

  function getValue(): string | null {
    return isControlled() ? (handle.props.value ?? null) : uncontrolledValue
  }

  /** Radios in document order once mounted (registration order before that, e.g. on the server). */
  function getItems(): RadioGroupItem[] {
    let list = [...items]
    if (list.every((item) => item.getNode()?.isConnected)) {
      list.sort((a, b) => {
        let position = a.getNode()!.compareDocumentPosition(b.getNode()!)
        return position & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
      })
    }
    return list
  }

  let context: RadioGroupContextValue = {
    get value() {
      return getValue()
    },
    get name() {
      return fieldState ? fieldState.name : handle.props.name
    },
    get form() {
      return handle.props.form
    },
    get disabled() {
      return fieldState?.disabled ?? handle.props.disabled === true
    },
    get readOnly() {
      return handle.props.readOnly === true
    },
    get required() {
      return handle.props.required === true
    },
    get orientation() {
      return handle.props.orientation
    },
    _select(value, event, origin) {
      if (getValue() === value) return
      if (!isControlled()) {
        uncontrolledValue = value
        void handle.update()
      }
      fieldChange.report(fieldControl, value, event)
      handle.props.onValueChange?.(value, event)
      origin?.dispatchEvent(new RadioGroupChangeEvent(value))
      // Hidden radios that share a `name` uncheck each other natively. If a controlled owner
      // ignored the change, put the inputs back (a re-render that follows wins either way).
      queueMicrotask(() => {
        for (let item of items) item.syncInput()
      })
    },
    _register(entry) {
      items.add(entry)
    },
    _unregister(entry) {
      items.delete(entry)
    },
    _isTabbable(entry) {
      if (entry.disabled) return false
      let list = getItems()
      let value = getValue()
      let selected = list.find((item) => item.value === value && !item.disabled)
      if (selected) return selected === entry
      if (value !== null && !settled) {
        needsFallback = true
        return false
      }
      return list.find((item) => !item.disabled) === entry
    },
    _navigate(entry, event) {
      if (event.altKey || event.ctrlKey || event.metaKey) return false
      let node = entry.getNode()
      let move = getRovingMove(event.key, 'both', getDirection(node))
      // Radio groups move with the arrow keys only.
      if (move !== 'next' && move !== 'previous') return false

      let list = getItems()
      let index = list.indexOf(entry)
      let target = getRovingTargetIndex(list.length, index, move, {
        loop: true,
        isEnabled: (i) => !list[i]!.disabled,
      })
      event.preventDefault()
      if (target === -1 || target === index) return true

      let next = list[target]!
      next.getNode()?.focus()
      if (!context.readOnly) next.select(event)
      return true
    },
    _field: fieldControl.field,
    _fieldState() {
      return fieldState!
    },
    _fieldFocus() {
      if (focusWithin) return
      focusWithin = true
      fieldControl.focus()
    },
    _fieldBlur(event) {
      let nodes = [root, ...[...items].flatMap((item) => [item.getNode(), item.getInput()])]
      // Moving between the group's radios is not a blur of the field.
      if (focusStaysInside(event.relatedTarget, nodes)) return
      focusWithin = false
      fieldControl.blur()
    },
  }

  internalsByContext.set(context, {
    setRoot(node) {
      root = node
    },
  })

  handle.context.set(context)

  return () => {
    fieldState = fieldControl.render({
      value: getValue(),
      disabled: handle.props.disabled === true,
      name: handle.props.name,
    })
    if (!settled) {
      handle.queueTask(() => {
        settled = true
        if (needsFallback) void handle.update()
      })
    }
    return handle.props.children
  }
}

const internalsByContext = new WeakMap<
  RadioGroupContextValue,
  { setRoot(node: HTMLElement | undefined): void }
>()

/** @internal Reads the enclosing radio group, if any. */
export function getRadioGroup(
  handle: Handle<any, any> | MixinHandle<any, any>,
): RadioGroupContextValue | undefined {
  return handle.context.get(RadioGroupProvider) as RadioGroupContextValue | undefined
}

const rootMixin: MixinFactory<HTMLElement, [], ElementProps> = createMixin<
  HTMLElement,
  [],
  ElementProps
>((handle) => {
  let context = getRadioGroup(handle)
  if (!context) {
    throw new Error('radioGroup.root() must be rendered inside <radioGroup.Context>')
  }
  let group = context
  let internals = internalsByContext.get(group)!

  return (props) => {
    let f = group._fieldState()
    let hasName = props['aria-label'] !== undefined || props['aria-labelledby'] !== undefined
    return [
      attrs({
        role: 'radiogroup',
        // Inside a field, the group is the field's control: a field label names it and the
        // field's descriptions and errors describe it.
        id: f.inField ? f.id : undefined,
        'aria-labelledby': hasName ? undefined : f.labelId,
        'aria-describedby': f.describedBy,
        'aria-invalid': f.invalid ? 'true' : undefined,
        'aria-orientation': group.orientation,
        'aria-disabled': group.disabled ? 'true' : undefined,
        'aria-readonly': group.readOnly ? 'true' : undefined,
        'aria-required': group.required ? 'true' : undefined,
        ...f.dataAttrs,
        'data-disabled': flag(group.disabled),
      }),
      ref((node: HTMLElement, signal) => {
        internals.setRoot(node)
        signal.addEventListener('abort', () => internals.setRoot(undefined))
      }),
    ]
  }
})

/**
 * Provider that owns the selected value. Radios (`stems-ui/radio`) rendered inside it read and
 * update it, and form a single tab stop navigated with the arrow keys. Inside a
 * `<field.Context>`, the group is the field's control; wrap each radio in a
 * `<field.ItemContext>` to give it its own `field.label()`.
 */
export const Context = RadioGroupProvider

/**
 * The `role="radiogroup"` element around the radios. Sets `data-disabled`, and inside a field
 * the field's state attributes, `aria-labelledby` (a field label), `aria-describedby` and
 * `aria-invalid`.
 */
export const root = rootMixin

/** Listens for the bubbling `stems:radio-group-change` event. */
export function onRadioGroupChange<target extends HTMLElement>(
  handler: RadioGroupChangeHandler<target>,
  captureBoolean?: boolean,
): ReturnType<typeof on<target, typeof RADIO_GROUP_CHANGE_EVENT>> {
  return on(RADIO_GROUP_CHANGE_EVENT, handler, captureBoolean)
}
