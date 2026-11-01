// Shared internals for controls that pair a custom root (`<span>` or `<button>`) with a visually
// hidden native `<input>` for form participation: switch, checkbox, and radio.
// Parts of this file are adapted from @remix-run/ui 0.13.0 (packages/ui/src/toggle.ts).
// https://github.com/remix-run/remix - Copyright (c) 2025 Shopify Inc. MIT License.

import { createElement, on, ref } from '@remix-run/component'
import type { RemixNode } from '@remix-run/component'

import type { FieldStateAttrs } from './field-control.ts'

// Mirrors Base UI's visually hidden input: still focusable by the browser for validation, but
// invisible and removed from the accessibility tree.
export const hiddenInputStyle = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  margin: '-1px',
  padding: '0',
  border: '0',
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
  pointerEvents: 'none',
} as const

export interface HiddenInputOptions {
  type: 'checkbox' | 'radio'
  id?: string
  name?: string
  value?: string
  form?: string
  checked: boolean
  disabled: boolean
  required: boolean
  /** Disabled or read-only: clicks on the input are cancelled so its checked state is restored. */
  isInert(): boolean
  /** Receives the mounted input and a signal aborted when it is removed. */
  bindInput(node: HTMLInputElement, signal: AbortSignal): void
  inputRef?: (input: HTMLInputElement, signal: AbortSignal) => void
  onChange(event: Event & { currentTarget: HTMLInputElement }): void
  /** The element that should receive focus when the hidden input is focused. */
  getFocusTarget(): HTMLElement | undefined
}

/**
 * Renders the visually hidden native input. Activating the custom root clicks this input, so
 * native `input`/`change` events fire for forms and `FormData` sees the control.
 */
export function renderHiddenInput(options: HiddenInputOptions): RemixNode {
  let props: Record<string, unknown> = {
    type: options.type,
    checked: options.checked,
    disabled: options.disabled || undefined,
    required: options.required || undefined,
    'aria-hidden': 'true',
    tabIndex: -1,
    style: hiddenInputStyle,
  }
  // `value: undefined` would make Remix clear the input's value, so only pass defined keys.
  if (options.id !== undefined) props.id = options.id
  if (options.name !== undefined) props.name = options.name
  if (options.value !== undefined) props.value = options.value
  if (options.form !== undefined) props.form = options.form

  return createElement('input', {
    ...props,
    mix: [
      ref((node: HTMLInputElement, signal) => {
        options.bindInput(node, signal)
        options.inputRef?.(node, signal)
      }),
      on<HTMLInputElement, 'click'>('click', (event) => {
        // Checkboxes and radios ignore `readonly`; cancelling the click restores the state.
        if (options.isInert()) event.preventDefault()
      }),
      on<HTMLInputElement, 'change'>('change', (event) => {
        options.onChange(event)
      }),
      on<HTMLInputElement, 'focus'>('focus', () => {
        // Browser validation (and some label clicks) focus the hidden input.
        options.getFocusTarget()?.focus()
      }),
    ],
  })
}

/** Renders the `<input type="hidden">` that submits `uncheckedValue` while unchecked. */
export function renderUncheckedValueInput(options: {
  checked: boolean
  name: string | undefined
  uncheckedValue: string | undefined
  form: string | undefined
  disabled: boolean
}): RemixNode {
  let { checked, name, uncheckedValue, form, disabled } = options
  if (checked || uncheckedValue === undefined || name === undefined) return null
  return createElement('input', {
    type: 'hidden',
    name,
    value: uncheckedValue,
    form,
    disabled: disabled || undefined,
  })
}

/**
 * A non-button root is not labelable, so a wrapping `<label>` (or `<label for>` pointing at the
 * hidden input) does not name it. Returns the id of the hidden input's label, generating one from
 * `fallbackId` when the label has none, or `undefined` when there is no label or the root is a
 * `<button>` (which its label names natively).
 */
