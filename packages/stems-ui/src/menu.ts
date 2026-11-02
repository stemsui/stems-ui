// Adapted from @remix-run/ui 0.13.0 (packages/ui/src/menu.tsx).
// https://github.com/remix-run/remix - Copyright (c) 2025 Shopify Inc. MIT License.

/**
 * `stems-ui/menu`: Base UI's Menu as a `Context` provider plus mixins. The implementation lives
 * in `lib/menu.tsx` and is shared with `stems-ui/context-menu`.
 */

import type { MenuHandle } from './lib/menu.tsx'
import {
  createMenuHandle,
  CheckboxItemContext as CheckboxItemProvider,
  EmptyText as EmptyTextComponent,
  filterClear,
  filterEmpty,
  filterInput,
  list as listMixin,
  MenuContext,
  RadioGroupContext as RadioGroupProvider,
  RadioItemContext as RadioItemProvider,
  SubmenuContext as SubmenuProvider,
  arrow as arrowMixin,
  backdrop as backdropMixin,
  checkboxItem as checkboxItemMixin,
  checkboxItemIndicator as checkboxItemIndicatorMixin,
  group as groupMixin,
  groupLabel as groupLabelMixin,
  item as itemMixin,
  linkItem as linkItemMixin,
  popup as popupMixin,
  radioGroup as radioGroupMixin,
  radioItem as radioItemMixin,
  radioItemIndicator as radioItemIndicatorMixin,
  separator as separatorMixin,
  submenuTrigger as submenuTriggerMixin,
  trigger as triggerMixin,
} from './lib/menu.tsx'
import { MenuFilterProvider } from './lib/menu-filter.ts'

export {
  MenuFilterChangeEvent,
  onMenuFilterChange,
  type MenuFilterChangeDetails,
  type MenuFilterChangeReason,
  type MenuFilterContextValue,
  type MenuFilterFunction,
  type MenuFilterProviderProps,
} from './lib/menu-filter.ts'

export { containsText, startsWithText } from './lib/text-filter.ts'

export {
  MenuChangeEvent,
  MenuSelectEvent,
  onMenuChange,
  onMenuSelect,
  type CheckboxItemContextProps,
  type CheckboxItemContextValue,
  type MenuCheckboxItemOptions,
  type MenuEmptyTextProps,
  type MenuFilterClearOptions,
  type MenuContextProps,
  type MenuContextValue,
  type MenuHandle,
  type MenuHighlightDetails,
  type MenuHighlightReason,
  type MenuIndicatorOptions,
  type MenuItemChangeDetails,
  type MenuItemKind,
  type MenuItemOptions,
  type MenuLinkItemOptions,
  type MenuOrientation,
  type MenuPopupOptions,
  type MenuRadioItemOptions,
  type MenuSelectEventInit,
  type MenuTriggerOptions,
  type RadioGroupContextProps,
  type RadioGroupContextValue,
  type RadioItemContextProps,
  type RadioItemContextValue,
  type SubmenuContextProps,
  type SubmenuTriggerOptions,
} from './lib/menu.tsx'

export type {
  PopupAlign as MenuAlign,
  PopupAnchor as MenuAnchor,
  PopupFocusTarget as MenuFocusTarget,
  PopupInteractionType as MenuInteractionType,
  PopupModal as MenuModal,
  PopupOffsetFunction as MenuOffsetFunction,
  PopupOpenChangeDetails as MenuOpenChangeDetails,
  PopupOpenChangeReason as MenuOpenChangeReason,
  PopupSide as MenuSide,
} from './lib/popup.ts'

export type { PopupPayloadState as MenuPayloadState } from './lib/popup-handle.ts'

/**
 * Creates a handle for triggers rendered outside the menu's `Context` (Base UI's
 * `Menu.createHandle()`): pass it to `<menu.Context handle>` and `menu.trigger({ handle,
 * payload })`. `isOpen`, `open(triggerId?)`, `close()`.
 */
export const createHandle: <Payload = unknown>() => MenuHandle<Payload> = createMenuHandle

/**
 * Provider that owns the menu state (Base UI `Menu.Root`). Props: `open` / `defaultOpen` /
 * `onOpenChange(open, details)`, `onOpenChangeComplete`, `modal` (default `true`), `loopFocus`
 * (default `true`), `orientation`, `disabled`, `highlightItemOnHover`, `onItemHighlighted`,
 * `handle`, `triggerId` / `defaultTriggerId`. `children` may be a function of `{ payload }`.
 */
export const Context = MenuContext

/**
 * Provider for a submenu (Base UI `Menu.SubmenuRoot`). Place it inside the parent's popup with a
 * `submenuTrigger()` and its own `popup()`. Same props as `Context` except `modal`, plus
 * `closeParentOnEsc`.
 */
export const SubmenuContext = SubmenuProvider

/** Provider for a radio group's value: `value` / `defaultValue` / `onValueChange`, `disabled`. */
export const RadioGroupContext = RadioGroupProvider

