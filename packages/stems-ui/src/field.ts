import { attrs, createMixin, on } from '@remix-run/component'
import type {
  ElementProps,
  Handle,
  MixinFactory,
  MixinHandle,
  RemixNode,
} from '@remix-run/component'

import { input } from './input.ts'
import { splitOptions } from './lib/collapsible-panel.ts'
import {
  FieldProvider,
  fieldStateAttrs,
  getFieldInternals,
  type FieldContextValue,
  type FieldErrorMatch,
  type FieldInternals,
  type FieldPartEntry,
  type FieldState,
  type FieldValidityState,
} from './lib/field-control.ts'
import { createPresence, type TransitionStatus } from './lib/presence.ts'

export type {
  ActionsRef,
  FieldActions,
  FieldContextProps,
  FieldContextValue,
  FieldErrorMatch,
  FieldState,
  FieldValidate,
  FieldValidateResult,
  FieldValidationMode,
  FieldValidityData,
  FieldValidityFlags,
  FieldValidityKey,
  FieldValidityState,
} from './lib/field-control.ts'

export interface FieldErrorOptions {
  /**
   * Which validity state shows the error:
   * - omitted: whenever the field is invalid,
   * - a `ValidityState` key (`'valueMissing'`, `'typeMismatch'`, `'customError'`, ...): when the
   *   field is invalid for that reason (`'customError'` covers `validate` and server errors),
   * - `'valid'`: when the field is valid,
   * - `true` / `false`: always / never (let an external library decide).
   */
  match?: FieldErrorMatch
}

/** State passed to `<field.Validity>`'s render function. Base UI's `Field.Validity.State`. */
export interface FieldValidityRenderState {
  validity: FieldValidityState
  errors: string[]
  /** The first error, or `''`. */
  error: string
  /** The value at the last validation. */
  value: unknown
  initialValue: unknown
  transitionStatus: TransitionStatus
}

export interface FieldValidityProps {
  /** Renders content from the field's validity state. */
  children: (state: FieldValidityRenderState) => RemixNode
}

/** Props for `<field.ItemContext>`. They match Base UI's `Field.Item` props. */
export interface FieldItemContextProps {
  children?: RemixNode
  /**
   * Whether the item's control ignores user interaction. The field's (and fieldset's)
   * `disabled` wins over this.
   * @default false
   */
  disabled?: boolean
}

/**
 * State provided by `<field.ItemContext>`, readable with `handle.context.get(field.ItemContext)`.
 * Controls inside the item (a checkbox in a checkbox group, a radio) read their label, id,
 * descriptions and `disabled` from it.
 */
export interface FieldItemContextValue {
  /** The field state, with `disabled` including the item's own `disabled`. */
  readonly state: FieldState
  readonly disabled: boolean
  /** The id of the item's control (the control's own `id` once it reported one). */
  readonly controlId: string
  /** The id of the `field.label()` rendered inside the item, if any. */
  readonly labelId: string | undefined
  /** Space-separated ids of the `field.description()` parts rendered inside the item. */
  readonly describedBy: string | undefined
  /** @internal The field this item belongs to. */
  readonly _field: FieldContextValue
  /**
   * @internal Reports the control's own id (`undefined` for none). Call while rendering; the
   * item re-renders after the commit when it changed.
   */
  _setControlId(id: string | undefined, from: TaskQueue): void
  /** @internal Registers the element focused by a click on a non-native item label. */
  _connect(getFocusElement: () => HTMLElement | null | undefined, signal: AbortSignal): void
}

interface TaskQueue {
  queueTask(task: () => void): void
}

/** The registry `usePart` writes to: a field, or a `field.ItemContext`. */
interface PartHost {
  nextPartId(kind: 'label' | 'description' | 'error'): string
  registerPart(kind: 'label' | 'description' | 'error', entry: FieldPartEntry): () => void
  setPartId(entry: FieldPartEntry, id: string, from: TaskQueue): void
  scheduleUpdate(from: TaskQueue): void
  focusControl(): void
}

interface ItemInternals extends PartHost {
  readonly context: FieldItemContextValue
}

const itemInternalsByContext = new WeakMap<FieldItemContextValue, ItemInternals>()

function getField(
  handle: MixinHandle<HTMLElement, ElementProps> | Handle<any, any>,
  part: string,
): [FieldContextValue, FieldInternals] {
  let context = handle.context.get(FieldProvider) as FieldContextValue | undefined
  if (!context) throw new Error(`field.${part} must be rendered inside <field.Context>`)
  return [context, getFieldInternals(context)]
}

function stringId(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined
}

/**
 * The enclosing `field.ItemContext` when it belongs to `field` (an item of an outer field does
 * not capture the parts of a field nested inside it).
 */
