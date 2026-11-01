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

const CHECKBOX_GROUP_CHANGE_EVENT = 'stems:checkbox-group-change' as const

declare global {
  interface HTMLElementEventMap {
    [CHECKBOX_GROUP_CHANGE_EVENT]: CheckboxGroupChangeEvent
  }
}

/**
 * Bubbling event dispatched (`stems:checkbox-group-change`) from the checkbox the user ticked or
 * unticked, after the group value changes.
 */
export class CheckboxGroupChangeEvent extends Event {
  /** The next group value: the values of the ticked checkboxes. */
  readonly value: readonly string[]

  constructor(value: readonly string[]) {
    super(CHECKBOX_GROUP_CHANGE_EVENT, { bubbles: true })
    this.value = value
  }
}

type CheckboxGroupChangeHandler<target extends HTMLElement> = (
  event: Dispatched<CheckboxGroupChangeEvent, target>,
  signal: AbortSignal,
) => void | Promise<void>

/** Props for `<checkboxGroup.Context>`. They match Base UI's `CheckboxGroup` props. */
export interface CheckboxGroupContextProps {
  children?: RemixNode
  /** Values of the ticked checkboxes. Controlled when not `undefined`. */
  value?: readonly string[]
  /** Values of the initially ticked checkboxes (uncontrolled). */
  defaultValue?: readonly string[]
  /** Called with the next group value and the DOM event that caused the change. */
  onValueChange?: (value: string[], event: Event) => void
  /** Values of every checkbox in the group. Required for a parent ("select all") checkbox. */
  allValues?: readonly string[]
  /**
   * Whether every checkbox in the group ignores user interaction. An enclosing
   * `<field.Context disabled>` or `<fieldset.Context disabled>` also disables it.
   * @default false
   */
  disabled?: boolean
}

/** State provided by `<checkboxGroup.Context>`, readable with `handle.context.get(...)`. */
export interface CheckboxGroupContextValue {
  readonly value: readonly string[]
  readonly allValues: readonly string[] | undefined
  readonly disabled: boolean
  /** @internal */
  _isChecked(value: string): boolean
  /** @internal */
  _setItem(value: string, checked: boolean, event: Event, origin: Element | undefined): void
  /** @internal */
  _parentState(): { checked: boolean; indeterminate: boolean }
  /** @internal */
  _toggleParent(event: Event, origin: Element | undefined): void
  /** @internal */
  _register(value: string, entry: CheckboxGroupItem): void
  /** @internal */
  _unregister(value: string, entry: CheckboxGroupItem): void
  /** @internal Default id for a child checkbox root, referenced by the parent's `aria-controls`. */
  _itemId(value: string): string
  /** @internal */
  _controls(): string | undefined
  /** @internal */
  _setRoot(node: HTMLElement | undefined): void
  /** @internal The field the group is the control of, if any. */
  readonly _field: FieldContextValue | undefined
  /** @internal The field wiring from the group's last render. */
  _fieldState(): FieldControlRenderResult
  /** @internal Every checkbox of the group (parent included), for focus tracking. */
  _addMember(entry: CheckboxGroupItem, signal: AbortSignal): void
  /** @internal A checkbox of the group received focus. */
  _fieldFocus(): void
  /** @internal A checkbox of the group lost focus. */
  _fieldBlur(event: FocusEvent): void
}

/** @internal */
export interface CheckboxGroupItem {
  disabled: boolean
  getNode(): HTMLElement | undefined
  /** The hidden `<input type="checkbox">`. */
  getInput(): HTMLInputElement | undefined
}

type ParentStatus = 'on' | 'off' | 'mixed'

function encodeIdPart(value: string): string {
  return encodeURIComponent(value).replace(/%/g, '-')
}

