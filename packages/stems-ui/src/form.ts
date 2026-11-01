import { createMixin, on, ref } from '@remix-run/component'
import type {
  Dispatched,
  ElementProps,
  Handle,
  MixinFactory,
  MixinHandle,
  RemixNode,
} from '@remix-run/component'

// Type-only: `lib/field-control.ts` imports this module at runtime, not the other way around.
import type { ActionsRef, FieldValidationMode } from './lib/field-control.ts'

export type { FieldValidationMode as FormValidationMode } from './lib/field-control.ts'

const FORM_SUBMIT_EVENT = 'stems:form-submit' as const

/**
 * Errors returned externally (typically by a server action), keyed by the `name` of a
 * `<field.Context>`. A field shows its errors until its value changes.
 */
export type FormErrors = Record<string, string | string[] | null | undefined>

/** Values of the named fields in the form, keyed by field name. */
export type FormValues = Record<string, unknown>

export interface FormSubmitEventDetails {
  /** Base UI's change reason. Always `'none'`. */
  reason: 'none'
  /** The native `submit` event. */
  event: SubmitEvent | Event
}

/** Imperative actions, passed to `actionsRef`. */
export interface FormActions {
  /** Validates every field, or only the fields named `name`, and shows their errors. */
  validate(name?: string): void
}

/** Props for `<form.Context>`. They match Base UI's `Form` props. */
export interface FormContextProps {
  children?: RemixNode
  /**
   * Errors returned externally, typically after a submission handled by the server. Keys are
   * `<field.Context name>` values. A field's errors are cleared once its value changes, and all
   * are restored when a new `errors` object is passed.
   */
  errors?: FormErrors
  /** Called with the remaining errors when a field clears its external errors by changing. */
  onClearErrors?: (errors: FormErrors) => void
  /**
   * When fields validate. `<field.Context validationMode>` takes precedence.
   * - `'onSubmit'`: on submit, then on every change once the form was submitted.
   * - `'onBlur'`: when the control loses focus.
   * - `'onChange'`: on every change.
   * @default 'onSubmit'
   */
  validationMode?: FieldValidationMode
  /**
   * Called with the named fields' values when a valid form is submitted. Providing it calls
   * `preventDefault()` on the native submit event, so the browser (and Remix navigation) does
   * not submit the form.
   */
  onFormSubmit?: (values: FormValues, details: FormSubmitEventDetails) => void
  /** Receives the form's imperative actions (an object ref or a callback). */
  actionsRef?: ActionsRef<FormActions>
}

/** State provided by `<form.Context>`, readable with `handle.context.get(form.Context)`. */
export interface FormContextValue {
  /** External errors that are still shown (not cleared by an edit). */
  readonly errors: FormErrors
  readonly validationMode: FieldValidationMode
  /** Whether the user tried to submit the form. */
  readonly submitAttempted: boolean
  /** Validates every field (or the fields named `name`) and shows their errors. */
  validate(name?: string): void
  /** Values of the named fields. */
  getValues(): FormValues
  /** @internal Fields register here. */
  _register(entry: FormFieldEntry): () => void
  /** @internal External errors for a field name that have not been cleared. */
  _getErrors(name: string | undefined): string[] | null
  /** @internal Clears a field's external errors after its value changed. */
  _clearErrors(name: string | undefined): void
}

/** @internal What `<field.Context>` registers with an enclosing form. */
export interface FormFieldEntry {
  readonly name: string | undefined
  getValue(): unknown
  /** Validates and shows the result. */
  validate(): void
  /** Validates for a submission. Returns `false` when the field is known to be invalid. */
  submit(): boolean
  /** The element whose native validity the field reads (to tell it apart from plain controls). */
  getValidityElement(): Element | null
  /** The element to focus when the field is the first invalid one. */
  getFocusElement(): HTMLElement | null
}

/**
 * Bubbling event dispatched from the form (`stems:form-submit`) when a valid submission passes
 * validation, before the browser (or Remix) submits it.
 */
export class FormSubmitEvent extends Event {
  readonly values: FormValues

  constructor(values: FormValues) {
    super(FORM_SUBMIT_EVENT, { bubbles: true })
    this.values = values
  }
}

declare global {
  interface HTMLElementEventMap {
    [FORM_SUBMIT_EVENT]: FormSubmitEvent
  }
}

type FormSubmitHandler<target extends HTMLElement> = (
  event: Dispatched<FormSubmitEvent, target>,
  signal: AbortSignal,
) => void | Promise<void>

/** @internal */
export function normalizeErrors(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item) => typeof item === 'string' && item !== '')
  return typeof value === 'string' && value !== '' ? [value] : []
}

/** @internal */
export function assignActionsRef<actions>(target: ActionsRef<actions> | undefined, value: actions) {
  if (!target) return
  if (typeof target === 'function') target(value)
  else target.current = value
}

type ValidatableElement = Element & {
  willValidate: boolean
  validity: ValidityState
  reportValidity(): boolean
}

function isValidatable(element: Element): element is ValidatableElement {
  return 'validity' in element && 'willValidate' in element
}

function byDocumentOrder(a: Element, b: Element) {
  if (a === b) return 0
  return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
}

interface FormInternals {
  submit(event: SubmitEvent): void
}

const internalsByContext = new WeakMap<FormContextValue, FormInternals>()

