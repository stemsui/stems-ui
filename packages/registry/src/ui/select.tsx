import type { Handle, Props, RemixNode } from 'remix/component'
import * as select from 'stems-ui/select'

import { cn } from '#stems/lib/utils.ts'

/*
 * Styled after shadcn/ui's Base UI select (base-vega). Behavior: stems-ui/select.
 *
 * The popup is shown in the top layer (`popover="manual"`), so there is no Portal or Positioner
 * element: `SelectContent` takes the positioner props (`side`, `align`, `sideOffset`,
 * `alignOffset`, `alignItemWithTrigger`, `collisionPadding`) directly. `Select` renders the form
 * input(s) itself; pass `name` (and `required`, `form`) to it.
 *
 * Pass `items` to `Select` so `SelectValue` can show the selected label in server-rendered HTML;
 * without it the label is read from the rendered items after hydration.
 *
 * State hooks used for styling (set by stems-ui/select):
 *   trigger:  aria-expanded, data-popup-open, data-placeholder, data-disabled, aria-invalid
 *   value:    data-placeholder
 *   content:  data-open / data-closed, data-side (`none` when aligned with the trigger),
 *             data-align, --transform-origin, --available-height, --anchor-width
 *   items:    data-highlighted, data-selected, data-disabled
 */

export {
  onSelectChange,
  onSelectOpenChange,
  type SelectChangeEvent,
  type SelectOpenChangeDetails,
  type SelectOpenChangeEvent,
  type SelectOpenChangeReason,
  type SelectValueChangeDetails,
  type SelectValueChangeReason,
} from 'stems-ui/select'

export type SelectProps = select.SelectContextProps

export function Select(handle: Handle<SelectProps>) {
  return () => <select.Context {...handle.props} />
}

export type SelectGroupProps = Props<'div'>

export function SelectGroup(handle: Handle<SelectGroupProps>) {
  return () => {
    let { class: className, mix, ...props } = handle.props
    return (
      <div
        data-slot="select-group"
        {...props}
        class={cn('scroll-my-1 p-1', className)}
        mix={[select.group(), mix]}
      />
    )
  }
}

export type SelectValueProps = Omit<Props<'span'>, 'children'> & {
  /** Shown while no value is selected. */
  placeholder?: RemixNode
  /** Custom rendering of the value (an array when `multiple`). */
  children?: (value: any) => RemixNode
}

export function SelectValue(handle: Handle<SelectValueProps>) {
  return () => {
    let { class: className, mix, placeholder, children, ...props } = handle.props
    return (
      <span
        data-slot="select-value"
        {...props}
        class={cn('flex flex-1 text-left', className)}
        mix={[select.value(), mix]}
      >
        <select.ValueText placeholder={placeholder} children={children} />
      </span>
    )
  }
}

export type SelectTriggerProps = Props<'button'> &
  select.SelectTriggerOptions & {
    size?: 'sm' | 'default'
  }

export function SelectTrigger(handle: Handle<SelectTriggerProps>) {
  return () => {
    let { class: className, mix, size = 'default', disabled, children, ...props } = handle.props
    return (
      <button
        data-slot="select-trigger"
        data-size={size}
        {...props}
        class={cn(
          "flex w-fit items-center justify-between gap-1.5 rounded-md border border-input bg-transparent py-2 pr-2 pl-2.5 text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-placeholder:text-muted-foreground data-[size=default]:h-9 data-[size=sm]:h-8 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 dark:bg-input/30 dark:hover:bg-input/50 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
          className,
        )}
        mix={[select.trigger({ disabled }), mix]}
      >
        {children}
        <span class="flex" mix={select.icon()}>
          <ChevronDownIcon class="pointer-events-none size-4 text-muted-foreground" />
        </span>
      </button>
    )
  }
}

export type SelectContentProps = Props<'div'> & select.SelectPopupOptions