export function resolveLabelId(
  root: HTMLElement | undefined,
  input: HTMLInputElement | undefined,
  fallbackId: string,
): string | undefined {
  if (!root || !input || root.localName === 'button') return undefined
  let label = input.labels?.[0]
  if (!label) return undefined
  if (!label.id) label.id = fallbackId
  return label.id
}

/**
 * Keyboard activation for non-button roots. Space activates on keyup (like a native button) and
 * its keydown is cancelled to prevent page scroll. With `enter: true`, Enter activates on
 * keydown; otherwise Enter is left alone.
 */
export function activationKeys(options: {
  enter: boolean
}): [ReturnType<typeof on<HTMLElement, 'keydown'>>, ReturnType<typeof on<HTMLElement, 'keyup'>>] {
  return [
    on<HTMLElement, 'keydown'>('keydown', (event) => {
      if (event.target !== event.currentTarget) return
      if (event.key === ' ') {
        event.preventDefault()
      } else if (options.enter && event.key === 'Enter') {
        event.preventDefault()
        event.currentTarget.click()
      }
    }),
    on<HTMLElement, 'keyup'>('keyup', (event) => {
      if (event.target !== event.currentTarget || event.key !== ' ') return
      event.currentTarget.click()
    }),
  ]
}

/**
 * Reports a user change to the field while making `current()` return the new value, so the
 * field's validation sees it even before a controlled owner re-rendered.
 */
export function createFieldChange<value>(): {
  read(current: () => value): value
  report(control: { change(value: unknown, event?: Event): void }, next: value, event?: Event): void
} {
  let pending: { value: value } | undefined
  return {
    read: (current) => (pending ? pending.value : current()),
    report(control, next, event) {
      pending = { value: next }
      try {
        control.change(next, event)
      } finally {
        pending = undefined
      }
    },
  }
}

/** Present-or-absent data attribute value. */
export function flag(value: boolean): '' | undefined {
  return value ? '' : undefined
}

/**
 * What a checkable root renders from the field it belongs to: the field's own wiring for a
 * standalone switch or checkbox, or a `field.ItemContext`'s label and descriptions plus the
 * group's field state for a checkbox or radio in a group.
 */
export interface CheckableField {
  /** The field (or field item) label's id. */
  labelId: string | undefined
  describedBy: string | undefined
  invalid: boolean
  dataAttrs: FieldStateAttrs
}

/** Outside a Field. */
export const NO_FIELD: CheckableField = {
  labelId: undefined,
  describedBy: undefined,
  invalid: false,
  dataAttrs: {},
}

/**
 * Field attributes for a checkable root or one of its parts: the field state data attributes
 * (except `data-disabled`, which the control renders from its own disabled state), and on the
 * root `aria-describedby` / `aria-invalid`.
 */
export function checkableFieldAttrs(
  field: CheckableField,
  options: { root: boolean; ariaInvalid?: boolean },
): Record<string, string | undefined> {
  let { 'data-disabled': _disabled, ...data } = field.dataAttrs
  if (!options.root) return { ...data }
  return {
    ...data,
    'aria-describedby': field.describedBy,
    'aria-invalid': options.ariaInvalid !== false && field.invalid ? 'true' : undefined,
  }
}

/**
 * The `aria-labelledby` of a checkable root: the field (or item) label, else (for a non-button
 * root) the hidden input's label, unless the host names itself.
 */
export function checkableLabelledBy(options: {
  isButton: boolean
  hasName: boolean
  fieldLabelId: string | undefined
  inputLabelId: string | undefined
}): string | undefined {
  if (options.hasName) return undefined
  // A field label points at the hidden input (`for`), so it names a <button> root only through
  // `aria-labelledby` too.
  if (options.fieldLabelId !== undefined) return options.fieldLabelId
  return options.isButton ? undefined : options.inputLabelId
}

/**
 * Whether focus moving to `related` stays inside a composite control made of `nodes` (and their
 * descendants).
 */
export function focusStaysInside(
  related: EventTarget | null,
  nodes: Iterable<Element | null | undefined>,
): boolean {
  if (!(related instanceof Node)) return false
  for (let node of nodes) {
    if (node && (node === related || node.contains(related))) return true
  }
  return false
}
