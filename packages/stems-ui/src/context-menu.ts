// Adapted from @remix-run/ui 0.13.0 (packages/ui/src/menu.tsx, `contextTrigger`).
// https://github.com/remix-run/remix - Copyright (c) 2025 Shopify Inc. MIT License.

/**
 * `stems-ui/context-menu`: Base UI's ContextMenu. Like Base UI, it is a `Context` (the root) and
 * a `trigger()` area, plus every Menu part (shared with `stems-ui/menu`).
 */

import { ContextMenuContext, contextTrigger } from './lib/menu.tsx'

export {
  ContextMenuChangeEvent,
  MenuSelectEvent,
  onContextMenuChange,
  onMenuChange,
  onMenuSelect,
  type CheckboxItemContextProps,
  type ContextMenuContextProps,
  type MenuCheckboxItemOptions,
  type MenuItemChangeDetails,
  type RadioGroupContextProps,
  type RadioItemContextProps,
  type MenuContextValue,
  type MenuIndicatorOptions,
  type MenuItemOptions,
  type MenuLinkItemOptions,
  type MenuPopupOptions,
  type MenuRadioItemOptions,
  type SubmenuContextProps,
  type SubmenuTriggerOptions,
} from './lib/menu.tsx'

export {
  CheckboxItemContext,
  RadioGroupContext,
  RadioItemContext,
  SubmenuContext,
  arrow,
  backdrop,
  checkboxItem,
  checkboxItemIndicator,
  group,
  groupLabel,
  item,
  linkItem,
  popup,
  radioGroup,
  radioItem,
  radioItemIndicator,
  separator,
  submenuTrigger,
} from './menu.ts'

/**
 * Provider that owns the context menu state (Base UI `ContextMenu.Root`). Same props as
 * `menu.Context`; `modal` defaults to `false`. The popup defaults to `side: 'bottom'`,
 * `align: 'start'` against the pointer.
 */
export const Context = ContextMenuContext

/**
 * The area that opens the menu (Base UI `ContextMenu.Trigger`): right click opens at the
 * pointer, a touch long press (500ms) at the touch point, and Shift+F10 / the ContextMenu key at
 * the area's bottom-left corner. Renders `data-popup-open` and `data-pressed` while open.
 */
export const trigger = contextTrigger
