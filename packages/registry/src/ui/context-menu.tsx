import type { Handle, Props, RemixNode } from 'remix/component'
import * as contextMenu from 'stems-ui/context-menu'

import { cn } from '#stems/lib/utils.ts'

/*
 * Styled after shadcn/ui's Base UI context menu (base-vega). Behavior: stems-ui/context-menu.
 *
 * `ContextMenuTrigger` is the area that opens the menu: right click opens at the pointer, a
 * touch long press at the touch point, and Shift+F10 / the ContextMenu key at the area's
 * bottom-left corner. The popup is shown in the top layer (`popover="manual"`), so there is no
 * Portal or Positioner element: `ContextMenuContent` takes the positioner props directly and
 * `ContextMenuPortal` only renders its children. Submenu content must be rendered inside
 * `ContextMenuSub` (inside the parent content).
 *
 * State hooks used for styling (set by stems-ui/context-menu):
 *   trigger:      data-popup-open, data-pressed
 *   content:      data-open / data-closed, data-side, data-align, --transform-origin,
 *                 --available-height
 *   items:        data-highlighted, data-disabled, data-checked / data-unchecked
 *   sub-trigger:  data-highlighted, data-popup-open
 */

export {
  onContextMenuChange,
  onMenuChange,
  onMenuSelect,
  type ContextMenuChangeEvent,
  type MenuSelectEvent,
} from 'stems-ui/context-menu'

export type ContextMenuProps = contextMenu.ContextMenuContextProps

export function ContextMenu(handle: Handle<ContextMenuProps>) {
  return () => <contextMenu.Context {...handle.props} />
}

/** No-op: the content is shown in the top layer where it is rendered. */
export function ContextMenuPortal(handle: Handle<{ children?: RemixNode }>) {
  return () => handle.props.children
}

export function ContextMenuTrigger(handle: Handle<Props<'div'>>) {
  return () => {
    let { class: className, mix, ...props } = handle.props

    return (
      <div
        data-slot="context-menu-trigger"
        {...props}
        class={cn('select-none', className)}
        mix={[contextMenu.trigger(), mix]}
      />
    )
  }
}

const contentClass =
  'z-50 max-h-(--available-height) min-w-36 origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-md bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 outline-none data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:overflow-hidden data-closed:fade-out-0 data-closed:zoom-out-95'

export type ContextMenuContentProps = Props<'div'> &
  contextMenu.MenuPopupOptions & {
    children?: RemixNode
  }

function popupOptions(
  props: ContextMenuContentProps,
  defaults: Pick<contextMenu.MenuPopupOptions, 'side' | 'align' | 'sideOffset' | 'alignOffset'>,
) {
  let {
    side = defaults.side,
    align = defaults.align,
    sideOffset = defaults.sideOffset,
    alignOffset = defaults.alignOffset,
    collisionPadding,
    arrowPadding,
    anchor,
    initialFocus,
    finalFocus,
    ...rest
  } = props
  return [
    {
      side,
      align,
      sideOffset,
      alignOffset,
      collisionPadding,
      arrowPadding,
      anchor,
      initialFocus,
      finalFocus,
    },
    rest,
  ] as const
}

export function ContextMenuContent(handle: Handle<ContextMenuContentProps>) {
  return () => {
    let [options, { class: className, mix, ...props }] = popupOptions(handle.props, {
      side: 'right',
      align: 'start',
      sideOffset: 0,
      alignOffset: 4,
    })

    return (
      <div
        data-slot="context-menu-content"
        {...props}
        class={cn(contentClass, className)}
        mix={[contextMenu.popup(options), mix]}
      />
    )
  }
}

export function ContextMenuGroup(handle: Handle<Props<'div'>>) {
  return () => {
    let { mix, ...props } = handle.props
    return <div data-slot="context-menu-group" {...props} mix={[contextMenu.group(), mix]} />
  }
}

export type ContextMenuLabelProps = Props<'div'> & { inset?: boolean }

export function ContextMenuLabel(handle: Handle<ContextMenuLabelProps>) {
  return () => {
    let { class: className, mix, inset, ...props } = handle.props
    return (
      <div
        data-slot="context-menu-label"
        data-inset={inset ? '' : undefined}
        {...props}
        class={cn(
          'px-2 py-1.5 text-xs font-medium text-muted-foreground data-inset:pl-8',
          className,
        )}
        mix={[contextMenu.groupLabel(), mix]}
      />
    )
  }
}

const itemBaseClass =
  "relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-inset:pl-8 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"

export type ContextMenuItemProps = Props<'div'> &
  contextMenu.MenuItemOptions & {
    inset?: boolean
    variant?: 'default' | 'destructive'
  }

export function ContextMenuItem(handle: Handle<ContextMenuItemProps>) {
  return () => {
    let {
      class: className,
      mix,
      inset,
      variant = 'default',
      label,
      disabled,
      closeOnClick,
      value,
      ...props
    } = handle.props

    return (
      <div
        data-slot="context-menu-item"
        data-inset={inset ? '' : undefined}
        data-variant={variant}
        {...props}
        class={cn(
          itemBaseClass,
          'group/context-menu-item not-data-[variant=destructive]:data-highlighted:**:text-accent-foreground data-[variant=destructive]:text-destructive data-[variant=destructive]:data-highlighted:bg-destructive/10 data-[variant=destructive]:data-highlighted:text-destructive dark:data-[variant=destructive]:data-highlighted:bg-destructive/20 data-[variant=destructive]:*:[svg]:text-destructive',
          className,
        )}
        mix={[contextMenu.item({ label, disabled, closeOnClick, value }), mix]}
      />
    )
  }
}

