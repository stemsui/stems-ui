import type { Handle, Props, RemixNode } from 'remix/component'
import * as combobox from 'stems-ui/combobox'

import { cn } from '#stems/lib/utils.ts'
import { buttonVariants } from '#stems/ui/button.tsx'

/*
 * Styled after shadcn/ui's Base UI combobox (base-vega). Behavior: stems-ui/combobox.
 *
 * The popup is shown in the top layer (`popover="manual"`), so there is no Portal or Positioner
 * element: `ComboboxContent` takes the positioner props directly. It is positioned against the
 * input group (`ComboboxInput`) or the chips container (`ComboboxChips`), so shadcn's
 * `useComboboxAnchor()` isn't needed. `Combobox` renders the form input(s); pass `name` (and
 * `required`, `form`) to it.
 *
 * shadcn's input-group styles are inlined in `ComboboxInput` (there is no input-group item yet).
 *
 * Render filtered items with a function child of `ComboboxList` (or `ComboboxCollection`) and
 * the `items` prop on `Combobox`, like Base UI; static `ComboboxItem`s are filtered by their
 * text and hidden automatically.
 *
 * State hooks used for styling (set by stems-ui/combobox):
 *   input group: data-popup-open, data-disabled, data-placeholder
 *   input:       aria-expanded, data-popup-open, data-list-empty, aria-invalid
 *   content:     data-open / data-closed, data-side, data-empty, --anchor-width,
 *                --available-height, --transform-origin
 *   items:       data-highlighted, data-selected, data-disabled
 *   clear:       hidden while there is nothing to clear
 */

export {
  onComboboxChange,
  onComboboxInputChange,
  onComboboxOpenChange,
  type ComboboxChangeEvent,
  type ComboboxChangeReason,
  type ComboboxInputChangeDetails,
  type ComboboxInputChangeEvent,
  type ComboboxOpenChangeDetails,
  type ComboboxOpenChangeEvent,
  type ComboboxValueChangeDetails,
} from 'stems-ui/combobox'

export type ComboboxProps = combobox.ComboboxContextProps

export function Combobox(handle: Handle<ComboboxProps>) {
  return () => <combobox.Context {...handle.props} />
}

export type ComboboxValueProps = combobox.ComboboxValueTextProps

/** The selected label(s), or a function child that renders the value (e.g. chips). */
export function ComboboxValue(handle: Handle<ComboboxValueProps>) {
  return () => <combobox.ValueText {...handle.props} />
}

export type ComboboxTriggerProps = Props<'button'> & combobox.ComboboxTriggerOptions

export function ComboboxTrigger(handle: Handle<ComboboxTriggerProps>) {
  return () => {
    let { class: className, mix, disabled, children, ...props } = handle.props
    return (
      <button
        data-slot="combobox-trigger"
        {...props}
        class={cn("[&_svg:not([class*='size-'])]:size-4", className)}
        mix={[combobox.trigger({ disabled }), mix]}
      >
        {children}
        <ChevronDownIcon class="pointer-events-none size-4 text-muted-foreground" />
      </button>
    )
  }
}

export type ComboboxClearProps = Props<'button'> & combobox.ComboboxClearOptions

export function ComboboxClear(handle: Handle<ComboboxClearProps>) {
  return () => {
    let { class: className, mix, disabled, keepMounted, children, ...props } = handle.props
    return (
      <button
        data-slot="combobox-clear"
        aria-label="Clear"
        {...props}
        class={cn(
          buttonVariants({ variant: 'ghost', size: 'icon-xs' }),
          inputGroupButton,
          className,
        )}
        mix={[combobox.clear({ disabled, keepMounted }), mix]}
      >
        {children ?? <XIcon class="pointer-events-none" />}
      </button>
    )
  }
}

