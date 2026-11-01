import type { Handle, Props, RemixNode } from 'remix/component'
import * as autocomplete from 'stems-ui/autocomplete'

import { cn } from '#stems/lib/utils.ts'
import { buttonVariants } from '#stems/ui/button.tsx'

/*
 * Styled like `combobox` (shadcn/ui base-vega). shadcn has no autocomplete, so the parts use
 * Base UI's names. Behavior: stems-ui/autocomplete.
 *
 * The value is the input text: free text is kept, and suggestions only fill it in. `mode`
 * on `Autocomplete` adds inline completion (`'both'`, `'inline'`) or turns filtering off
 * (`'inline'`, `'none'`). Pass `name` (and `required`, `form`) to `Autocomplete`; they are set
 * on the input.
 *
 * The popup is shown in the top layer, so there is no Portal or Positioner element:
 * `AutocompleteContent` takes the positioner props directly and is positioned against the input
 * group.
 *
 * State hooks used for styling (set by stems-ui/autocomplete):
 *   input group: data-popup-open, data-disabled
 *   input:       aria-expanded, data-popup-open, data-list-empty
 *   content:     data-open / data-closed, data-side, data-empty, --anchor-width,
 *                --available-height, --transform-origin
 *   items:       data-highlighted, data-disabled
 */

export {
  onAutocompleteChange,
  onAutocompleteOpenChange,
  type AutocompleteChangeEvent,
  type AutocompleteChangeReason,
  type AutocompleteMode,
  type AutocompleteOpenChangeDetails,
  type AutocompleteOpenChangeEvent,
  type AutocompleteValueChangeDetails,
} from 'stems-ui/autocomplete'

export type AutocompleteProps = autocomplete.AutocompleteContextProps

export function Autocomplete(handle: Handle<AutocompleteProps>) {
  return () => <autocomplete.Context {...handle.props} />
}

export type AutocompleteValueProps = autocomplete.AutocompleteValueTextProps

/** The current text, or a function child that renders it. */
export function AutocompleteValue(handle: Handle<AutocompleteValueProps>) {
  return () => <autocomplete.ValueText {...handle.props} />
}

// shadcn's InputGroup / InputGroupAddon / InputGroupButton / InputGroupInput classes.
const inputGroup =
  'group/input-group relative flex h-9 w-full min-w-0 items-center rounded-md border border-input shadow-xs transition-[color,box-shadow] outline-none has-[[data-slot=input-group-control]:focus-visible]:border-ring has-[[data-slot=input-group-control]:focus-visible]:ring-3 has-[[data-slot=input-group-control]:focus-visible]:ring-ring/50 has-[[data-slot][aria-invalid=true]]:border-destructive has-[[data-slot][aria-invalid=true]]:ring-3 has-[[data-slot][aria-invalid=true]]:ring-destructive/20 dark:bg-input/30 dark:has-[[data-slot][aria-invalid=true]]:ring-destructive/40 has-[>[data-align=inline-end]]:[&>input]:pr-1.5 has-[>[data-align=inline-start]]:[&>input]:pl-1.5'
const inputGroupAddon =
  "flex h-auto cursor-text items-center justify-center gap-2 py-1.5 text-sm font-medium text-muted-foreground select-none group-data-disabled/input-group:opacity-50 [&>svg:not([class*='size-'])]:size-4"
const inputGroupButton =
  'flex items-center gap-2 text-sm shadow-none size-6 rounded-[calc(var(--radius)-5px)] p-0 has-[>svg]:p-0'
const inputGroupInput =
  'h-9 w-full min-w-0 flex-1 rounded-none border-0 bg-transparent px-2.5 py-1 text-base shadow-none ring-0 transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:ring-0 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-0 md:text-sm dark:bg-transparent'

export type AutocompleteTriggerProps = Props<'button'> & autocomplete.AutocompleteTriggerOptions

