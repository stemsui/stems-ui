/**
 * # The Field control contract
 *
 * `stems-ui/field` owns a field's state: ids, `disabled`, `name`, validity, and the interaction
 * flags Base UI exposes as data attributes (`touched`, `dirty`, `filled`, `focused`,
 * `valid` / `invalid`). Every form control — `input`, `switch`, `checkbox`, `radio-group`,
 * `select`, `slider`, `number-field`, `otp-field`, `combobox`, ... — plugs into an enclosing
 * `<field.Context>` through **one function**, {@link connectFieldControl}. Outside a Field the
 * connection is inert, so a control can call it unconditionally.
 *
 * ## The four steps
 *
 * 1. **Connect once, during setup** (mixin setup or Context provider setup):
 *
 *    ```ts
 *    let fieldControl = connectFieldControl(handle, {
 *      getValue: () => currentValue,                    // the control's current value
 *      getValidityElement: () => hiddenInput,           // element with native `validity`
 *      getFocusElement: () => rootButton,               // what to focus when invalid
 *    })
 *    ```
 *
 *    All options are optional. With a mixin handle the defaults use the host node: its `.value`,
 *    its `validity` (when it is an `<input>`, `<select>`, `<textarea>`, ...), and the node itself
 *    for focus. A Context provider (which has no host node) must pass the getters it needs
 *    (without `getValue`, the last value reported to `render()` / `change()` is used).
 *    `isFilled(value)` overrides the default "filled" test (not `''` / `null` / `undefined` /
 *    `false` / `[]`). The connection registers with the field, and unregisters when
 *    `handle.signal` aborts.
 *
 * 2. **Call `render()` at the top of every render** and use its result for the props you
 *    render. It reports the current value (for `filled` / `dirty`) and the host `id`, and it
 *    returns what the field decides:
 *
 *    ```ts
 *    let f = fieldControl.render({ value, id: props.id, disabled: options.disabled, name })
 *    // f.inField      whether a <field.Context> encloses the control
 *    // f.id           id for the labelable element (`<label for>` targets it), or your own id
 *    // f.labelId      id of field.label(), for `aria-labelledby` on non-labelable elements
 *    // f.describedBy  ids of the field's descriptions and visible errors
 *    // f.name         the field's `name` (it wins over the control's), or yours
 *    // f.disabled     field || fieldset || your own `disabled`
 *    // f.invalid      the field is invalid (validation, `invalid` prop or server errors)
 *    // f.state        { disabled, touched, dirty, valid, filled, focused }
 *    // f.dataAttrs    data-disabled / data-valid / data-invalid / data-touched / ...
 *    // f.attrs        f.dataAttrs + id + aria-describedby + aria-invalid, ready for attrs()
 *    ```
 *
 *    Outside a Field, `f.id` / `f.name` are your own values, `f.disabled` is your own value or
 *    an enclosing `fieldset.Context`'s `disabled` (the only outside-a-Field effect), and the
 *    state comes from `local` (pass your standalone flags there, or nothing).
 *
 * 3. **Report interaction from event handlers** (never from render):
 *
 *    ```ts
 *    on('focus', () => fieldControl.focus())     // data-focused
 *    on('blur', () => fieldControl.blur())       // data-touched, validationMode 'onBlur'
 *    fieldControl.change(nextValue, event)       // after every user change of the value
 *    ```
 *
 *    `change()` updates `dirty` / `filled`, clears the field's external (server) errors, and
 *    validates according to the field's `validationMode`. For composite widgets report focus
 *    and blur of the whole widget (use `focusin` / `focusout` and ignore moves inside it).
 *
 * 4. **Expose native validity.** The field validates by reading `validity` /
 *    `validationMessage` from `getValidityElement()` and runs the field's `validate` function
 *    with `getValue()`; custom errors are applied with `setCustomValidity()` so native
 *    `:invalid`, `form.checkValidity()` and plain (non-Stems) forms agree. Put `required`,
 *    `min`, `pattern`... on that element. Use a visually hidden `<input>` for custom widgets
 *    (`type="hidden"` inputs never validate) — e.g. the switch's hidden checkbox. Inside a
 *    `form.root()`, invalid fields block the submission and `getFocusElement()` is focused.
 *
 * The field re-renders all of its parts (the control included) whenever its state changes, so
 * don't write state attributes to the DOM yourself inside a Field: render `f.dataAttrs`.
 *
 * ## Minimal integration
 *
 * ```ts
 * const myControl = createMixin<HTMLInputElement, [options?: MyOptions], ElementProps>(
 *   (handle) => {
 *     let fieldControl = connectFieldControl(handle) // defaults: host node value / validity
 *     return (...args) => {
 *       let [options, props] = readArgs(args)
 *       let f = fieldControl.render({ value: currentValue(options, props), id: props.id })
 *       return [
 *         attrs({ ...f.attrs, name: f.name, disabled: f.disabled || undefined }),
 *         on('focus', () => fieldControl.focus()),
 *         on('blur', () => fieldControl.blur()),
 *         on('input', (event) => fieldControl.change(event.currentTarget.value, event)),
 *       ]
 *     }
 *   },
 * )
 * ```
 *
 * A provider-based widget (e.g. a switch whose `Context` renders the hidden input) connects in
 * the provider and spreads `f.attrs` on its root part:
 *
 * ```ts
 * function SwitchProvider(handle) {
 *   let fieldControl = connectFieldControl(handle, {
 *     getValue: () => getChecked(),
 *     getValidityElement: () => input ?? null,
 *     getFocusElement: () => root ?? null,
 *     isFilled: (checked) => checked === true,
 *   })
 *   // provider render: let f = fieldControl.render({ value: getChecked(), id: props.id })
 *   //   hidden input gets f.name / f.disabled; the root mixin renders f.id (a <button> root is
 *   //   labelable), aria-labelledby={f.labelId} for a <span> root, f.dataAttrs, aria-invalid.
 *   // commit(): fieldControl.change(next, event)
 * }
 * ```
 *
 * ## Notes
 *
 * - Host props win over `attrs()`: a host `id`, `name`, `aria-describedby` or `disabled` prop
 *   replaces the field's value. Pass the host `id` to `render()` so `<label for>` follows it.
 * - Ids of parts rendered after the control (descriptions, errors) are only known once they
 *   registered. On the client the field re-renders right after the first commit to fix
 *   `aria-describedby`; server HTML only includes parts that precede the control.
 * - Async `validate` functions never block a submission.
 * - A control outside any Field but inside `form.root()` still blocks invalid submissions
 *   through its native validity (the form falls back to `reportValidity()` for it).
 */

