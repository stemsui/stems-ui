/**
 * `stems-ui/toolbar`: Base UI's Toolbar as a `Context` provider plus mixins. The state and the
 * keyboard handling live in `lib/toolbar.ts`.
 *
 * Every focusable control in the toolbar is a toolbar item sharing one roving tab stop. The
 * `button()`, `link()`, and `input()` parts are items; `item()` turns any other element (a
 * toggle button, a menu or select trigger, a number field input, ...) into one. Put the toolbar
 * mixin first in `mix` so its `tabIndex` wins over the composed widget's.
 */

import { attrs, createMixin, on, ref } from '@remix-run/component'
import type { ElementProps, MixinFactory, MixinHandle } from '@remix-run/component'

import { button as buttonMixin } from './button.ts'
import { flag } from './lib/checkable.ts'
import { splitOptions } from './lib/collapsible-panel.ts'
import {
  getToolbar,
  getToolbarGroup,
  ToolbarContext,
  ToolbarGroupContext,
  type ToolbarContextValue,
  type ToolbarItemEntry,
} from './lib/toolbar.ts'
import { separator as separatorMixin, type SeparatorOrientation } from './separator.ts'

export type {
  ToolbarContextProps,
  ToolbarContextValue,
  ToolbarGroupContextProps,
  ToolbarGroupContextValue,
  ToolbarOrientation,
} from './lib/toolbar.ts'

/** Options for `toolbar.item()` (Base UI's `Toolbar.Root.ItemMetadata`). */
export interface ToolbarItemOptions {
  /**
   * Whether the item is disabled. Only affects keyboard navigation: also disable the composed
   * widget itself (or use `toolbar.button()`, which does both). The toolbar's and the group's
   * `disabled` apply too.
   * @default false
   */
  disabled?: boolean
  /**
   * Whether the item stays in the arrow-key order while disabled. Natively disabled elements
   * (`:disabled`) are always skipped.
   * @default true
   */
  focusableWhenDisabled?: boolean
}

/** Options for `toolbar.button()` (Base UI `Toolbar.Button` props). */
export interface ToolbarButtonOptions {
  /**
   * Whether the button ignores user interaction. The toolbar's and the group's `disabled` apply
   * too.
   * @default false
   */
  disabled?: boolean
  /**
   * Whether the button stays focusable (and in the arrow-key order) when disabled. It then gets
   * `aria-disabled` instead of the native `disabled` attribute, and activation is blocked.
   * @default true
   */
  focusableWhenDisabled?: boolean
  /**
   * Whether the host is a native `<button>`. Non-native hosts get `role="button"` and Enter /
   * Space activation.
   * @default true when the host is a `<button>`
   */
  nativeButton?: boolean
}

/** Options for `toolbar.input()` (Base UI `Toolbar.Input` props). */
export interface ToolbarInputOptions {
  /**
   * Whether the input is disabled. The toolbar's and the group's `disabled` apply too.
   * @default false
   */
  disabled?: boolean
  /**
   * Whether the input stays focusable when disabled. It then gets `aria-disabled` and `readOnly`
   * instead of the native `disabled` attribute.
   * @default true
   */
  focusableWhenDisabled?: boolean
}

/** Options for `toolbar.separator()` (Base UI `Toolbar.Separator` props). */
export interface ToolbarSeparatorOptions {
  /**
   * The separator's orientation. Defaults to the opposite of the toolbar's, so a horizontal
   * toolbar has vertical separators.
   */
  orientation?: SeparatorOrientation
}

/**
 * Provider that owns the toolbar state (Base UI `Toolbar.Root` props): `orientation` (default
 * `'horizontal'`), `loopFocus` (default `true`), `disabled`.
 */
export const Context = ToolbarContext

/**
 * Provider for a group's `disabled` state (Base UI `Toolbar.Group`'s `disabled` prop). A mixin
 * can't pass state to the items inside its element, so wrap the `group()` element in it.
 */
