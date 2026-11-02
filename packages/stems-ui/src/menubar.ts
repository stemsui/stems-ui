/**
 * `stems-ui/menubar`: Base UI's Menubar as a `Context` provider plus a `root()` mixin. The menus
 * inside it are ordinary `stems-ui/menu` menus: each `menu.Context` rendered inside
 * `menubar.Context` joins the menubar, and its `menu.trigger()` becomes a menubar item. State
 * lives in `lib/menubar.ts`; the menu integration in `lib/menu.tsx`.
 */

import { attrs, createMixin, on, ref } from '@remix-run/component'
import type { ElementProps, MixinFactory } from '@remix-run/component'

import { flag } from './lib/checkable.ts'
import { getMenubar, MenubarContext } from './lib/menubar.ts'

export type { MenubarContextProps, MenubarContextValue, MenubarOrientation } from './lib/menubar.ts'

/**
 * Provider for a menubar (Base UI `Menubar` props): `orientation` (default `'horizontal'`),
 * `loopFocus` (default `true`), `modal` (default `true`), `disabled`. Render `menu.Context`s
 * inside it; their triggers become the menubar items.
 */
export const Context = MenubarContext

const rootMixin: MixinFactory<HTMLElement, [], ElementProps> = createMixin<
  HTMLElement,
  [],
  ElementProps
>((handle) => {
  let context = getMenubar(handle)
  if (!context) throw new Error('menubar.root() must be rendered inside <menubar.Context>')
  let menubar = context

  return () => [
    attrs({
      role: 'menubar',
      'aria-orientation': menubar.orientation,
      'data-orientation': menubar.orientation,
      'data-modal': flag(menubar.modal),
      'data-has-submenu-open': flag(menubar.hasSubmenuOpen),
    }),
    ref((node: HTMLElement, signal) => {
      menubar._setRoot(node)
      signal.addEventListener('abort', () => menubar._setRoot(null))
    }),
    // Popups are rendered inside the menubar, so this sees pointer movement over them too.
    on<HTMLElement, 'pointermove'>('pointermove', (event) => menubar._notePointer(event)),
    on<HTMLElement, 'pointerdown'>('pointerdown', (event) => menubar._notePointer(event)),
  ]
})

/**
 * The menubar element: `role="menubar"`, `aria-orientation`, `data-orientation`, `data-modal`,
 * and `data-has-submenu-open` while one of its menus is open.
 */
export const root = rootMixin