function CheckboxGroupProvider(
  handle: Handle<CheckboxGroupContextProps, CheckboxGroupContextValue>,
): () => RemixNode {
  let uncontrolledValue: readonly string[] = handle.props.defaultValue ?? []
  let items = new Map<string, CheckboxGroupItem>()
  let root: HTMLElement | undefined
  // The parent checkbox cycles mixed → all → none → mixed, restoring the selection the user made
  // with the child checkboxes (Base UI's `useCheckboxGroupParent`).
  let userSelection: readonly string[] = getValue()
  let parentStatus: ParentStatus = 'mixed'
  let members = new Set<CheckboxGroupItem>()
  let focusWithin = false
  // Inside a <field.Context>, the group is the field's control: its value is the field value,
  // `required` checkboxes validate through their hidden inputs, and the first invalid (or
  // first enabled) checkbox is focused when the field blocks a submission.
  let fieldChange = createFieldChange<readonly string[]>()
  let fieldControl = connectFieldControl(handle, {
    getValue: () => [...fieldChange.read(getValue)],
    getValidityElement: () => {
      let inputs = sortedItems().map((item) => item.getInput())
      return inputs.find((input) => input && !input.validity.valid) ?? inputs.find(Boolean)
    },
    getFocusElement: () => {
      let list = sortedItems()
      let invalid = list.find((item) => item.getInput()?.validity.valid === false)
      return (invalid ?? list.find((item) => !item.disabled) ?? list[0])?.getNode()
    },
  })
  // Set by every render, before the checkboxes inside render.
  let fieldState: FieldControlRenderResult | undefined

  /** Registered (non-parent) checkboxes in document order once mounted. */
  function sortedItems(): CheckboxGroupItem[] {
    let list = [...items.values()]
    if (list.every((item) => item.getNode()?.isConnected)) {
      list.sort((a, b) => {
        let position = a.getNode()!.compareDocumentPosition(b.getNode()!)
        return position & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
      })
    }
    return list
  }

  function isDisabled() {
    return fieldState?.disabled ?? handle.props.disabled === true
  }

  function isControlled() {
    return handle.props.value !== undefined
  }

  function getValue(): readonly string[] {
    return isControlled() ? (handle.props.value ?? []) : uncontrolledValue
  }

  function isItemDisabled(value: string) {
    return items.get(value)?.disabled === true
  }

  function setValue(next: string[], event: Event, origin: Element | undefined) {
    if (!isControlled()) {
      uncontrolledValue = next
      void handle.update()
    }
    fieldChange.report(fieldControl, next, event)
    handle.props.onValueChange?.(next, event)
    ;(origin ?? root)?.dispatchEvent(new CheckboxGroupChangeEvent(next))
  }

  let context: CheckboxGroupContextValue = {
    get value() {
      return getValue()
    },
    get allValues() {
      return handle.props.allValues
    },
    get disabled() {
      return isDisabled()
    },
    _isChecked(value) {
      return getValue().includes(value)
    },
    _setItem(value, checked, event, origin) {
      let current = getValue()
      if (current.includes(value) === checked) return
      let next = checked ? [...current, value] : current.filter((item) => item !== value)
      userSelection = next
      parentStatus = 'mixed'
      setValue(next, event, origin)
    },
    _parentState() {
      let allValues = handle.props.allValues ?? []
      let value = getValue()
      let count = allValues.filter((item) => value.includes(item)).length
      return {
        checked: allValues.length > 0 && count === allValues.length,
        indeterminate: count > 0 && count < allValues.length,
      }
    },
    _toggleParent(event, origin) {
      let allValues = handle.props.allValues ?? []
      let value = getValue()
      // Disabled children keep their state: "none" keeps disabled ticked ones, "all" skips
      // disabled unticked ones.
      let none = allValues.filter((item) => isItemDisabled(item) && userSelection.includes(item))
      let all = allValues.filter((item) => !isItemDisabled(item) || userSelection.includes(item))
      let allOnOrOff = userSelection.length === all.length || userSelection.length === 0

      let next: string[]
      if (allOnOrOff) {
        next = value.length === all.length ? none : all
      } else if (parentStatus === 'mixed') {
        next = all
        parentStatus = 'on'
      } else if (parentStatus === 'on') {
        next = none
        parentStatus = 'off'
      } else {
        next = [...userSelection]
        parentStatus = 'mixed'
      }
      // Keep values that are not part of `allValues` (checkboxes the parent doesn't control).
      let extra = value.filter((item) => !allValues.includes(item))
      setValue([...extra, ...next], event, origin)
    },
    _register(value, entry) {
      items.set(value, entry)
    },
    _unregister(value, entry) {
      if (items.get(value) === entry) items.delete(value)
    },
    _itemId(value) {
      return `${handle.id}-${encodeIdPart(value)}`
    },
    _controls() {
      let allValues = handle.props.allValues
      if (!allValues || allValues.length === 0) return undefined
      return allValues
        .map((value) => items.get(value)?.getNode()?.id || context._itemId(value))
        .join(' ')
    },
    _setRoot(node) {
      root = node
    },
    _field: fieldControl.field,
    _fieldState() {
      return fieldState!
    },
    _addMember(entry, signal) {
      members.add(entry)
      signal.addEventListener('abort', () => members.delete(entry))
    },
    _fieldFocus() {
      if (focusWithin) return
      focusWithin = true
      fieldControl.focus()
    },
    _fieldBlur(event) {
      let nodes = [root, ...[...members].flatMap((entry) => [entry.getNode(), entry.getInput()])]
      // Moving between the group's checkboxes is not a blur of the field.
      if (focusStaysInside(event.relatedTarget, nodes)) return
      focusWithin = false
      fieldControl.blur()
    },
  }

  handle.context.set(context)

  return () => {
    fieldState = fieldControl.render({
      value: [...getValue()],
      disabled: handle.props.disabled === true,
    })
    return handle.props.children
  }
}