export const GroupContext = ToolbarGroupContext

function requireToolbar(handle: MixinHandle<any, any>, part: string): ToolbarContextValue {
  let context = getToolbar(handle)
  if (!context) throw new Error(`toolbar.${part}() must be rendered inside <toolbar.Context>`)
  return context
}

/**
 * Registers a toolbar item and returns its per-render descriptors: the roving `tabIndex`,
 * `data-orientation`, the node reference, and the focus listener that moves the tab stop.
 */
function createItem(handle: MixinHandle<HTMLElement, ElementProps>, part: string) {
  let toolbar = requireToolbar(handle, part)
  let group = getToolbarGroup(handle)
  let entry: ToolbarItemEntry = { node: null, disabled: false, focusableWhenDisabled: true }
  toolbar._register(entry, handle.signal)

  return {
    toolbar,
    /** The toolbar's or group's `disabled` combined with the item's own. */
    disabled(own: boolean | undefined) {
      return own === true || toolbar.disabled || group?.disabled === true
    },
    render(state: { disabled: boolean; focusableWhenDisabled: boolean }) {
      entry.disabled = state.disabled
      entry.focusableWhenDisabled = state.focusableWhenDisabled
      return [
        attrs({
          tabIndex: toolbar._isTabbable(entry) ? 0 : -1,
          'data-orientation': toolbar.orientation,
        }),
        ref((node: HTMLElement, signal) => {
          entry.node = node
          signal.addEventListener('abort', () => {
            if (entry.node === node) entry.node = null
          })
        }),
        on<HTMLElement, 'focus'>('focus', () => toolbar._setActive(entry)),
      ]
    },
  }
}

const rootMixin: MixinFactory<HTMLElement, [], ElementProps> = createMixin<
  HTMLElement,
  [],
  ElementProps
>((handle) => {
  let toolbar = requireToolbar(handle, 'root')

  return () => [
    attrs({
      role: 'toolbar',
      'aria-orientation': toolbar.orientation,
      'data-orientation': toolbar.orientation,
      'data-disabled': flag(toolbar.disabled),
    }),
    on<HTMLElement, 'keydown'>('keydown', (event) => toolbar._onKeyDown(event)),
  ]
})

const itemMixin: MixinFactory<HTMLElement, [options?: ToolbarItemOptions], ElementProps> =
  createMixin<HTMLElement, [options?: ToolbarItemOptions], ElementProps>((handle) => {
    let item = createItem(handle, 'item')
    return (options, props) => {
      ;[options] = splitOptions(options, props)
      let opts = options ?? {}
      return item.render({
        disabled: item.disabled(opts.disabled),
        focusableWhenDisabled: opts.focusableWhenDisabled ?? true,
      })
    }
  })

const buttonPartMixin: MixinFactory<HTMLElement, [options?: ToolbarButtonOptions], ElementProps> =
  createMixin<HTMLElement, [options?: ToolbarButtonOptions], ElementProps>((handle) => {
    let item = createItem(handle, 'button')
    return (options, props) => {
      ;[options] = splitOptions(options, props)
      let opts = options ?? {}
      let disabled = item.disabled(opts.disabled)
      let focusableWhenDisabled = opts.focusableWhenDisabled ?? true
      return [
        attrs({ 'data-focusable': flag(focusableWhenDisabled) }),
        item.render({ disabled, focusableWhenDisabled }),
        buttonMixin({ disabled, focusableWhenDisabled, nativeButton: opts.nativeButton }),
      ]
    }
  })

const linkMixin: MixinFactory<HTMLElement, [], ElementProps> = createMixin<
  HTMLElement,
  [],
  ElementProps
>((handle) => {
  let item = createItem(handle, 'link')
  // Links can't be disabled (Base UI).
  return () => item.render({ disabled: false, focusableWhenDisabled: true })
})