function FormProvider(handle: Handle<FormContextProps, FormContextValue>): () => RemixNode {
  let fields = new Set<FormFieldEntry>()
  let clearedNames = new Set<string>()
  let lastErrors: FormErrors | undefined
  let submitAttempted = false

  function syncErrors() {
    if (handle.props.errors !== lastErrors) {
      lastErrors = handle.props.errors
      clearedNames = new Set()
    }
  }

  function getErrors(): FormErrors {
    syncErrors()
    let result: FormErrors = {}
    for (let [name, value] of Object.entries(handle.props.errors ?? {})) {
      if (!clearedNames.has(name) && normalizeErrors(value).length > 0) result[name] = value
    }
    return result
  }

  function getValues(): FormValues {
    let values: FormValues = {}
    for (let field of fields) {
      if (field.name !== undefined) values[field.name] = field.getValue()
    }
    return values
  }

  function validate(name?: string) {
    for (let field of fields) {
      if (name === undefined || field.name === name) field.validate()
    }
  }

  let context: FormContextValue = {
    get errors() {
      return getErrors()
    },
    get validationMode() {
      return handle.props.validationMode ?? 'onSubmit'
    },
    get submitAttempted() {
      return submitAttempted
    },
    validate,
    getValues,
    _register(entry) {
      fields.add(entry)
      return () => fields.delete(entry)
    },
    _getErrors(name) {
      if (name === undefined) return null
      syncErrors()
      if (clearedNames.has(name)) return null
      let errors = normalizeErrors(handle.props.errors?.[name])
      return errors.length > 0 ? errors : null
    },
    _clearErrors(name) {
      if (name === undefined || !context._getErrors(name)) return
      clearedNames.add(name)
      handle.props.onClearErrors?.(getErrors())
    },
  }

  internalsByContext.set(context, {
    submit(event) {
      submitAttempted = true
      let form = event.currentTarget as HTMLFormElement
      let invalid: HTMLElement[] = []
      let owned = new Set<Element>()

      for (let field of fields) {
        let element = field.getValidityElement()
        if (element) owned.add(element)
        if (!field.submit()) {
          let target = field.getFocusElement()
          if (target) invalid.push(target)
        }
      }

      // `novalidate` also turns off native validation for controls that are not in a Field.
      // Keep it for them: they block the submission and show the browser's message.
      let native = [...form.elements].filter(
        (element): element is ValidatableElement & HTMLElement =>
          !owned.has(element) &&
          isValidatable(element) &&
          element.willValidate &&
          !element.validity.valid,
      )

      if (invalid.length > 0 || native.length > 0) {
        event.preventDefault()
        // Submit listeners mixed in after `form.root()` only see valid submissions.
        event.stopImmediatePropagation()
        let first: HTMLElement = [...invalid, ...native].sort(byDocumentOrder)[0]!
        let firstNative = native.find((element) => element === first)
        if (firstNative) firstNative.reportValidity()
        else first.focus()
        return
      }

      let values = getValues()
      form.dispatchEvent(new FormSubmitEvent(values))
      if (handle.props.onFormSubmit) {
        event.preventDefault()
        handle.props.onFormSubmit(values, { reason: 'none', event })
      }
    },
  })

  handle.context.set(context)

  return () => {
    syncErrors()
    assignActionsRef(handle.props.actionsRef, { validate })
    return handle.props.children
  }
}

function getForm(handle: MixinHandle<HTMLFormElement, ElementProps>) {
  let context = handle.context.get(FormProvider) as FormContextValue | undefined
  if (!context) throw new Error('form.root() must be rendered inside <form.Context>')
  return internalsByContext.get(context)!
}

const rootMixin: MixinFactory<HTMLFormElement, [], ElementProps> = createMixin<
  HTMLFormElement,
  [],
  ElementProps
>((handle) => {
  let internals = getForm(handle)

  return (props) => {
    let explicitNoValidate =
      props.noValidate !== undefined || (props as Record<string, unknown>).novalidate !== undefined
    return [
      // Not rendered on the server: without JavaScript the browser's own constraint validation
      // still guards the submission. Once hydrated, Stems validates and shows field errors.
      ref((node: HTMLFormElement) => {
        if (!explicitNoValidate) node.noValidate = true
      }),
      // Capture: at the target, capture listeners run before bubbling ones, so an invalid
      // submission is stopped before any `on('submit')` the app mixes in.
      on<HTMLFormElement, 'submit'>('submit', (event) => internals.submit(event), true),
    ]
  }
})

/**
 * Provider that owns form-wide validation: the fields registered inside it, external `errors`,
 * the default `validationMode`, and `onFormSubmit`. Base UI's `Form` props live here.
 */
export const Context = FormProvider

/**
 * Wires a native `<form>`: validates every field on submit, blocks invalid submissions
 * (`preventDefault()`), and focuses the first invalid control. Sets `noValidate` after
 * hydration only, so the form still validates natively and submits without JavaScript.
 */
export const root = rootMixin

/** Listens for `stems:form-submit`, dispatched when a submission passes validation. */
export function onFormSubmit<target extends HTMLElement>(
  handler: FormSubmitHandler<target>,
  captureBoolean?: boolean,
): ReturnType<typeof on<target, typeof FORM_SUBMIT_EVENT>> {
  return on(FORM_SUBMIT_EVENT, handler, captureBoolean)
}
