import type { Handle, Props, RemixNode } from 'remix/component'
import * as menu from 'stems-ui/menu'
import * as menubar from 'stems-ui/menubar'

import { cn } from '#stems/lib/utils.ts'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  type DropdownMenuContentProps,
  type DropdownMenuItemProps,
  type DropdownMenuLabelProps,
  type DropdownMenuProps,
  type DropdownMenuRadioGroupProps,
  type DropdownMenuSubProps,
  type DropdownMenuSubTriggerProps,
  type DropdownMenuTriggerProps,
} from '#stems/ui/dropdown-menu.tsx'

/*
 * Styled after shadcn/ui's Base UI menubar (base-vega). Behavior: stems-ui/menubar, whose menus
 * are stems-ui/menu menus; like shadcn, the menu parts build on the dropdown-menu item.
 *
 * Popups are shown in the top layer, so `MenubarPortal` only renders its children and
 * `MenubarContent` takes the positioner props (`side`, `align`, `sideOffset`, `alignOffset`)
 * directly. Render submenu content inside `MenubarSub`.
 *
 * State hooks used for styling:
 *   menubar:      data-orientation, data-modal, data-has-submenu-open
 *   trigger:      aria-expanded, data-popup-open, data-pressed, data-disabled
 *   content:      data-open / data-closed, data-side, data-align, --transform-origin
 *   items:        data-highlighted, data-disabled, data-checked / data-unchecked
 *   sub-trigger:  data-highlighted, data-popup-open
 *
 * shadcn styles focus with `focus:`; Stems items use real focus and `data-highlighted`, so the
 * `focus:` utilities are spelled `data-highlighted:`.
 */

export {
  onMenuChange,
  onMenuSelect,
  type MenuChangeEvent,
  type MenuItemChangeDetails,
  type MenuOpenChangeDetails,
  type MenuOpenChangeReason,
  type MenuSelectEvent,
} from 'stems-ui/menu'

export type MenubarProps = Props<'div'> & Omit<menubar.MenubarContextProps, 'children'>

export function Menubar(handle: Handle<MenubarProps>) {
  return () => {
    let {
      class: className,
      mix,
      children,
      orientation,
      loopFocus,
      modal,
      disabled,
      ...props
    } = handle.props

    return (
      <menubar.Context
        orientation={orientation}
        loopFocus={loopFocus}
        modal={modal}
        disabled={disabled}
      >
        <div
          data-slot="menubar"
          {...props}
          class={cn(
            'flex h-9 items-center gap-1 rounded-md border p-1 shadow-xs data-[orientation=vertical]:h-auto data-[orientation=vertical]:w-fit data-[orientation=vertical]:flex-col data-[orientation=vertical]:items-stretch',
            className,
          )}
          mix={[menubar.root(), mix]}
        >
          {children}
        </div>
      </menubar.Context>
    )
  }
}

/** One menu of the menubar (a `menu.Context`). */
export function MenubarMenu(handle: Handle<DropdownMenuProps>) {
  return () => <DropdownMenu {...handle.props} />
}

export function MenubarGroup(handle: Handle<Props<'div'>>) {
  return () => <DropdownMenuGroup data-slot="menubar-group" {...handle.props} />
}

/** No-op: the content is shown in the top layer where it is rendered. */
export function MenubarPortal(handle: Handle<{ children?: RemixNode }>) {
  return () => <DropdownMenuPortal {...handle.props} />
}

export function MenubarTrigger(handle: Handle<DropdownMenuTriggerProps>) {
  return () => {
    let { class: className, ...props } = handle.props
    return (
      <DropdownMenuTrigger
        data-slot="menubar-trigger"
        {...props}
        class={cn(
          'flex items-center rounded-sm px-2 py-1 text-sm font-medium outline-hidden select-none hover:bg-muted focus-visible:bg-muted aria-expanded:bg-muted disabled:pointer-events-none disabled:opacity-50',
          className,
        )}
      />
    )
  }
}

export function MenubarContent(handle: Handle<DropdownMenuContentProps>) {
  return () => {
    let {
      class: className,
      align = 'start',
      alignOffset = -4,
      sideOffset = 8,
      ...props
    } = handle.props
    return (
      <DropdownMenuContent
        data-slot="menubar-content"
        align={align}
        alignOffset={alignOffset}
        sideOffset={sideOffset}
        {...props}
        class={cn(
          'w-auto min-w-36 rounded-md bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95',
          className,
        )}
      />
    )
  }
}

export function MenubarItem(handle: Handle<DropdownMenuItemProps>) {
  return () => {
    let { class: className, ...props } = handle.props
    return (
      <DropdownMenuItem
        data-slot="menubar-item"
        {...props}
        class={cn(
          'group/menubar-item gap-2 rounded-sm px-2 py-1.5 text-sm data-highlighted:bg-accent data-highlighted:text-accent-foreground data-inset:pl-8 data-disabled:opacity-50',
          className,
        )}
      />
    )
  }
}