/** Provider for one radio item: `value`, `disabled`. */
export const RadioItemContext = RadioItemProvider

/** Provider for one checkbox item: `checked` / `defaultChecked` / `onCheckedChange`, `disabled`. */
export const CheckboxItemContext = CheckboxItemProvider

/**
 * The button that opens the menu: `aria-haspopup="menu"`, `aria-expanded`, `aria-controls`,
 * `data-popup-open`, `data-pressed`, `data-disabled`. ArrowDown / ArrowUp open it and focus the
 * first / last item. Options: `disabled`, `openOnHover`, `delay` (100), `closeDelay`, and
 * `handle` / `payload` for a trigger outside the `Context`.
 */
export const trigger = triggerMixin

/**
 * The menu popup (Base UI Positioner + Popup), shown in the top layer: `role="menu"`,
 * `data-open` / `data-closed`, `data-side` / `data-align`, presence attributes, and the
 * positioning CSS variables. Options: `side`, `align`, `sideOffset`, `alignOffset`,
 * `collisionPadding`, `arrowPadding`, `anchor`, `initialFocus`, `finalFocus`.
 */
export const popup = popupMixin

/** An element inside the popup pointing at the trigger. */
export const arrow = arrowMixin

/** An optional overlay shown in the top layer beneath the popup. */
export const backdrop = backdropMixin

/**
 * A menu item: `role="menuitem"`, `data-highlighted`, `data-disabled`. Options: `label`,
 * `disabled`, `closeOnClick` (default `true`), `value`.
 */
export const item = itemMixin

/** A link item for an `<a href>`: `role="menuitem"`. Options: `label`, `closeOnClick` (false). */
export const linkItem = linkItemMixin

/** Groups related items: `role="group"`, labelled by a `groupLabel()` inside it. */
export const group = groupMixin

/** Labels the enclosing `group()` / `radioGroup()`. */
export const groupLabel = groupLabelMixin

/** A separator (`role="separator"`): the generic `stems-ui/separator` mixin. */
export const separator = separatorMixin

/**
 * A checkbox item inside a `CheckboxItemContext`: `role="menuitemcheckbox"`, `aria-checked`,
 * `data-checked` / `data-unchecked`. Options: `label`, `closeOnClick` (default `false`), `value`.
 */
export const checkboxItem = checkboxItemMixin

/** Shows whether its checkbox item is checked; `hidden` while unchecked unless `keepMounted`. */
export const checkboxItemIndicator = checkboxItemIndicatorMixin

/** The element of a `RadioGroupContext`: `role="group"`, `data-disabled`. */
export const radioGroup = radioGroupMixin

/**
 * A radio item inside a `RadioItemContext`: `role="menuitemradio"`, `aria-checked`,
 * `data-checked` / `data-unchecked`. Options: `label`, `closeOnClick` (default `false`).
 */
export const radioItem = radioItemMixin

/** Shows whether its radio item is selected; `hidden` while unselected unless `keepMounted`. */
export const radioItemIndicator = radioItemIndicatorMixin

/**
 * The item that opens a submenu, inside its `SubmenuContext`: `role="menuitem"`,
 * `aria-haspopup="menu"`, `aria-expanded`, `data-popup-open`, `data-highlighted`. Options:
 * `label`, `disabled`, `openOnHover` (default `true`), `delay` (100), `closeDelay` (0).
 */
export const submenuTrigger = submenuTriggerMixin

/**
 * Makes the menu (or submenu) inside it filterable (Base UI `Menu.FilterProvider`): wrap a
 * `Context` or `SubmenuContext` and add `input()`, `list()`, and optionally `clear()` /
 * `empty()` to its popup. Props: `value` / `defaultValue` / `onValueChange(value, details)`,
 * `autoHighlight` (`false`), `filter` (default: contains, ignoring case and diacritics; `null`
 * to filter yourself), `locale`.
 */
export const FilterProvider = MenuFilterProvider

/**
 * The filter input (Base UI `Menu.Input`): `role="searchbox"`, `aria-controls`,
 * `aria-activedescendant`, `data-highlighted`. Focus stays here while the arrow keys move the
 * highlight; Enter activates the highlighted item; typeahead is off.
 */
export const input = filterInput

/** Clears the query and refocuses the input (Base UI `Menu.Clear`); `hidden` while empty. */
export const clear = filterClear

/**
 * The "no results" live region (Base UI `Menu.Empty`): `role="status"`, `data-empty` while no
 * item matches. Put the message in `EmptyText`.
 */
export const empty = filterEmpty

/** Renders its children only while no item matches; place it inside `empty()`. */
export const EmptyText = EmptyTextComponent

/**
 * Wraps the items (Base UI `Menu.List`). In a filterable menu it has `role="menu"` and the popup
 * becomes a `role="dialog"` holding the input and the list.
 */
export const list = listMixin