export function AutocompleteTrigger(handle: Handle<AutocompleteTriggerProps>) {
  return () => {
    let { class: className, mix, disabled, children, ...props } = handle.props
    return (
      <button
        data-slot="autocomplete-trigger"
        aria-label="Show suggestions"
        {...props}
        class={cn(
          buttonVariants({ variant: 'ghost', size: 'icon-xs' }),
          inputGroupButton,
          'data-popup-open:bg-transparent',
          className,
        )}
        mix={[autocomplete.trigger({ disabled }), mix]}
      >
        {children ?? <ChevronDownIcon class="pointer-events-none size-4 text-muted-foreground" />}
      </button>
    )
  }
}

export type AutocompleteClearProps = Props<'button'> & autocomplete.AutocompleteClearOptions

export function AutocompleteClear(handle: Handle<AutocompleteClearProps>) {
  return () => {
    let { class: className, mix, disabled, keepMounted, children, ...props } = handle.props
    return (
      <button
        data-slot="autocomplete-clear"
        aria-label="Clear"
        {...props}
        class={cn(
          buttonVariants({ variant: 'ghost', size: 'icon-xs' }),
          inputGroupButton,
          className,
        )}
        mix={[autocomplete.clear({ disabled, keepMounted }), mix]}
      >
        {children ?? <XIcon class="pointer-events-none" />}
      </button>
    )
  }
}

export type AutocompleteInputProps = Props<'input'> & {
  /** Show a search icon before the text. @default false */
  showSearchIcon?: boolean
  /** Show a button that toggles the suggestions. @default false */
  showTrigger?: boolean
  /** Show a button that clears the text. @default false */
  showClear?: boolean
  /** Extra content after the input (inside the input group). */
  children?: RemixNode
}

/** The text input inside an input group, with optional search icon, trigger, and clear. */
export function AutocompleteInput(handle: Handle<AutocompleteInputProps>) {
  return () => {
    let {
      class: className,
      mix,
      children,
      disabled = false,
      showSearchIcon = false,
      showTrigger = false,
      showClear = false,
      ...props
    } = handle.props
    return (
      <div
        data-slot="input-group"
        class={cn(inputGroup, className)}
        mix={autocomplete.inputGroup()}
      >
        {showSearchIcon ? (
          <div
            data-slot="input-group-addon"
            data-align="inline-start"
            class={cn(inputGroupAddon, 'order-first pl-2.5')}
          >
            <SearchIcon />
          </div>
        ) : null}
        <input
          data-slot="input-group-control"
          {...(props as Props<'input'>)}
          disabled={disabled ? true : undefined}
          class={inputGroupInput}
          mix={[autocomplete.input(), mix]}
        />
        {showTrigger || showClear ? (
          <div
            data-slot="input-group-addon"
            data-align="inline-end"
            class={cn(inputGroupAddon, 'order-last pr-2 has-[>button]:-mr-1')}
          >
            {showClear ? <AutocompleteClear disabled={disabled} /> : null}
            {showTrigger ? <AutocompleteTrigger disabled={disabled} /> : null}
          </div>
        ) : null}
        {children}
      </div>
    )
  }
}

export type AutocompleteContentProps = Props<'div'> & autocomplete.AutocompletePopupOptions

