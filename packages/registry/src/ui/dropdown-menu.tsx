import type { Handle, Props, RemixNode } from 'remix/component'
import * as menu from 'stems-ui/menu'

import { cn } from '#stems/lib/utils.ts'

/*
 * Styled after shadcn/ui's Base UI dropdown menu (base-vega). Behavior: stems-ui/menu.
 *
 * The popup is shown in the top layer (`popover="manual"`), so there is no Portal or Positioner
 * element: `DropdownMenuContent` takes the positioner props (`side`, `align`, `sideOffset`,
 * `alignOffset`, `collisionPadding`) directly, and `DropdownMenuPortal` only renders its
 * children. Submenu content must be rendered inside `DropdownMenuSub` (inside the parent
 * content).
 *
 * State hooks used for styling (set by stems-ui/menu):
 *   trigger:      aria-expanded, data-popup-open, data-pressed, data-disabled
 *   content:      data-open / data-closed, data-side, data-align, --transform-origin,
 *                 --available-height, --anchor-width
 *   items:        data-highlighted, data-disabled, data-checked / data-unchecked
 *   sub-trigger:  data-highlighted, data-popup-open
 *   filter input: data-highlighted (focus ring while no item is keyboard-highlighted)
 *   empty:        data-empty
 *
 * Filtering (Base UI 1.9 `Menu.FilterProvider` / `Input` / `Clear` / `Empty` / `List`) has no
 * shadcn counterpart yet; `DropdownMenuFilterInput` and `DropdownMenuEmpty` are styled after
 * shadcn's Command input and empty state.
 *
 * To style the trigger as a button, pass `class={buttonVariants({ variant: 'outline' })}`.
 */

export {
  onMenuChange,
  onMenuFilterChange,
  onMenuSelect,
  type MenuFilterChangeDetails,
  type MenuFilterChangeEvent,
  type MenuFilterChangeReason,
  type MenuChangeEvent,
  type MenuItemChangeDetails,
  type MenuOpenChangeDetails,
  type MenuOpenChangeReason,
  type MenuSelectEvent,
} from 'stems-ui/menu'

export type DropdownMenuProps<Payload = unknown> = menu.MenuContextProps<Payload>

/**
 * `handle` connects detached `DropdownMenuTrigger`s; `children` may be a function of
 * `{ payload }`.
 */
export function DropdownMenu<Payload = unknown>(handle: Handle<DropdownMenuProps<Payload>>) {
  return () => <menu.Context {...handle.props} />
}

/** No-op: the content is shown in the top layer where it is rendered. */
export function DropdownMenuPortal(handle: Handle<{ children?: RemixNode }>) {
  return () => handle.props.children
}

export type DropdownMenuTriggerProps = Props<'button'> & menu.MenuTriggerOptions

export function DropdownMenuTrigger(handle: Handle<DropdownMenuTriggerProps>) {
  return () => {
    let {
      mix,
      disabled,
      openOnHover,
      delay,
      closeDelay,
      handle: menuHandle,
      payload,
      ...props
    } = handle.props

    return (
      <button
        data-slot="dropdown-menu-trigger"
        {...props}
        mix={[
          menu.trigger({
            disabled,
            openOnHover,
            delay,
            closeDelay,
            handle: menuHandle,
            payload,
          }),
          mix,
        ]}
      />
    )
  }
}

const contentClass =
  'z-50 max-h-(--available-height) w-(--anchor-width) min-w-32 origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-md bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 outline-none data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:overflow-hidden data-closed:fade-out-0 data-closed:zoom-out-95'

export type DropdownMenuContentProps = Props<'div'> &
  menu.MenuPopupOptions & {
    children?: RemixNode
  }