export function SelectContent(handle: Handle<SelectContentProps>) {
  return () => {
    let {
      class: className,
      mix,
      children,
      side = 'bottom',
      sideOffset = 4,
      align = 'center',
      alignOffset = 0,
      alignItemWithTrigger = true,
      collisionPadding,
      arrowPadding,
      anchor,
      initialFocus,
      finalFocus,
      ...props
    } = handle.props
    return (
      <div
        data-slot="select-content"
        data-align-trigger={alignItemWithTrigger ? 'true' : 'false'}
        {...props}
        class={cn(
          'relative isolate z-50 max-h-(--available-height) w-(--anchor-width) min-w-36 origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-md bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 outline-none data-[align-trigger=true]:animate-none data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
          className,
        )}
        mix={[
          select.popup({
            side,
            sideOffset,
            align,
            alignOffset,
            alignItemWithTrigger,
            collisionPadding,
            arrowPadding,
            anchor,
            initialFocus,
            finalFocus,
          }),
          mix,
        ]}
      >
        <SelectScrollUpButton />
        <div class="outline-none" mix={select.list()}>
          {children}
        </div>
        <SelectScrollDownButton />
      </div>
    )
  }
}

export type SelectLabelProps = Props<'div'>

export function SelectLabel(handle: Handle<SelectLabelProps>) {
  return () => {
    let { class: className, mix, ...props } = handle.props
    return (
      <div
        data-slot="select-label"
        {...props}
        class={cn('px-2 py-1.5 text-xs text-muted-foreground', className)}
        mix={[select.groupLabel(), mix]}
      />
    )
  }
}

export type SelectItemProps = Props<'div'> & {
  /** The item's value. */
  value: unknown
  /** Text used by typeahead and as the label. Defaults to the item text. */
  label?: string
  disabled?: boolean
}

export function SelectItem(handle: Handle<SelectItemProps>) {
  return () => {
    let { class: className, mix, children, value, label, disabled, ...props } = handle.props
    return (
      <select.ItemContext value={value} label={label} disabled={disabled}>
        <div
          data-slot="select-item"
          {...props}
          class={cn(
            "relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-highlighted:**:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2",
            className,
          )}
          mix={[select.item(), mix]}
        >
          <span class="flex flex-1 shrink-0 gap-2 whitespace-nowrap" mix={select.itemText()}>
            {children}
          </span>
          <span
            class="pointer-events-none absolute right-2 flex size-4 items-center justify-center"
            mix={select.itemIndicator()}
          >
            <CheckIcon class="pointer-events-none" />
          </span>
        </div>
      </select.ItemContext>
    )
  }
}

export type SelectSeparatorProps = Props<'div'>

export function SelectSeparator(handle: Handle<SelectSeparatorProps>) {
  return () => {
    let { class: className, mix, ...props } = handle.props
    return (
      <div
        data-slot="select-separator"
        {...props}
        class={cn('pointer-events-none -mx-1 my-1 h-px bg-border', className)}
        mix={[select.separator(), mix]}
      />
    )
  }
}

export type SelectScrollButtonProps = Props<'div'>

export function SelectScrollUpButton(handle: Handle<SelectScrollButtonProps>) {
  return () => {
    let { class: className, mix, ...props } = handle.props
    return (
      <div
        data-slot="select-scroll-up-button"
        {...props}
        class={cn(
          "top-0 z-10 flex w-full cursor-default items-center justify-center bg-popover py-1 [&_svg:not([class*='size-'])]:size-4",
          className,
        )}
        mix={[select.scrollUpArrow(), mix]}
      >
        <ChevronUpIcon />
      </div>
    )
  }
}

export function SelectScrollDownButton(handle: Handle<SelectScrollButtonProps>) {
  return () => {
    let { class: className, mix, ...props } = handle.props
    return (
      <div
        data-slot="select-scroll-down-button"
        {...props}
        class={cn(
          "bottom-0 z-10 flex w-full cursor-default items-center justify-center bg-popover py-1 [&_svg:not([class*='size-'])]:size-4",
          className,
        )}
        mix={[select.scrollDownArrow(), mix]}
      >
        <ChevronDownIcon />
      </div>
    )
  }
}

function icon(path: string) {
  return function Icon(handle: Handle<{ class?: string }>) {
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
        class={handle.props.class}
      >
        <path d={path} />
      </svg>
    )
  }
}

const CheckIcon = icon('M20 6 9 17l-5-5')
const ChevronDownIcon = icon('m6 9 6 6 6-6')
const ChevronUpIcon = icon('m18 15-6-6-6 6')