import type { ElementProps, Handle, MixinHandle, RemixNode } from '@remix-run/component'

import { Context as FieldsetProvider, type FieldsetContextValue } from '../fieldset.ts'
import {
  Context as FormProvider,
  assignActionsRef,
  normalizeErrors,
  type FormContextValue,
  type FormValues,
} from '../form.ts'

// ---------------------------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------------------------

/** When a field validates. Base UI's `Form.ValidationMode`. */
export type FieldValidationMode = 'onSubmit' | 'onBlur' | 'onChange'

/** An object ref (`{ current }`) or a callback that receives imperative actions. */
export type ActionsRef<actions> = { current: actions | null } | ((actions: actions) => void)

/** The boolean flags of a native `ValidityState`. */
export interface FieldValidityFlags {
  badInput: boolean
  customError: boolean
  patternMismatch: boolean
  rangeOverflow: boolean
  rangeUnderflow: boolean
  stepMismatch: boolean
  tooLong: boolean
  tooShort: boolean
  typeMismatch: boolean
  valueMissing: boolean
}

export type FieldValidityKey = keyof FieldValidityFlags

/** Validity flags plus `valid`, which is `null` until the field has been validated. */
export interface FieldValidityState extends FieldValidityFlags {
  valid: boolean | null
}

/** Base UI's `Field.ValidityData`. */
export interface FieldValidityData {
  state: FieldValidityState
  /** The first error message, or `''`. */
  error: string
  errors: string[]
  value: unknown
  initialValue: unknown
}