export type ContextMenuSubProps = contextMenu.SubmenuContextProps

export function ContextMenuSub(handle: Handle<ContextMenuSubProps>) {
  return () => <contextMenu.SubmenuContext {...handle.props} />
}

export type ContextMenuSubTriggerProps = Props<'div'> &
  contextMenu.SubmenuTriggerOptions & {
    inset?: boolean
  }

export function ContextMenuSubTrigger(handle: Handle<ContextMenuSubTriggerProps>) {
  return () => {
    let {
      class: className,
      mix,
      inset,
      children,
      label,
      disabled,
      openOnHover,
      delay,
      closeDelay,
      ...props
    } = handle.props

    return (
      <div
        data-slot="context-menu-sub-trigger"
        data-inset={inset ? '' : undefined}
        {...props}
        class={cn(
          itemBaseClass,
          'data-highlighted:**:text-accent-foreground data-popup-open:bg-accent data-popup-open:text-accent-foreground',
          className,
        )}
        mix={[contextMenu.submenuTrigger({ label, disabled, openOnHover, delay, closeDelay }), mix]}
      >
        {children}
        <ChevronRightIcon />
      </div>
    )
  }
}

export function ContextMenuSubContent(handle: Handle<ContextMenuContentProps>) {
  return () => {
    let [options, { class: className, mix, ...props }] = popupOptions(handle.props, {
      side: 'inline-end',
      align: 'start',
      sideOffset: 0,
      alignOffset: -3,
    })

    return (
      <div
        data-slot="context-menu-sub-content"
        {...props}
        class={cn(contentClass, 'w-auto min-w-[96px] shadow-lg', className)}
        mix={[contextMenu.popup(options), mix]}
      />
    )
  }
}

const checkableItemClass =
  "relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-highlighted:**:text-accent-foreground data-inset:pl-8 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"

export type ContextMenuCheckboxItemProps = Omit<Props<'div'>, 'onCheckedChange'> &
  Omit<contextMenu.CheckboxItemContextProps, 'children'> &
  contextMenu.MenuCheckboxItemOptions & {
    inset?: boolean
  }

export function ContextMenuCheckboxItem(handle: Handle<ContextMenuCheckboxItemProps>) {
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
      <contextMenu.CheckboxItemContext
        checked={checked}
        defaultChecked={defaultChecked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
      >
        <div
          data-slot="context-menu-checkbox-item"
          data-inset={inset ? '' : undefined}
          {...props}
          class={cn(checkableItemClass, className)}
          mix={[contextMenu.checkboxItem({ label, closeOnClick, value }), mix]}
        >
          <span
            class="pointer-events-none absolute right-2 flex items-center justify-center"
            data-slot="context-menu-checkbox-item-indicator"
          >
            <span class="flex" mix={contextMenu.checkboxItemIndicator()}>
              <CheckIcon />
            </span>
          </span>
          {children}
        </div>
      </contextMenu.CheckboxItemContext>
    )
  }
}

export type ContextMenuRadioGroupProps = Props<'div'> &
  Omit<contextMenu.RadioGroupContextProps, 'children'>

export function ContextMenuRadioGroup(handle: Handle<ContextMenuRadioGroupProps>) {
  return () => {
    let { mix, value, defaultValue, onValueChange, disabled, ...props } = handle.props
    return (
      <contextMenu.RadioGroupContext
        value={value}
        defaultValue={defaultValue}
        onValueChange={onValueChange}
        disabled={disabled}
      >
        <div
          data-slot="context-menu-radio-group"
          {...props}
          mix={[contextMenu.radioGroup(), mix]}
        />
      </contextMenu.RadioGroupContext>
    )
  }
}

export type ContextMenuRadioItemProps = Props<'div'> &
  contextMenu.MenuRadioItemOptions & {
    value: unknown
    disabled?: boolean
    inset?: boolean
  }

export function ContextMenuRadioItem(handle: Handle<ContextMenuRadioItemProps>) {
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
      <contextMenu.RadioItemContext value={value} disabled={disabled}>
        <div
          data-slot="context-menu-radio-item"
          data-inset={inset ? '' : undefined}
          {...props}
          class={cn(checkableItemClass, className)}
          mix={[contextMenu.radioItem({ label, closeOnClick }), mix]}
        >
          <span
            class="pointer-events-none absolute right-2 flex items-center justify-center"
            data-slot="context-menu-radio-item-indicator"
          >
            <span class="flex" mix={contextMenu.radioItemIndicator()}>
              <CheckIcon />
            </span>
          </span>
          {children}
        </div>
      </contextMenu.RadioItemContext>
    )
  }
}

export function ContextMenuSeparator(handle: Handle<Props<'div'>>) {
  return () => {
    let { class: className, mix, ...props } = handle.props
    return (
      <div
        data-slot="context-menu-separator"
        {...props}
        class={cn('-mx-1 my-1 h-px bg-border', className)}
        mix={[contextMenu.separator(), mix]}
      />
    )
  }
}

export function ContextMenuShortcut(handle: Handle<Props<'span'>>) {
  return () => {
    let { class: className, ...props } = handle.props
    return (
      <span
        data-slot="context-menu-shortcut"
        {...props}
        class={cn(
          'ml-auto text-xs tracking-widest text-muted-foreground group-data-highlighted/context-menu-item:text-accent-foreground',
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

function ChevronRightIcon() {
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
      class="ml-auto rtl:rotate-180"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  )
}