const checkableItemClass =
  "relative flex cursor-default items-center gap-2 rounded-md py-1.5 pr-2 pl-8 text-sm outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-highlighted:**:text-accent-foreground data-inset:pl-8 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"

export type MenubarCheckboxItemProps = Omit<Props<'div'>, 'onCheckedChange'> &
  Omit<menu.CheckboxItemContextProps, 'children'> &
  menu.MenuCheckboxItemOptions & {
    inset?: boolean
  }

export function MenubarCheckboxItem(handle: Handle<MenubarCheckboxItemProps>) {
  return () => {
    let {
      class: className,
      mix,
      children,
      inset,
      checked,
      defaultChecked,
      onCheckedChange,
      disabled,
      label,
      closeOnClick,
      value,
      ...props
    } = handle.props

    return (
      <menu.CheckboxItemContext
        checked={checked}
        defaultChecked={defaultChecked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
      >
        <div
          data-slot="menubar-checkbox-item"
          data-inset={inset ? '' : undefined}
          {...props}
          class={cn(checkableItemClass, className)}
          mix={[menu.checkboxItem({ label, closeOnClick, value }), mix]}
        >
          <span class="pointer-events-none absolute left-2 flex size-4 items-center justify-center [&_svg:not([class*='size-'])]:size-4">
            <span class="flex" mix={menu.checkboxItemIndicator()}>
              <CheckIcon />
            </span>
          </span>
          {children}
        </div>
      </menu.CheckboxItemContext>
    )
  }
}

export function MenubarRadioGroup(handle: Handle<DropdownMenuRadioGroupProps>) {
  return () => <DropdownMenuRadioGroup data-slot="menubar-radio-group" {...handle.props} />
}

export type MenubarRadioItemProps = Props<'div'> &
  menu.MenuRadioItemOptions & {
    value: unknown
    disabled?: boolean
    inset?: boolean
  }

export function MenubarRadioItem(handle: Handle<MenubarRadioItemProps>) {
  return () => {
    let {
      class: className,
      mix,
      children,
      inset,
      value,
      disabled,
      label,
      closeOnClick,
      ...props
    } = handle.props

    return (
      <menu.RadioItemContext value={value} disabled={disabled}>
        <div
          data-slot="menubar-radio-item"
          data-inset={inset ? '' : undefined}
          {...props}
          class={cn(checkableItemClass, className)}
          mix={[menu.radioItem({ label, closeOnClick }), mix]}
        >
          <span class="pointer-events-none absolute left-2 flex size-4 items-center justify-center [&_svg:not([class*='size-'])]:size-4">
            <span class="flex" mix={menu.radioItemIndicator()}>
              <CheckIcon />
            </span>
          </span>
          {children}
        </div>
      </menu.RadioItemContext>
    )
  }
}

export function MenubarLabel(handle: Handle<DropdownMenuLabelProps>) {
  return () => {
    let { class: className, ...props } = handle.props
    return (
      <DropdownMenuLabel
        data-slot="menubar-label"
        {...props}
        class={cn('px-2 py-1.5 text-sm font-medium data-inset:pl-8', className)}
      />
    )
  }
}

export function MenubarSeparator(handle: Handle<Props<'div'>>) {
  return () => {
    let { class: className, ...props } = handle.props
    return (
      <DropdownMenuSeparator
        data-slot="menubar-separator"
        {...props}
        class={cn('-mx-1 my-1 h-px bg-border', className)}
      />
    )
  }
}

export function MenubarShortcut(handle: Handle<Props<'span'>>) {
  return () => {
    let { class: className, ...props } = handle.props
    return (
      <DropdownMenuShortcut
        data-slot="menubar-shortcut"
        {...props}
        class={cn(
          'ml-auto text-xs tracking-widest text-muted-foreground group-data-highlighted/menubar-item:text-accent-foreground',
          className,
        )}
      />
    )
  }
}

export function MenubarSub(handle: Handle<DropdownMenuSubProps>) {
  return () => <DropdownMenuSub {...handle.props} />
}

export function MenubarSubTrigger(handle: Handle<DropdownMenuSubTriggerProps>) {
  return () => {
    let { class: className, ...props } = handle.props
    return (
      <DropdownMenuSubTrigger
        data-slot="menubar-sub-trigger"
        {...props}
        class={cn(
          "gap-2 rounded-sm px-2 py-1.5 text-sm data-highlighted:bg-accent data-highlighted:text-accent-foreground data-inset:pl-8 data-popup-open:bg-accent data-popup-open:text-accent-foreground [&_svg:not([class*='size-'])]:size-4",
          className,
        )}
      />
    )
  }
}

export function MenubarSubContent(handle: Handle<DropdownMenuContentProps>) {
  return () => {
    let { class: className, ...props } = handle.props
    return (
      <DropdownMenuSubContent
        data-slot="menubar-sub-content"
        {...props}
        class={cn(
          'min-w-32 rounded-md bg-popover p-1 text-popover-foreground shadow-lg ring-1 ring-foreground/10 duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
          className,
        )}
      />
    )
  }
}

function CheckIcon() {
  return () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}