/** Base UI's field state. Every part renders it as data attributes. */
export interface FieldState {
  disabled: boolean
  touched: boolean
  dirty: boolean
  /** `null` until validated. */
  valid: boolean | null
  filled: boolean
  focused: boolean
}

/** Data attributes for a {@link FieldState}: present (`''`) or absent. */
export interface FieldStateAttrs {
  'data-disabled'?: ''
  'data-valid'?: ''
  'data-invalid'?: ''
  'data-touched'?: ''
  'data-dirty'?: ''
  'data-filled'?: ''
  'data-focused'?: ''
}

export type FieldValidateResult = string | string[] | null | undefined | void

/**
 * Custom validation. Return an error message (or several) when the value is invalid; nothing,
 * `null`, `''` or `[]` when it is valid. May be async (async results never block submission).
 */
export type FieldValidate = (
  value: unknown,
  formValues: FormValues,
) => FieldValidateResult | Promise<FieldValidateResult>

/** Imperative field actions, passed to `actionsRef`. */
export interface FieldActions {
  /** Validates the field now and shows the result. */
  validate(): void
}

/** Props for `<field.Context>`. They match Base UI's `Field.Root` props. */
export interface FieldContextProps {
  children?: RemixNode
  /** Identifies the field when a form is submitted. Takes precedence over the control's `name`. */
  name?: string
  /**
   * Whether the field (and its control) ignores user interaction. Takes precedence over the
   * control's `disabled`. An enclosing `fieldset.Context` can also disable it.
   * @default false
   */
  disabled?: boolean
  /** Forces the invalid state (for external validation libraries). */
  invalid?: boolean
  /** Controls the `dirty` state (for external libraries). */
  dirty?: boolean
  /** Controls the `touched` state (for external libraries). */
  touched?: boolean
  /** Custom validation, run after native constraint validation passes. */
  validate?: FieldValidate
  /**
   * When to validate. Takes precedence over `<form.Context validationMode>`.
   * - `'onSubmit'`: when the form is submitted, then on every change after that.
   * - `'onBlur'`: when the control loses focus (and on change while the field is invalid).
   * - `'onChange'`: on every change, debounced by `validationDebounceTime`.
   * @default 'onSubmit'
   */
  validationMode?: FieldValidationMode
  /**
   * Milliseconds to wait between `validate` calls with `validationMode="onChange"`.
   * @default 0
   */
  validationDebounceTime?: number
  /** Receives `{ validate() }` (an object ref or a callback). */
  actionsRef?: ActionsRef<FieldActions>
}

/** State provided by `<field.Context>`, readable with `handle.context.get(field.Context)`. */
export interface FieldContextValue extends Readonly<FieldState> {
  readonly name: string | undefined
  /** A snapshot of `{ disabled, touched, dirty, valid, filled, focused }`. */
  readonly state: FieldState
  /** Validity flags, error messages, value and initial value. */
  readonly validity: FieldValidityData
  readonly validationMode: FieldValidationMode
  /** The id of the control (the control's own `id` once it reported one). */
  readonly controlId: string
  /** The id of the rendered `field.label()`, if any. */
  readonly labelId: string | undefined
  /** Validates the field now and shows the result. */
  validate(): void
}

/** An element that takes part in native constraint validation. */
export interface ValidatableElement extends Element {
  readonly validity: ValidityState
  readonly validationMessage: string
  readonly willValidate: boolean
  setCustomValidity(message: string): void
}