const inputMixin: MixinFactory<HTMLElement, [options?: ToolbarInputOptions], ElementProps> =
  createMixin<HTMLElement, [options?: ToolbarInputOptions], ElementProps>((handle) => {
    let item = createItem(handle, 'input')
    return (options, props) => {
      ;[options] = splitOptions(options, props)
      let opts = options ?? {}
      let disabled = item.disabled(opts.disabled)
      let focusableWhenDisabled = opts.focusableWhenDisabled ?? true
      let focusable = disabled && focusableWhenDisabled
      function preventWhenDisabled(event: Event) {
        if (disabled) event.preventDefault()
      }
      return [
        attrs({
          disabled: disabled && !focusableWhenDisabled ? true : undefined,
          readOnly: focusable ? true : undefined,
          'aria-disabled': focusable ? 'true' : undefined,
          'data-disabled': flag(disabled),
          'data-focusable': flag(focusableWhenDisabled),
        }),
        item.render({ disabled, focusableWhenDisabled }),
        on<HTMLElement, 'click'>('click', preventWhenDisabled),
        on<HTMLElement, 'pointerdown'>('pointerdown', preventWhenDisabled),
      ]
    }
  })

const groupMixin: MixinFactory<HTMLElement, [], ElementProps> = createMixin<
  HTMLElement,
  [],
  ElementProps
>((handle) => {
  let toolbar = requireToolbar(handle, 'group')
  let group = getToolbarGroup(handle)
  return () =>
    attrs({
      role: 'group',
      'data-orientation': toolbar.orientation,
      'data-disabled': flag(group?.disabled ?? toolbar.disabled),
    })
})

const separatorPartMixin: MixinFactory<
  HTMLElement,
  [options?: ToolbarSeparatorOptions],
  ElementProps
> = createMixin<HTMLElement, [options?: ToolbarSeparatorOptions], ElementProps>((handle) => {
  let toolbar = requireToolbar(handle, 'separator')
  return (options, props) => {
    ;[options] = splitOptions(options, props)
    let orientation =
      options?.orientation ?? (toolbar.orientation === 'vertical' ? 'horizontal' : 'vertical')
    return separatorMixin({ orientation })
  }
})

/**
 * The toolbar element: `role="toolbar"`, `aria-orientation`, `data-orientation`,
 * `data-disabled`. Handles the arrow keys (mirrored in RTL), Home, and End for its items.
 */
export const root = rootMixin

/**
 * Makes any element a toolbar item: one roving tab stop, arrow-key navigation, and
 * `data-orientation`. Compose it with another widget's mixin, placed first:
 * `mix={[toolbar.item(), toggleButton({ value: 'bold' })]}`. Options: `disabled`,
 * `focusableWhenDisabled` (default `true`).
 */
export const item = itemMixin

/**
 * A toolbar button (the `stems-ui/button` behavior as a toolbar item). Disabled buttons stay
 * focusable by default (`aria-disabled`). Compose it with a trigger to put a popup in the
 * toolbar: `mix={[toolbar.button(), menu.trigger()]}`. Sets `data-orientation`,
 * `data-disabled`, and `data-focusable`.
 */
export const button = buttonPartMixin

/** A toolbar link (`<a href>`): a toolbar item with `data-orientation`. */
export const link = linkMixin

/**
 * A native `<input>` as a toolbar item. The arrow keys move the caret and only leave the input
 * from its start or end. Sets `data-orientation`, `data-disabled`, `data-focusable`.
 */
export const input = inputMixin

/**
 * Groups related items: `role="group"`, `data-orientation`, `data-disabled`. Wrap it in
 * `<toolbar.GroupContext disabled>` to disable the items inside.
 */
export const group = groupMixin

/**
 * A separator (`stems-ui/separator`) perpendicular to the toolbar by default. Sets
 * `data-orientation`.
 */
export const separator = separatorPartMixin