// shadcn's InputGroup / InputGroupAddon / InputGroupButton / InputGroupInput classes.
const inputGroup =
  'group/input-group relative flex h-9 w-full min-w-0 items-center rounded-md border border-input shadow-xs transition-[color,box-shadow] outline-none in-data-[slot=combobox-content]:focus-within:border-inherit in-data-[slot=combobox-content]:focus-within:ring-0 has-[[data-slot=input-group-control]:focus-visible]:border-ring has-[[data-slot=input-group-control]:focus-visible]:ring-3 has-[[data-slot=input-group-control]:focus-visible]:ring-ring/50 has-[[data-slot][aria-invalid=true]]:border-destructive has-[[data-slot][aria-invalid=true]]:ring-3 has-[[data-slot][aria-invalid=true]]:ring-destructive/20 dark:bg-input/30 dark:has-[[data-slot][aria-invalid=true]]:ring-destructive/40 has-[>[data-align=inline-end]]:[&>input]:pr-1.5 has-[>[data-align=inline-start]]:[&>input]:pl-1.5'
const inputGroupAddon =
  "flex h-auto cursor-text items-center justify-center gap-2 py-1.5 text-sm font-medium text-muted-foreground select-none group-data-disabled/input-group:opacity-50 [&>kbd]:rounded-[calc(var(--radius)-5px)] [&>svg:not([class*='size-'])]:size-4 order-last pr-2 has-[>button]:-mr-1 has-[>kbd]:mr-[-0.15rem]"
const inputGroupButton =
  'flex items-center gap-2 text-sm shadow-none size-6 rounded-[calc(var(--radius)-5px)] p-0 has-[>svg]:p-0'
const inputGroupInput =
  'h-9 w-full min-w-0 flex-1 rounded-none border-0 bg-transparent px-2.5 py-1 text-base shadow-none ring-0 transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:ring-0 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-0 md:text-sm dark:bg-transparent'

export type ComboboxInputProps = Props<'input'> & {
  /** Show the button that toggles the popup. @default true */
  showTrigger?: boolean
  /** Show the button that clears the value. @default false */
  showClear?: boolean
  /** Extra content after the input (inside the input group). */
  children?: RemixNode
}

/** The text input inside an input group, with the trigger and clear buttons. */
export function ComboboxInput(handle: Handle<ComboboxInputProps>) {
  return () => {
    let {
      class: className,
      mix,
      children,
      disabled = false,
      showTrigger = true,
      showClear = false,
      ...props
    } = handle.props
    return (
      <div
        data-slot="input-group"
        class={cn(inputGroup, 'w-auto', className)}
        mix={combobox.inputGroup()}
      >
        <input
          data-slot="input-group-control"
          {...(props as Props<'input'>)}
          disabled={disabled ? true : undefined}
          class={inputGroupInput}
          mix={[combobox.input(), mix]}
        />
        <div data-slot="input-group-addon" data-align="inline-end" class={inputGroupAddon}>
          {showTrigger ? (
            <ComboboxTrigger
              data-slot="input-group-button"
              disabled={disabled}
              class={cn(
                buttonVariants({ variant: 'ghost', size: 'icon-xs' }),
                inputGroupButton,
                'group-has-[[data-slot=combobox-clear]:not([hidden])]/input-group:hidden data-popup-open:bg-transparent',
              )}
            />
          ) : null}
          {showClear ? <ComboboxClear disabled={disabled} /> : null}
        </div>
        {children}
      </div>
    )
  }
}

export type ComboboxContentProps = Props<'div'> & combobox.ComboboxPopupOptions