/** Options for {@link connectFieldControl}. */
export interface FieldControlOptions {
  /** The control's current value, passed to `validate`. Default: the host node's `.value`. */
  getValue?(): unknown
  /**
   * The element whose native `validity` the field reads and whose `setCustomValidity()` it
   * calls. Default: the host node when it supports constraint validation.
   */
  getValidityElement?(): ValidatableElement | null | undefined
  /** The element focused when the field is the first invalid one. Default: the host node. */
  getFocusElement?(): HTMLElement | null | undefined
  /**
   * Whether a value counts as filled. Default: not `''`, `null`, `undefined`, `false` or an
   * empty array.
   */
  isFilled?(value: unknown): boolean
}

/** What a control reports from its render function. */
export interface FieldControlRenderInput {
  /**
   * The value the control renders. The first value reported becomes the initial value
   * (`dirty` compares against it); `filled` is derived from it. Omit when unknown (the host
   * node's value is read after insertion).
   */
  value?: unknown
  /** The host's own `id` prop. Becomes the field's control id, so `<label for>` follows it. */
  id?: string
  /** The control's own `disabled`. The field's and fieldset's `disabled` win. */
  disabled?: boolean
  /** The control's own `name`. The field's `name` wins. */
  name?: string
  /** Standalone state flags, used for the state only outside a Field. */
  local?: Partial<FieldState>
}

/** What the field decides for the control's current render. */
export interface FieldControlRenderResult {
  /** Whether a `<field.Context>` encloses the control. */
  inField: boolean
  /** The id to render on the labelable element: your own id, else the field's control id. */
  id: string | undefined
  /** `field.label()`'s id, for `aria-labelledby` on a non-labelable element. */
  labelId: string | undefined
  /** Space-separated ids of the field's descriptions and visible errors. */
  describedBy: string | undefined
  name: string | undefined
  disabled: boolean
  /** Whether the field is invalid (rendered as `aria-invalid="true"`). */
  invalid: boolean
  state: FieldState
  dataAttrs: FieldStateAttrs
  /** `dataAttrs` + `id` + `aria-describedby` + `aria-invalid`, for the main control element. */
  attrs: ElementProps
}

/** The connection returned by {@link connectFieldControl}. */
export interface FieldControl {
  /** Whether a `<field.Context>` encloses the control. */
  readonly inField: boolean
  /** The enclosing field's context value. */
  readonly field: FieldContextValue | undefined
  /** Call at the top of every render. See {@link FieldControlRenderInput}. */
  render(input?: FieldControlRenderInput): FieldControlRenderResult
  /** Report that the control (or composite widget) received focus. */
  focus(): void
  /** Report that the control (or composite widget) lost focus. */
  blur(): void
  /** Report a user change of the value. */
  change(value: unknown, event?: Event): void
  /** Validate the field now and show the result. */
  validate(): void
}

// ---------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------

const VALIDITY_KEYS: readonly FieldValidityKey[] = [
  'badInput',
  'customError',
  'patternMismatch',
  'rangeOverflow',
  'rangeUnderflow',
  'stepMismatch',
  'tooLong',
  'tooShort',
  'typeMismatch',
  'valueMissing',
]

function emptyFlags(): FieldValidityFlags {
  let flags = {} as FieldValidityFlags
  for (let key of VALIDITY_KEYS) flags[key] = false
  return flags
}

function readFlags(validity: ValidityState): FieldValidityFlags {
  let flags = {} as FieldValidityFlags
  for (let key of VALIDITY_KEYS) flags[key] = validity[key] === true
  return flags
}

/** Converts a field state into Base UI's data attributes. */
export function fieldStateAttrs(state: FieldState): FieldStateAttrs {
  return {
    'data-disabled': state.disabled ? '' : undefined,
    'data-valid': state.valid === true ? '' : undefined,
    'data-invalid': state.valid === false ? '' : undefined,
    'data-touched': state.touched ? '' : undefined,
    'data-dirty': state.dirty ? '' : undefined,
    'data-filled': state.filled ? '' : undefined,
    'data-focused': state.focused ? '' : undefined,
  }
}

/** Default `isFilled`. */
export function isFilledValue(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0
  return value !== '' && value !== null && value !== undefined && value !== false
}