function getItem(
  handle: MixinHandle<HTMLElement, ElementProps> | Handle<any, any>,
  field: FieldContextValue,
): ItemInternals | undefined {
  let item = handle.context.get(FieldItemProvider) as FieldItemContextValue | undefined
  if (!item || item._field !== field) return undefined
  return itemInternalsByContext.get(item)
}

/** Registers a label / description / error part and keeps its rendered id current. */
function usePart(
  handle: MixinHandle<HTMLElement, ElementProps>,
  internals: PartHost,
  kind: 'label' | 'description' | 'error',
) {
  let generatedId = internals.nextPartId(kind)
  let entry: FieldPartEntry = { id: generatedId }
  let unregister = internals.registerPart(kind, entry)
  handle.signal.addEventListener('abort', unregister)
  // Ids of parts rendered after the control are only known now: re-render once committed.
  internals.scheduleUpdate(handle)
  return {
    entry,
    generatedId,
    sync(props: ElementProps) {
      internals.setPartId(entry, stringId(props.id) ?? generatedId, handle)
    },
  }
}

const rootMixin: MixinFactory<HTMLElement, [], ElementProps> = createMixin<
  HTMLElement,
  [],
  ElementProps
>((handle) => {
  let [context, internals] = getField(handle, 'root()')

  return () => [
    attrs({ ...fieldStateAttrs(context.state) }),
    // `invalid` does not bubble; capture it from the control during native form validation
    // (a plain <form> without `form.root()`, or before hydration has set `noValidate`).
    on<HTMLElement, 'invalid'>('invalid', (event) => internals.nativeInvalid(event.target), true),
  ]
})

function isLabelable(node: Element | null) {
  return node !== null && 'labels' in node
}

const labelMixin: MixinFactory<HTMLElement, [], ElementProps> = createMixin<
  HTMLElement,
  [],
  ElementProps
>((handle, hostType) => {
  let [context, internals] = getField(handle, 'label()')
  // Inside a `field.ItemContext`, the label names the item's control instead of the field's.
  let item = getItem(handle, context)
  let host: PartHost = item ?? internals
  let part = usePart(handle, host, 'label')
  let nativeLabel = hostType === 'label'
  let scope = () => item?.context ?? context

  return (props) => {
    part.sync(props)
    return [
      attrs({
        id: part.generatedId,
        for: nativeLabel ? scope().controlId : undefined,
        ...fieldStateAttrs(scope().state),
      }),
      on<HTMLElement, 'click'>('click', (event) => {
        if (event.defaultPrevented || scope().disabled) return
        let control = event.currentTarget.ownerDocument.getElementById(scope().controlId)
        // A native <label for> already activates labelable controls; other controls (a <span>
        // switch, a radio group) and non-<label> hosts focus the control instead.
        if (nativeLabel && isLabelable(control)) return
        host.focusControl()
      }),
    ]
  }
})

const descriptionMixin: MixinFactory<HTMLElement, [], ElementProps> = createMixin<
  HTMLElement,
  [],
  ElementProps
>((handle) => {
  let [context, internals] = getField(handle, 'description()')
  // Inside a `field.ItemContext`, the description describes the item's control.
  let item = getItem(handle, context)
  let part = usePart(handle, item ?? internals, 'description')

  return (props) => {
    part.sync(props)
    return attrs({ id: part.generatedId, ...fieldStateAttrs((item?.context ?? context).state) })
  }
})

const errorMixin: MixinFactory<HTMLElement, [options?: FieldErrorOptions], ElementProps> =
  createMixin<HTMLElement, [options?: FieldErrorOptions], ElementProps>((handle) => {
    let [context, internals] = getField(handle, 'error()')
    let part = usePart(handle, internals, 'error')
    let presence = createPresence(handle, { update: () => internals.update() })

    return (options, props) => {
      ;[options, props] = splitOptions(options, props)
      if (part.entry.match !== options?.match) {
        part.entry.match = options?.match
        internals.scheduleUpdate(handle)
      }
      part.sync(props)
      let visible = internals.errorVisible(options?.match)
      presence.sync(visible)

      return attrs({
        id: part.generatedId,
        hidden: presence.present ? undefined : true,
        ...fieldStateAttrs(context.state),
        ...presence.attrs(),
      })
    }
  })

