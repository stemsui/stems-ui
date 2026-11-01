import type { Handle, Props, RemixNode } from 'remix/component'
import * as menu from '@remix-run/ui/menu'
import type { AnchorOptions } from '@remix-run/ui/anchor'
import { separator } from 'stems-ui/separator'

import { cn } from '#stems/lib/utils.ts'

/*
 * TEMPORARY: behavior comes from `@remix-run/ui/menu` until `stems-ui/menu` exists (Phase 2).
 * Stems does not depend on @remix-run/ui long term; this is the only exception.
 * This file only adds markup and Tailwind classes.
 *
 * State hooks used for styling (set by Remix):
 *   trigger: aria-expanded
 *   item:    data-highlighted="true", aria-disabled="true", aria-checked
 *   surface: :popover-open
 */

export interface DropdownMenuProps {
  /** Accessible label for the menu, used when the trigger text is not descriptive enough. */
  label?: string
  children?: RemixNode
}

export function DropdownMenu(handle: Handle<DropdownMenuProps>) {
  return () => <menu.Context label={handle.props.label}>{handle.props.children}</menu.Context>
}

export type DropdownMenuTriggerProps = Props<'button'> & Pick<AnchorOptions, 'placement' | 'offset'>

export function DropdownMenuTrigger(handle: Handle<DropdownMenuTriggerProps>) {
  return () => {
    let { class: className, mix, placement = 'bottom-start', offset = 4, ...props } = handle.props

    return (
      <button
        type="button"
        data-slot="dropdown-menu-trigger"
        {...props}
        class={cn(className)}
        mix={[menu.trigger({ placement, offset }), mix]}
      />
    )
  }
}

export function DropdownMenuContent(handle: Handle<Props<'div'>>) {
  return () => {
    let { class: className, mix, children, ...props } = handle.props

    return (
      <div
        data-slot="dropdown-menu-content"
        {...props}
        class={cn(
          'm-0 min-w-32 overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md',
          'transition-[opacity,scale] duration-100 ease-out starting:scale-95 starting:opacity-0',
          className,
        )}
        mix={[menu.popover(), mix]}
      >
        <div class="outline-none" mix={menu.list()}>
          {children}
        </div>
      </div>
    )
  }
}

const itemClass =
  'relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none ' +
  'data-[highlighted=true]:bg-accent data-[highlighted=true]:text-accent-foreground ' +
  'aria-disabled:pointer-events-none aria-disabled:opacity-50 ' +
  "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"

export type DropdownMenuItemProps = Props<'div'> &
  Omit<menu.MenuItemOptions, 'type' | 'checked'> & {
    inset?: boolean
    variant?: 'default' | 'destructive'
  }

export function DropdownMenuItem(handle: Handle<DropdownMenuItemProps>) {
  return () => {
    let {
      class: className,
      mix,
      inset,
      variant = 'default',
      name,
      label,
      value,
      disabled,
      searchValue,
      ...props
    } = handle.props

    return (
      <div
        data-slot="dropdown-menu-item"
        data-variant={variant}
        {...props}
        class={cn(
          itemClass,
          inset && 'pl-8',
          'data-[variant=destructive]:text-destructive data-[variant=destructive]:data-[highlighted=true]:bg-destructive/10 data-[variant=destructive]:data-[highlighted=true]:text-destructive',
          className,
        )}
        mix={[menu.item({ name, label, value, disabled, searchValue }), mix]}
      />
    )
  }
}

export type DropdownMenuCheckboxItemProps = Props<'div'> &
  Omit<menu.MenuItemOptions, 'type'> & { checked: boolean }

export function DropdownMenuCheckboxItem(handle: Handle<DropdownMenuCheckboxItemProps>) {
  return () => {
    let {
      class: className,
      mix,
      children,
      name,
      label,
      value,
      disabled,
      searchValue,
      checked,
      ...props
    } = handle.props

    return (
      <div
        data-slot="dropdown-menu-checkbox-item"
        {...props}
        class={cn(itemClass, 'pl-8', className)}
        mix={[
          menu.item({ type: 'checkbox', checked, name, label, value, disabled, searchValue }),
          mix,
        ]}
      >
        <span class="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
          {checked ? <CheckIcon /> : null}
        </span>
        {children}
      </div>
    )
  }
}

export type DropdownMenuRadioItemProps = Props<'div'> &
  Omit<menu.MenuItemOptions, 'type'> & { checked: boolean; value: string }

export function DropdownMenuRadioItem(handle: Handle<DropdownMenuRadioItemProps>) {
  return () => {
    let {
      class: className,
      mix,
      children,
      name,
      label,
      value,
      disabled,
      searchValue,
      checked,
      ...props
    } = handle.props

    return (
      <div
        data-slot="dropdown-menu-radio-item"
        {...props}
        class={cn(itemClass, 'pl-8', className)}
        mix={[
          menu.item({ type: 'radio', checked, name, label, value, disabled, searchValue }),
          mix,
        ]}
      >
        <span class="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
          {checked ? <span class="size-2 rounded-full bg-current" /> : null}
        </span>
        {children}
      </div>
    )
  }
}

export function DropdownMenuGroup(handle: Handle<Props<'div'>>) {
  return () => {
    let { class: className, ...props } = handle.props
    return <div role="group" data-slot="dropdown-menu-group" {...props} class={cn(className)} />
  }
}

export function DropdownMenuLabel(handle: Handle<Props<'div'> & { inset?: boolean }>) {
  return () => {
    let { class: className, inset, ...props } = handle.props
    return (
      <div
        data-slot="dropdown-menu-label"
        {...props}
        class={cn('px-2 py-1.5 text-sm font-medium', inset && 'pl-8', className)}
      />
    )
  }
}

export function DropdownMenuSeparator(handle: Handle<Props<'div'>>) {
  return () => {
    let { class: className, mix, ...props } = handle.props
    return (
      <div
        data-slot="dropdown-menu-separator"
        {...props}
        class={cn('-mx-1 my-1 h-px bg-border', className)}
        mix={[separator(), mix]}
      />
    )
  }
}

export function DropdownMenuShortcut(handle: Handle<Props<'span'>>) {
  return () => {
    let { class: className, ...props } = handle.props
    return (
      <span
        data-slot="dropdown-menu-shortcut"
        {...props}
        class={cn('ml-auto text-xs tracking-widest text-muted-foreground', className)}
      />
    )
  }
}

export { onMenuSelect } from '@remix-run/ui/menu'
export type { MenuSelectEvent } from '@remix-run/ui/menu'

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