function sameValue(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, index) => Object.is(item, b[index]))
  }
  return false
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return typeof (value as PromiseLike<unknown> | null)?.then === 'function'
}

function isValidatable(node: unknown): node is ValidatableElement {
  return (
    typeof node === 'object' &&
    node !== null &&
    'validity' in node &&
    typeof (node as ValidatableElement).setCustomValidity === 'function'
  )
}

const isClient = typeof document !== 'undefined'

/** Something with `queueTask`: a component handle or a mixin handle. */
interface TaskQueue {
  queueTask(task: () => void): void
}

// ---------------------------------------------------------------------------------------------
// Field internals (shared with the parts in `field.ts`)
// ---------------------------------------------------------------------------------------------

export type FieldErrorMatch = boolean | 'valid' | FieldValidityKey

/** @internal A registered label, description or error part. */
export interface FieldPartEntry {
  id: string
  /** Errors only. */
  match?: FieldErrorMatch
}

interface ControlEntry {
  options: FieldControlOptions
  getNode(): Element | null
}

/** @internal */
export interface FieldInternals {
  readonly fieldId: string
  /** Re-renders the field from an event handler or a queued task. */
  update(): void
  /** Re-renders the field after the current commit. Safe to call while rendering. */
  scheduleUpdate(from: TaskQueue): void
  /** Registers a part during setup. Returns the generated id and an unregister function. */
  registerPart(kind: 'label' | 'description' | 'error', entry: FieldPartEntry): () => void
  /** Generated id for the nth part of a kind. */
  nextPartId(kind: 'label' | 'description' | 'error'): string
  errorVisible(match: FieldErrorMatch | undefined): boolean
  /** Records a part's rendered id; schedules a re-render when it changed. */
  setPartId(entry: FieldPartEntry, id: string, from: TaskQueue): void
  /** The control's focus element (for labels on non-labelable controls). */
  focusControl(): void
  /** Native `invalid` event from a control inside the field root. */
  nativeInvalid(target: EventTarget | null): void
  connect(entry: ControlEntry, signal: AbortSignal): () => void
  /** Render-time value report (`initialOnly`: ignored once a value was reported). */
  reportValue(value: unknown, from: TaskQueue, initialOnly?: boolean): void
  render(input: FieldControlRenderInput, from: TaskQueue): FieldControlRenderResult
  focus(): void
  blur(): void
  change(value: unknown): void
}

const internalsByContext = new WeakMap<FieldContextValue, FieldInternals>()

/** @internal */
export function getFieldInternals(context: FieldContextValue): FieldInternals {
  return internalsByContext.get(context)!
}

// ---------------------------------------------------------------------------------------------
// <field.Context>
// ---------------------------------------------------------------------------------------------

/**
 * Provider behind `field.Context`. Owns the field state and validation; parts and controls read
 * it through context.
 */