function popupOptions(
  props: DropdownMenuContentProps,
  defaults: Pick<menu.MenuPopupOptions, 'side' | 'align' | 'sideOffset' | 'alignOffset'>,
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

export function DropdownMenuContent(handle: Handle<DropdownMenuContentProps>) {
  return () => {
    let [options, { class: className, mix, ...props }] = popupOptions(handle.props, {
      side: 'bottom',
      align: 'start',
      sideOffset: 4,
      alignOffset: 0,
    })

    return (
      <div
        data-slot="dropdown-menu-content"
        {...props}
        class={cn(contentClass, className)}
        mix={[menu.popup(options), mix]}
      />
    )
  }
}

export function DropdownMenuGroup(handle: Handle<Props<'div'>>) {
  return () => {
    let { mix, ...props } = handle.props
    return <div data-slot="dropdown-menu-group" {...props} mix={[menu.group(), mix]} />
  }
}

export type DropdownMenuLabelProps = Props<'div'> & { inset?: boolean }

export function DropdownMenuLabel(handle: Handle<DropdownMenuLabelProps>) {
  return () => {
    let { class: className, mix, inset, ...props } = handle.props
    return (
      <div
        data-slot="dropdown-menu-label"
        data-inset={inset ? '' : undefined}
        {...props}
        class={cn(
          'px-2 py-1.5 text-xs font-medium text-muted-foreground data-inset:pl-8',
          className,
        )}
        mix={[menu.groupLabel(), mix]}
      />
    )
  }
}

const itemBaseClass =
  "relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-inset:pl-8 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"

export type DropdownMenuItemProps = Props<'div'> &
  menu.MenuItemOptions & {
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
      label,
      disabled,
      closeOnClick,
      value,
      ...props
    } = handle.props

    return (
      <div
        data-slot="dropdown-menu-item"
        data-inset={inset ? '' : undefined}
        data-variant={variant}
        {...props}
        class={cn(
          itemBaseClass,
          'group/dropdown-menu-item not-data-[variant=destructive]:data-highlighted:**:text-accent-foreground data-[variant=destructive]:text-destructive data-[variant=destructive]:data-highlighted:bg-destructive/10 data-[variant=destructive]:data-highlighted:text-destructive dark:data-[variant=destructive]:data-highlighted:bg-destructive/20 data-[variant=destructive]:*:[svg]:text-destructive',
          className,
        )}
        mix={[menu.item({ label, disabled, closeOnClick, value }), mix]}
      />
    )
  }
}

export type DropdownMenuSubProps = menu.SubmenuContextProps

export function DropdownMenuSub(handle: Handle<DropdownMenuSubProps>) {
  return () => <menu.SubmenuContext {...handle.props} />
}

export type DropdownMenuSubTriggerProps = Props<'div'> &
  menu.SubmenuTriggerOptions & {
    inset?: boolean
  }

export function DropdownMenuSubTrigger(handle: Handle<DropdownMenuSubTriggerProps>) {
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
        data-slot="dropdown-menu-sub-trigger"
        data-inset={inset ? '' : undefined}
        {...props}
        class={cn(
          itemBaseClass,
          'data-highlighted:**:text-accent-foreground data-popup-open:bg-accent data-popup-open:text-accent-foreground',
          className,
        )}
        mix={[menu.submenuTrigger({ label, disabled, openOnHover, delay, closeDelay }), mix]}
      >
        {children}
        <ChevronRightIcon />
      </div>
    )
  }
}

export function DropdownMenuSubContent(handle: Handle<DropdownMenuContentProps>) {
  return () => {
    let [options, { class: className, mix, ...props }] = popupOptions(handle.props, {
      side: 'inline-end',
      align: 'start',
      sideOffset: 0,
      alignOffset: -3,
    })

    return (
      <div
        data-slot="dropdown-menu-sub-content"
        {...props}
        class={cn(contentClass, 'w-auto min-w-[96px] shadow-lg', className)}
        mix={[menu.popup(options), mix]}
      />
    )
  }
}

const checkableItemClass =
  "relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-highlighted:**:text-accent-foreground data-inset:pl-8 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"

export type DropdownMenuCheckboxItemProps = Omit<Props<'div'>, 'onCheckedChange'> &
  Omit<menu.CheckboxItemContextProps, 'children'> &
  menu.MenuCheckboxItemOptions & {
    inset?: boolean
  }