function FieldItemProvider(
  handle: Handle<FieldItemContextProps, FieldItemContextValue>,
): () => RemixNode {
  let [field] = getField(handle, 'ItemContext')
  let signal = handle.signal
  let itemId = handle.id
  let defaultControlId = `${itemId}-control`
  let controlIdOverride: string | undefined
  let labels: FieldPartEntry[] = []
  let descriptions: FieldPartEntry[] = []
  let partCounts = { label: 0, description: 0, error: 0 }
  let focusGetters: Array<() => HTMLElement | null | undefined> = []
  let updatePending = false

  function update() {
    if (typeof document === 'undefined' || signal.aborted) return
    void handle.update()
  }

  function scheduleUpdate(from: TaskQueue) {
    if (typeof document === 'undefined' || updatePending || signal.aborted) return
    updatePending = true
    from.queueTask(() => {
      updatePending = false
      update()
    })
  }

  function getDisabled() {
    return field.disabled || handle.props.disabled === true
  }

  let context: FieldItemContextValue = {
    get state() {
      return { ...field.state, disabled: getDisabled() }
    },
    get disabled() {
      return getDisabled()
    },
    get controlId() {
      return controlIdOverride ?? defaultControlId
    },
    get labelId() {
      return labels[0]?.id
    },
    get describedBy() {
      return descriptions.length > 0 ? descriptions.map((entry) => entry.id).join(' ') : undefined
    },
    _field: field,
    _setControlId(id, from) {
      if (id === controlIdOverride) return
      controlIdOverride = id
      scheduleUpdate(from)
    },
    _connect(getFocusElement, entrySignal) {
      focusGetters.push(getFocusElement)
      entrySignal.addEventListener('abort', () => {
        let index = focusGetters.indexOf(getFocusElement)
        if (index !== -1) focusGetters.splice(index, 1)
      })
    },
  }

  itemInternalsByContext.set(context, {
    context,
    nextPartId(kind) {
      let count = ++partCounts[kind]
      return `${itemId}-${kind}${count > 1 ? `-${count}` : ''}`
    },
    registerPart(kind, entry) {
      let list = kind === 'label' ? labels : descriptions
      list.push(entry)
      return () => {
        let index = list.indexOf(entry)
        if (index !== -1) list.splice(index, 1)
        update()
      }
    },
    setPartId(entry, id, from) {
      if (entry.id === id) return
      entry.id = id
      scheduleUpdate(from)
    },
    scheduleUpdate,
    focusControl() {
      focusGetters[focusGetters.length - 1]?.()?.focus()
    },
  })

  handle.context.set(context)
  return () => handle.props.children
}

const itemMixin: MixinFactory<HTMLElement, [], ElementProps> = createMixin<
  HTMLElement,
  [],
  ElementProps
>((handle) => {
  let [field] = getField(handle, 'item()')
  let item = getItem(handle, field)
  if (!item) throw new Error('field.item() must be rendered inside <field.ItemContext>')
  let context = item.context
  return () => attrs({ ...fieldStateAttrs(context.state) })
})

function FieldValidity(handle: Handle<FieldValidityProps>): () => RemixNode {
  let [context] = getField(handle, 'Validity')

  return () => {
    let validity = context.validity
    return handle.props.children({
      validity: { ...validity.state, valid: context.valid },
      errors: validity.errors,
      error: validity.error,
      value: validity.value,
      initialValue: validity.initialValue,
      transitionStatus: undefined,
    })
  }
}

/**
 * Provider that owns the field's state and validation. Base UI's `Field.Root` props live here:
 * `name`, `disabled`, `invalid`, `dirty`, `touched`, `validate`, `validationMode`,
 * `validationDebounceTime`, `actionsRef`.
 */
export const Context = FieldProvider

/** Wires the field's root element (any element; Base UI renders a `<div>`): state attributes. */
export const root = rootMixin

/**
 * Wires the field label. On a `<label>` host it gets `for` → the control's id. Clicking a
 * non-`<label>` host, or a label of a non-labelable control, focuses the control.
 */
export const label = labelMixin

/** Wires a description paragraph. The control's `aria-describedby` references it. */
export const description = descriptionMixin

/**
 * Wires an error message. It is `hidden` unless it matches the field's validity (see
 * `match`); the control's `aria-describedby` references it while it is shown. Messages are
 * app content: render children, or `<field.Validity>` for the field's current messages.
 */
export const error = errorMixin

/**
 * The field's native control: `<input>`, `<textarea>` or `<select>`. This is the same mixin as
 * `stems-ui/input`'s `input()` (Base UI's `Field.Control` and `Input` are one component too):
 * use either one, not both. Options: `value`, `defaultValue`, `onValueChange`, `disabled`.
 */
export const control = input

/**
 * Provider for one item of a checkbox group or radio group inside a field (Base UI's
 * `Field.Item`). `field.label()` and `field.description()` rendered inside it label and
 * describe the item's control (a `checkbox.Context` or `radio.Context` inside it) instead of
 * the whole field. Props: `disabled` (disables the item's control).
 */
export const ItemContext = FieldItemProvider

/** Wires the item's element (Base UI renders a `<div>`): the field state attributes. */
export const item = itemMixin

/**
 * Renders content from the field's validity state, like Base UI's `Field.Validity`:
 * `<field.Validity>{(state) => state.error}</field.Validity>`. Re-renders with the field.
 */
export const Validity = FieldValidity