export function ComboboxContent(handle: Handle<ComboboxContentProps>) {
  return () => {
    let {
      class: className,
      mix,
      side = 'bottom',
      sideOffset = 6,
      align = 'start',
      alignOffset = 0,
      collisionPadding,
      arrowPadding,
      anchor,
      initialFocus,
      finalFocus,
      ...props
    } = handle.props
    return (
      <div
        data-slot="combobox-content"
        {...props}
        class={cn(
          'group/combobox-content relative isolate z-50 max-h-(--available-height) w-(--anchor-width) max-w-(--available-width) min-w-(--anchor-width) origin-(--transform-origin) overflow-hidden rounded-md bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 *:data-[slot=input-group]:m-1 *:data-[slot=input-group]:mb-0 *:data-[slot=input-group]:h-8 *:data-[slot=input-group]:border-input/30 *:data-[slot=input-group]:bg-input/30 *:data-[slot=input-group]:shadow-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
          className,
        )}
        mix={[
          combobox.popup({
            side,
            sideOffset,
            align,
            alignOffset,
            collisionPadding,
            arrowPadding,
            anchor,
            initialFocus,
            finalFocus,
          }),
          mix,
        ]}
      />
    )
  }
}

export type ComboboxListProps = Omit<Props<'div'>, 'children'> & {
  /** Items, or a function rendering each filtered item (or group) of `Combobox`'s `items`. */
  children?: RemixNode | ((item: any, index: number) => RemixNode)
}

export function ComboboxList(handle: Handle<ComboboxListProps>) {
  return () => {
    let { class: className, mix, children, ...props } = handle.props
    return (
      <div
        data-slot="combobox-list"
        {...props}
        class={cn(
          'no-scrollbar max-h-[min(calc(--spacing(72)---spacing(9)),calc(var(--available-height)---spacing(9)))] scroll-py-1 overflow-y-auto overscroll-contain p-1 outline-none data-empty:p-0',
          className,
        )}
        mix={[combobox.list(), mix]}
      >
        {typeof children === 'function' ? (
          <combobox.Collection>{children}</combobox.Collection>
        ) : (
          children
        )}
      </div>
    )
  }
}

export type ComboboxCollectionProps = combobox.ComboboxCollectionProps

/** Renders filtered items (all of them, or a group's `items`). */
export function ComboboxCollection(handle: Handle<ComboboxCollectionProps>) {
  return () => <combobox.Collection {...handle.props} />
}

export type ComboboxItemProps = Props<'div'> & {
  /** The item's value. */
  value: unknown
  /** Text used for filtering and as the label. Defaults to the item's text. */
  label?: string
  disabled?: boolean
}

export function ComboboxItem(handle: Handle<ComboboxItemProps>) {
  return () => {
    let { class: className, mix, children, value, label, disabled, ...props } = handle.props
    return (
      <combobox.ItemContext value={value} label={label} disabled={disabled}>
        <div
          data-slot="combobox-item"
          {...props}
          class={cn(
            "relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground not-data-[variant=destructive]:data-highlighted:**:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
            className,
          )}
          mix={[combobox.item(), mix]}
        >
          {children}
          <span
            class="pointer-events-none absolute right-2 flex size-4 items-center justify-center"
            mix={combobox.itemIndicator()}
          >
            <CheckIcon class="pointer-events-none" />
          </span>
        </div>
      </combobox.ItemContext>
    )
  }
}

export type ComboboxGroupProps = Props<'div'>

export function ComboboxGroup(handle: Handle<ComboboxGroupProps>) {
  return () => {
    let { class: className, mix, ...props } = handle.props
    return (
      <div
        data-slot="combobox-group"
        {...props}
        class={cn(className)}
        mix={[combobox.group(), mix]}
      />
    )
  }
}

export type ComboboxLabelProps = Props<'div'>

/** The label of a `ComboboxGroup` (Base UI `GroupLabel`). */
export function ComboboxLabel(handle: Handle<ComboboxLabelProps>) {
  return () => {
    let { class: className, mix, ...props } = handle.props
    return (
      <div
        data-slot="combobox-label"
        {...props}
        class={cn('px-2 py-1.5 text-xs text-muted-foreground', className)}
        mix={[combobox.groupLabel(), mix]}
      />
    )
  }
}

export type ComboboxEmptyProps = Props<'div'>

/**
 * Shown while no items match. The element stays rendered (a live region) and its children are
 * rendered only while the list is empty.
 */