export function DropdownMenuCheckboxItem(handle: Handle<DropdownMenuCheckboxItemProps>) {
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
          data-slot="dropdown-menu-checkbox-item"
          data-inset={inset ? '' : undefined}
          {...props}
          class={cn(checkableItemClass, className)}
          mix={[menu.checkboxItem({ label, closeOnClick, value }), mix]}
        >
          <span
            class="pointer-events-none absolute right-2 flex items-center justify-center"
            data-slot="dropdown-menu-checkbox-item-indicator"
          >
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

export type DropdownMenuRadioGroupProps = Props<'div'> &
  Omit<menu.RadioGroupContextProps, 'children'>

export function DropdownMenuRadioGroup(handle: Handle<DropdownMenuRadioGroupProps>) {
  return () => {
    let { mix, value, defaultValue, onValueChange, disabled, ...props } = handle.props
    return (
      <menu.RadioGroupContext
        value={value}
        defaultValue={defaultValue}
        onValueChange={onValueChange}
        disabled={disabled}
      >
        <div data-slot="dropdown-menu-radio-group" {...props} mix={[menu.radioGroup(), mix]} />
      </menu.RadioGroupContext>
    )
  }
}

export type DropdownMenuRadioItemProps = Props<'div'> &
  menu.MenuRadioItemOptions & {
    value: unknown
    disabled?: boolean
    inset?: boolean
  }

export function DropdownMenuRadioItem(handle: Handle<DropdownMenuRadioItemProps>) {
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
          data-slot="dropdown-menu-radio-item"
          data-inset={inset ? '' : undefined}
          {...props}
          class={cn(checkableItemClass, className)}
          mix={[menu.radioItem({ label, closeOnClick }), mix]}
        >
          <span
            class="pointer-events-none absolute right-2 flex items-center justify-center"
            data-slot="dropdown-menu-radio-item-indicator"
          >
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

export function DropdownMenuSeparator(handle: Handle<Props<'div'>>) {
  return () => {
    let { class: className, mix, ...props } = handle.props
    return (
      <div
        data-slot="dropdown-menu-separator"
        {...props}
        class={cn('-mx-1 my-1 h-px bg-border', className)}
        mix={[menu.separator(), mix]}
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
        class={cn(
          'ml-auto text-xs tracking-widest text-muted-foreground group-data-highlighted/dropdown-menu-item:text-accent-foreground',
          className,
        )}
      />
    )
  }
}

// Filtering ----------------------------------------------------------------------------------

export type DropdownMenuFilterProviderProps = menu.MenuFilterProviderProps

/** Wrap `DropdownMenu` (or `DropdownMenuSub`) to make its items filterable. */
export function DropdownMenuFilterProvider(handle: Handle<DropdownMenuFilterProviderProps>) {
  return () => <menu.FilterProvider {...handle.props} />
}

export type DropdownMenuFilterInputProps = Props<'input'> & {
  /** Render a clear button at the end of the input while it has text. */
  showClear?: boolean
}

/** The search field at the top of a filterable `DropdownMenuContent`. */
export function DropdownMenuFilterInput(handle: Handle<DropdownMenuFilterInputProps>) {
  return () => {
    let { class: className, mix, showClear = false, ...props } = handle.props
    return (
      <div
        data-slot="dropdown-menu-filter-input-wrapper"
        class="-mx-1 -mt-1 mb-1 flex items-center gap-2 border-b px-3"
      >
        <SearchIcon />
        <input
          data-slot="dropdown-menu-filter-input"
          placeholder="Filter…"
          {...props}
          class={cn(
            'h-9 w-full min-w-0 bg-transparent text-sm outline-hidden placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50',
            className,
          )}
          mix={[menu.input(), mix]}
        />
        {showClear && <DropdownMenuFilterClear />}
      </div>
    )
  }
}

export type DropdownMenuFilterClearProps = Props<'button'> & menu.MenuFilterClearOptions

/** Clears the query; hidden while the input is empty. */
export function DropdownMenuFilterClear(handle: Handle<DropdownMenuFilterClearProps>) {
  return () => {
    let { class: className, mix, disabled, children, ...props } = handle.props
    return (
      <button
        data-slot="dropdown-menu-filter-clear"
        {...props}
        class={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-sm opacity-50 hover:opacity-100 data-disabled:pointer-events-none [&_svg:not([class*='size-'])]:size-3.5",
          className,
        )}
        mix={[menu.clear({ disabled }), mix]}
      >
        {children ?? <XIcon />}
      </button>
    )
  }
}

/**
 * The "no results" message. The element stays rendered (a polite live region) and shows its
 * children only while nothing matches.
 */
export function DropdownMenuEmpty(handle: Handle<Props<'div'>>) {
  return () => {
    let { class: className, mix, children, ...props } = handle.props
    return (
      <div
        data-slot="dropdown-menu-empty"
        {...props}
        class={cn('text-center text-sm text-muted-foreground data-empty:py-6', className)}
        mix={[menu.empty(), mix]}
      >
        <menu.EmptyText>{children ?? 'No results found.'}</menu.EmptyText>
      </div>
    )
  }
}

/** Wraps the items of a filterable menu (the `role="menu"` element); scrolls on its own. */
export function DropdownMenuList(handle: Handle<Props<'div'>>) {
  return () => {
    let { class: className, mix, ...props } = handle.props
    return (
      <div
        data-slot="dropdown-menu-list"
        {...props}
        class={cn('max-h-72 scroll-py-1 overflow-x-hidden overflow-y-auto outline-none', className)}
        mix={[menu.list(), mix]}
      />
    )
  }
}

function SearchIcon() {
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
      class="size-4 shrink-0 opacity-50"
    >
      <path d="m21 21-4.34-4.34" />
      <circle cx="11" cy="11" r="8" />
    </svg>
  )
}

function XIcon() {
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
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  )
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