/** @internal Reads the enclosing checkbox group, if any. */
export function getCheckboxGroup(
  handle: Handle<any, any> | MixinHandle<any, any>,
): CheckboxGroupContextValue | undefined {
  return handle.context.get(CheckboxGroupProvider) as CheckboxGroupContextValue | undefined
}

const rootMixin: MixinFactory<HTMLElement, [], ElementProps> = createMixin<
  HTMLElement,
  [],
  ElementProps
>((handle) => {
  let context = getCheckboxGroup(handle)
  if (!context) {
    throw new Error('checkboxGroup.root() must be rendered inside <checkboxGroup.Context>')
  }
  let group = context

  return (props) => {
    let f = group._fieldState()
    let hasName = props['aria-label'] !== undefined || props['aria-labelledby'] !== undefined
    return [
      attrs({
        role: 'group',
        // Inside a field, the group is the field's control: a field label names it and the
        // field's descriptions and errors describe it. (`role="group"` has no `aria-invalid`;
        // each checkbox gets it.)
        id: f.inField ? f.id : undefined,
        'aria-labelledby': hasName ? undefined : f.labelId,
        'aria-describedby': f.describedBy,
        ...f.dataAttrs,
        'data-disabled': flag(group.disabled),
      }),
      ref((node: HTMLElement, signal) => {
        group._setRoot(node)
        signal.addEventListener('abort', () => group._setRoot(undefined))
      }),
    ]
  }
})

/**
 * Provider that owns the group value. Checkboxes (`stems-ui/checkbox`) rendered inside it read
 * and update the group, identified by their `value` (or `name`). Inside a `<field.Context>`,
 * the group is the field's control (its value is the array of ticked values); wrap each
 * checkbox in a `<field.ItemContext>` to give it its own `field.label()`.
 */
export const Context = CheckboxGroupProvider

/**
 * The `role="group"` element around the checkboxes. Sets `data-disabled`, and inside a field
 * the field's state attributes, `aria-labelledby` (a field label) and `aria-describedby`.
 */
export const root = rootMixin

/** Listens for the bubbling `stems:checkbox-group-change` event. */
export function onCheckboxGroupChange<target extends HTMLElement>(
  handler: CheckboxGroupChangeHandler<target>,
  captureBoolean?: boolean,
): ReturnType<typeof on<target, typeof CHECKBOX_GROUP_CHANGE_EVENT>> {
  return on(CHECKBOX_GROUP_CHANGE_EVENT, handler, captureBoolean)
}