export function AutocompleteContent(handle: Handle<AutocompleteContentProps>) {
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
        data-slot="autocomplete-content"
        {...props}
        class={cn(
          'group/autocomplete-content relative isolate z-50 max-h-(--available-height) w-(--anchor-width) max-w-(--available-width) min-w-(--anchor-width) origin-(--transform-origin) overflow-hidden rounded-md bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
          className,
        )}
        mix={[
          autocomplete.popup({
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

export type AutocompleteListProps = Omit<Props<'div'>, 'children'> & {
  /** Suggestions, or a function rendering each filtered item (or group) of `items`. */
  children?: RemixNode | ((item: any, index: number) => RemixNode)
}

export function AutocompleteList(handle: Handle<AutocompleteListProps>) {
  return () => {
    let { class: className, mix, children, ...props } = handle.props
    return (
      <div
        data-slot="autocomplete-list"
        {...props}
        class={cn(
          'no-scrollbar max-h-[min(--spacing(72),var(--available-height))] scroll-py-1 overflow-y-auto overscroll-contain p-1 outline-none data-empty:p-0',
          className,
        )}
        mix={[autocomplete.list(), mix]}
      >
        {typeof children === 'function' ? (
          <autocomplete.Collection>{children}</autocomplete.Collection>
        ) : (
          children
        )}
      </div>
    )
  }
}

export type AutocompleteCollectionProps = autocomplete.AutocompleteCollectionProps

/** Renders filtered suggestions (all of them, or a group's `items`). */
export function AutocompleteCollection(handle: Handle<AutocompleteCollectionProps>) {
  return () => <autocomplete.Collection {...handle.props} />
}

export type AutocompleteItemProps = Props<'div'> & autocomplete.AutocompleteItemOptions

export function AutocompleteItem(handle: Handle<AutocompleteItemProps>) {
  return () => {
    let { class: className, mix, value, label, disabled, ...props } = handle.props
    return (
      <div
        data-slot="autocomplete-item"
        {...props}
        class={cn(
          "relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-2 text-sm outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-highlighted:**:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
          className,
        )}
        mix={[autocomplete.item({ value, label, disabled }), mix]}
      />
    )
  }
}

export type AutocompleteGroupProps = Props<'div'>

export function AutocompleteGroup(handle: Handle<AutocompleteGroupProps>) {
  return () => {
    let { class: className, mix, ...props } = handle.props
    return (
      <div
        data-slot="autocomplete-group"
        {...props}
        class={cn(className)}
        mix={[autocomplete.group(), mix]}
      />
    )
  }
}

export type AutocompleteGroupLabelProps = Props<'div'>

export function AutocompleteGroupLabel(handle: Handle<AutocompleteGroupLabelProps>) {
  return () => {
    let { class: className, mix, ...props } = handle.props
    return (
      <div
        data-slot="autocomplete-group-label"
        {...props}
        class={cn('px-2 py-1.5 text-xs text-muted-foreground', className)}
        mix={[autocomplete.groupLabel(), mix]}
      />
    )
  }
}

export type AutocompleteEmptyProps = Props<'div'>

/** Shown while no suggestions match (a live region; children render only while empty). */
export function AutocompleteEmpty(handle: Handle<AutocompleteEmptyProps>) {
  return () => {
    let { class: className, mix, children, ...props } = handle.props
    return (
      <div
        data-slot="autocomplete-empty"
        {...props}
        class={cn(
          'flex w-full justify-center text-center text-sm text-muted-foreground not-empty:py-2',
          className,
        )}
        mix={[autocomplete.empty(), mix]}
      >
        <autocomplete.EmptyText>{children}</autocomplete.EmptyText>
      </div>
    )
  }
}

export type AutocompleteStatusProps = Props<'div'>

/** A polite live region for status messages (e.g. "Loading…", result counts). */
export function AutocompleteStatus(handle: Handle<AutocompleteStatusProps>) {
  return () => {
    let { class: className, mix, ...props } = handle.props
    return (
      <div
        data-slot="autocomplete-status"
        {...props}
        class={cn(
          'flex w-full items-center gap-2 px-2 text-sm text-muted-foreground not-empty:py-2',
          className,
        )}
        mix={[autocomplete.status(), mix]}
      />
    )
  }
}

export type AutocompleteSeparatorProps = Props<'div'>

export function AutocompleteSeparator(handle: Handle<AutocompleteSeparatorProps>) {
  return () => {
    let { class: className, mix, ...props } = handle.props
    return (
      <div
        data-slot="autocomplete-separator"
        {...props}
        class={cn('-mx-1 my-1 h-px bg-border', className)}
        mix={[autocomplete.separator(), mix]}
      />
    )
  }
}

function icon(...paths: string[]) {
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
        {paths.map((d) => (
          <path d={d} />
        ))}
      </svg>
    )
  }
}

const ChevronDownIcon = icon('m6 9 6 6 6-6')
const XIcon = icon('M18 6 6 18M6 6l12 12')
const SearchIcon = icon('m21 21-4.34-4.34', 'M11 3a8 8 0 1 0 0 16 8 8 0 0 0 0-16Z')