export function ComboboxEmpty(handle: Handle<ComboboxEmptyProps>) {
  return () => {
    let { class: className, mix, children, ...props } = handle.props
    return (
      <div
        data-slot="combobox-empty"
        {...props}
        class={cn(
          'flex w-full justify-center text-center text-sm text-muted-foreground not-empty:py-2',
          className,
        )}
        mix={[combobox.empty(), mix]}
      >
        <combobox.EmptyText>{children}</combobox.EmptyText>
      </div>
    )
  }
}

export type ComboboxSeparatorProps = Props<'div'>

export function ComboboxSeparator(handle: Handle<ComboboxSeparatorProps>) {
  return () => {
    let { class: className, mix, ...props } = handle.props
    return (
      <div
        data-slot="combobox-separator"
        {...props}
        class={cn('-mx-1 my-1 h-px bg-border', className)}
        mix={[combobox.separator(), mix]}
      />
    )
  }
}

export type ComboboxChipsProps = Props<'div'>

/** The chips container (multiple). The popup is positioned against it. */
export function ComboboxChips(handle: Handle<ComboboxChipsProps>) {
  return () => {
    let { class: className, mix, ...props } = handle.props
    return (
      <div
        data-slot="combobox-chips"
        {...props}
        class={cn(
          'flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border border-input bg-transparent bg-clip-padding px-2.5 py-1.5 text-sm shadow-xs transition-[color,box-shadow] focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 has-aria-invalid:border-destructive has-aria-invalid:ring-3 has-aria-invalid:ring-destructive/20 has-data-[slot=combobox-chip]:px-1.5 dark:bg-input/30 dark:has-aria-invalid:border-destructive/50 dark:has-aria-invalid:ring-destructive/40',
          className,
        )}
        mix={[combobox.chips(), mix]}
      />
    )
  }
}

export type ComboboxChipProps = Props<'div'> & {
  /** The selected value this chip shows. */
  value: unknown
  disabled?: boolean
  /** Show the remove button. @default true */
  showRemove?: boolean
}

export function ComboboxChip(handle: Handle<ComboboxChipProps>) {
  return () => {
    let {
      class: className,
      mix,
      children,
      value,
      disabled,
      showRemove = true,
      ...props
    } = handle.props
    return (
      <div
        data-slot="combobox-chip"
        {...props}
        class={cn(
          'flex h-[calc(--spacing(5.5))] w-fit items-center justify-center gap-1 rounded-sm bg-muted px-1.5 text-xs font-medium whitespace-nowrap text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50 has-disabled:pointer-events-none has-disabled:cursor-not-allowed has-disabled:opacity-50 has-data-[slot=combobox-chip-remove]:pr-0',
          className,
        )}
        mix={[combobox.chip({ value, disabled }), mix]}
      >
        {children}
        {showRemove ? (
          <button
            data-slot="combobox-chip-remove"
            aria-label="Remove"
            class={cn(
              buttonVariants({ variant: 'ghost', size: 'icon-xs' }),
              '-ml-1 opacity-50 hover:opacity-100',
            )}
            mix={combobox.chipRemove({ value, disabled })}
          >
            <XIcon class="pointer-events-none" />
          </button>
        ) : null}
      </div>
    )
  }
}

export type ComboboxChipsInputProps = Props<'input'>

/** The text input inside `ComboboxChips`. */
export function ComboboxChipsInput(handle: Handle<ComboboxChipsInputProps>) {
  return () => {
    let { class: className, mix, ...props } = handle.props
    return (
      <input
        data-slot="combobox-chip-input"
        {...(props as Props<'input'>)}
        class={cn(
          'min-w-16 flex-1 bg-transparent outline-none placeholder:text-muted-foreground',
          className,
        )}
        mix={[combobox.input(), mix]}
      />
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
const XIcon = icon('M18 6 6 18M6 6l12 12')