export function FieldProvider(
  handle: Handle<FieldContextProps, FieldContextValue>,
): () => RemixNode {
  let form = handle.context.get(FormProvider) as FormContextValue | undefined
  let fieldset = handle.context.get(FieldsetProvider) as FieldsetContextValue | undefined
  let signal = handle.signal
  let fieldId = handle.id
  let defaultControlId = `${fieldId}-control`

  let controlIdOverride: string | undefined
  let labels: FieldPartEntry[] = []
  let descriptions: FieldPartEntry[] = []
  let errorParts: FieldPartEntry[] = []
  let partCounts = { label: 0, description: 0, error: 0 }
  let controls: ControlEntry[] = []

  let value: unknown
  let initialValue: unknown
  let hasValue = false
  let focused = false
  let touchedState = false
  let submitted = false
  let validity: FieldValidityData = {
    state: { ...emptyFlags(), valid: null },
    error: '',
    errors: [],
    value: undefined,
    initialValue: undefined,
  }
  // The element we last called setCustomValidity() on with a message.
  let customValidityElement: ValidatableElement | null = null
  let validationToken = 0
  let debounceTimer: ReturnType<typeof setTimeout> | undefined
  let updatePending = false

  signal.addEventListener('abort', () => clearTimeout(debounceTimer))

  function update() {
    if (!isClient || signal.aborted) return
    void handle.update()
  }

  function scheduleUpdate(from: TaskQueue) {
    if (!isClient || updatePending || signal.aborted) return
    updatePending = true
    from.queueTask(() => {
      updatePending = false
      update()
    })
  }

  function activeControl(): ControlEntry | undefined {
    return controls[controls.length - 1]
  }

  function getValidityElement(): ValidatableElement | null {
    let control = activeControl()
    if (!control) return null
    if (control.options.getValidityElement) return control.options.getValidityElement() ?? null
    let node = control.getNode()
    return isValidatable(node) ? node : null
  }

  function getFocusElement(): HTMLElement | null {
    let control = activeControl()
    if (!control) return null
    if (control.options.getFocusElement) return control.options.getFocusElement() ?? null
    let node = control.getNode()
    return node instanceof HTMLElement ? node : null
  }

  function readValue(): unknown {
    let control = activeControl()
    if (control?.options.getValue) return control.options.getValue()
    if (hasValue) return value
    let node = control?.getNode() as { value?: unknown } | null | undefined
    return node?.value
  }

  function isFilled(next: unknown) {
    return (activeControl()?.options.isFilled ?? isFilledValue)(next)
  }

  function serverErrors(): string[] | null {
    return form?._getErrors(handle.props.name) ?? null
  }

  function getValidity(): FieldValidityData {
    if (validity.state.valid === false) return validity
    let server = serverErrors()
    if (!server) return validity
    return {
      ...validity,
      state: { ...validity.state, customError: true, valid: false },
      errors: server,
      error: server[0]!,
    }
  }

  function getValid(): boolean | null {
    if (handle.props.invalid === true) return false
    return getValidity().state.valid
  }

  function getDisabled() {
    return handle.props.disabled === true || fieldset?.disabled === true
  }

  function getDirty() {
    return handle.props.dirty ?? (hasValue && !sameValue(value, initialValue))
  }

  function getState(): FieldState {
    return {
      disabled: getDisabled(),
      touched: handle.props.touched ?? touchedState,
      dirty: getDirty(),
      valid: getValid(),
      filled: hasValue && isFilled(value),
      focused,
    }
  }

  function getMode(): FieldValidationMode {
    return handle.props.validationMode ?? form?.validationMode ?? 'onSubmit'
  }

  function applyResult(
    token: number,
    flags: FieldValidityFlags,
    element: ValidatableElement | null,
    checkedValue: unknown,
    result: FieldValidateResult,
  ): boolean {
    if (token !== validationToken) return true
    let errors = normalizeErrors(result)
    if (errors.length > 0) {
      if (element) {
        element.setCustomValidity(errors[0]!)
        customValidityElement = element
      }
      flags.customError = true
    }
    validity = {
      state: { ...flags, valid: errors.length === 0 },
      error: errors[0] ?? '',
      errors,
      value: checkedValue,
      initialValue,
    }
    return errors.length === 0
  }

  /** Runs native + custom validation. Returns `false` when known invalid (async → `true`). */
  function runValidation(): boolean {
    clearTimeout(debounceTimer)
    let token = ++validationToken
    let element = getValidityElement()
    let checkedValue = readValue()

    if (customValidityElement) {
      customValidityElement.setCustomValidity('')
      customValidityElement = null
    }

    let flags = element ? readFlags(element.validity) : emptyFlags()
    if (element && !element.validity.valid) {
      let message = element.validationMessage
      validity = {
        state: { ...flags, valid: false },
        error: message,
        errors: message ? [message] : [],
        value: checkedValue,
        initialValue,
      }
      return false
    }

    let validate = handle.props.validate
    if (!validate) return applyResult(token, flags, element, checkedValue, null)

    let result = validate(checkedValue, form?.getValues() ?? {})
    if (isPromiseLike(result)) {
      Promise.resolve(result).then(
        (resolved) => {
          if (signal.aborted || token !== validationToken) return
          applyResult(token, flags, element, checkedValue, resolved)
          update()
        },
        () => {},
      )
      return true
    }
    return applyResult(token, flags, element, checkedValue, result)
  }

  function validateNow() {
    runValidation()
    update()
  }

  function validateOnChange() {
    let mode = getMode()
    if (mode === 'onChange') {
      let delay = handle.props.validationDebounceTime ?? 0
      if (delay > 0) {
        clearTimeout(debounceTimer)
        debounceTimer = setTimeout(validateNow, delay)
        return
      }
      runValidation()
    } else if (mode === 'onSubmit' ? submitted : validity.state.valid === false) {
      runValidation()
    }
  }

  let context: FieldContextValue = {
    get name() {
      return handle.props.name
    },
    get disabled() {
      return getDisabled()
    },
    get touched() {
      return getState().touched
    },
    get dirty() {
      return getDirty()
    },
    get valid() {
      return getValid()
    },
    get filled() {
      return getState().filled
    },
    get focused() {
      return focused
    },
    get state() {
      return getState()
    },
    get validity() {
      return getValidity()
    },
    get validationMode() {
      return getMode()
    },
    get controlId() {
      return controlIdOverride ?? defaultControlId
    },
    get labelId() {
      return labels[0]?.id
    },
    validate: validateNow,
  }

  function describedByIds(): string | undefined {
    let ids = descriptions.map((entry) => entry.id)
    for (let entry of errorParts) {
      if (errorVisible(entry.match)) ids.push(entry.id)
    }
    return ids.length > 0 ? ids.join(' ') : undefined
  }

  function errorVisible(match: FieldErrorMatch | undefined): boolean {
    if (match === true) return true
    if (match === false) return false
    let valid = getValid()
    if (match === undefined) return valid === false
    if (match === 'valid') return valid === true
    return valid === false && getValidity().state[match] === true
  }

  let internals: FieldInternals = {
    fieldId,
    update,
    scheduleUpdate,
    nextPartId(kind) {
      let count = ++partCounts[kind]
      return `${fieldId}-${kind}${count > 1 ? `-${count}` : ''}`
    },
    registerPart(kind, entry) {
      let list = kind === 'label' ? labels : kind === 'description' ? descriptions : errorParts
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
    errorVisible,
    focusControl() {
      getFocusElement()?.focus()
    },
    nativeInvalid(target) {
      let element = getValidityElement()
      if (element && target !== element) return
      submitted = true
      runValidation()
      update()
    },
    connect(entry, entrySignal) {
      controls.push(entry)
      let unregister = () => {
        let index = controls.indexOf(entry)
        if (index !== -1) controls.splice(index, 1)
      }
      entrySignal.addEventListener('abort', unregister)
      return unregister
    },
    reportValue(next, from, initialOnly) {
      if (initialOnly && hasValue) return
      reportValue(next, from)
    },
    render(input, from) {
      if (input.id !== controlIdOverride) {
        controlIdOverride = input.id
        scheduleUpdate(from)
      }
      if (input.value !== undefined) reportValue(input.value, from)

      let state = getState()
      state.disabled ||= input.disabled === true
      let id = input.id ?? defaultControlId
      let describedBy = describedByIds()
      let invalid = state.valid === false
      let dataAttrs = fieldStateAttrs(state)
      return {
        inField: true,
        id,
        labelId: labels[0]?.id,
        describedBy,
        name: handle.props.name ?? input.name,
        disabled: state.disabled,
        invalid,
        state,
        dataAttrs,
        attrs: {
          ...dataAttrs,
          id,
          'aria-describedby': describedBy,
          'aria-invalid': invalid ? 'true' : undefined,
        },
      }
    },
    focus() {
      if (focused) return
      focused = true
      update()
    },
    blur() {
      focused = false
      touchedState = true
      if (getMode() === 'onBlur') runValidation()
      update()
    },
    change(next) {
      if (!hasValue) {
        initialValue = next
        hasValue = true
      }
      value = next
      form?._clearErrors(handle.props.name)
      validateOnChange()
      update()
    },
  }

  /** Render-time value report: no update now, re-render later when derived state changed. */
  function reportValue(next: unknown, from: TaskQueue) {
    if (!hasValue) {
      hasValue = true
      initialValue = next
      value = next
      if (isFilled(next)) scheduleUpdate(from)
      return
    }
    if (sameValue(next, value)) return
    let before = getState()
    value = next
    let after = getState()
    if (before.filled !== after.filled || before.dirty !== after.dirty) scheduleUpdate(from)
  }

  if (form) {
    let unregisterForm = form._register({
      get name() {
        return handle.props.name
      },
      getValue: readValue,
      validate: validateNow,
      submit() {
        submitted = true
        let valid = runValidation()
        update()
        return valid
      },
      getValidityElement,
      getFocusElement,
    })
    signal.addEventListener('abort', unregisterForm)
  }

  internalsByContext.set(context, internals)
  handle.context.set(context)

  return () => {
    assignActionsRef(handle.props.actionsRef, { validate: validateNow })
    return handle.props.children
  }
}

// ---------------------------------------------------------------------------------------------
// connectFieldControl
// ---------------------------------------------------------------------------------------------

type AnyHandle = MixinHandle<EventTarget, any> | Handle<any, any>

function isMixinHandle(handle: AnyHandle): handle is MixinHandle<EventTarget, any> {
  return typeof (handle as MixinHandle).addEventListener === 'function'
}

/**
 * Connects a form control to the enclosing `<field.Context>`. Call once during setup (mixin or
 * Context provider), then call `render()` in every render and report `focus()` / `blur()` /
 * `change()` from event handlers. Inert outside a Field (except that `disabled` follows an
 * enclosing `fieldset.Context`). See the module documentation for the full contract.
 */
export function connectFieldControl(
  handle: AnyHandle,
  options: FieldControlOptions = {},
): FieldControl {
  let field = handle.context.get(FieldProvider) as FieldContextValue | undefined
  let fieldset = handle.context.get(FieldsetProvider) as FieldsetContextValue | undefined
  let internals = field ? getFieldInternals(field) : undefined
  let signal = handle.signal
  let node: Element | null = null
  let queue: TaskQueue = handle as TaskQueue

  if (isMixinHandle(handle)) {
    handle.addEventListener('insert', (event) => {
      node = event.node as Element
      // A value the control never reported (e.g. a <select> without one) is read from the node.
      if (internals) {
        let read = options.getValue?.() ?? (node as { value?: unknown }).value
        if (read !== undefined) internals.reportValue(read, queue, true)
      }
    })
    handle.addEventListener('remove', () => {
      node = null
    })
  }

  internals?.connect({ options, getNode: () => node }, signal)

  return {
    inField: field !== undefined,
    field,
    render(input = {}) {
      if (internals) return internals.render(input, queue)
      let disabled = input.disabled === true || fieldset?.disabled === true
      let state: FieldState = {
        disabled,
        touched: input.local?.touched ?? false,
        dirty: input.local?.dirty ?? false,
        valid: input.local?.valid ?? null,
        filled: input.local?.filled ?? false,
        focused: input.local?.focused ?? false,
      }
      let dataAttrs = fieldStateAttrs(state)
      return {
        inField: false,
        id: input.id,
        labelId: undefined,
        describedBy: undefined,
        name: input.name,
        disabled,
        invalid: state.valid === false,
        state,
        dataAttrs,
        attrs: { ...dataAttrs },
      }
    },
    focus() {
      internals?.focus()
    },
    blur() {
      internals?.blur()
    },
    change(value) {
      internals?.change(value)
    },
    validate() {
      field?.validate()
    },
  }
}
