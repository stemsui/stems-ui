import type { Handle, Props } from 'remix/component'
import * as toolbar from 'stems-ui/toolbar'

import { cn } from '#stems/lib/utils.ts'
import { buttonVariants } from '#stems/ui/button.tsx'
import { toggleButtonVariants, type ToggleButtonVariantProps } from '#stems/ui/toggle-button.tsx'

/*
 * A toolbar styled to match shadcn/ui's button, toggle, and separator (shadcn has no toolbar).
 * Behavior: stems-ui/toolbar.
 *
 * Every focusable control in the toolbar shares one roving tab stop. `ToolbarButton`,
 * `ToolbarLink`, and `ToolbarInput` are toolbar items already. To put another component in the
 * toolbar, add the toolbar mixin to it:
 *
 *   <ToggleButtonGroupItem value="bold" mix={toolbarItem()} />   // toggle buttons
 *   <DropdownMenuTrigger mix={toolbarButton()} />                // menu / popover triggers
 *   <SelectTrigger mix={toolbarItem()} />                         // select triggers
 *
 * `toolbarButton()` keeps a disabled trigger focusable: pass `toolbarButton({ disabled: true })`
 * instead of disabling the trigger.
 *
 * State hooks used for styling (set by stems-ui/toolbar):
 *   toolbar:    data-orientation, data-disabled
 *   button:     data-orientation, data-disabled, data-focusable, aria-pressed (with toggleButton)
 *   input:      data-orientation, data-disabled, aria-disabled
 *   group:      data-orientation, data-disabled
 *   separator:  data-orientation (perpendicular to the toolbar)
 */

/** Adds any element to the toolbar's roving focus (`stems-ui/toolbar` `item()`). */
export const toolbarItem = toolbar.item

/** Button behavior as a toolbar item, for composing with triggers (`stems-ui/toolbar` `button()`). */
export const toolbarButton = toolbar.button

export type ToolbarProps = Props<'div'> & Omit<toolbar.ToolbarContextProps, 'children'>

export function Toolbar(handle: Handle<ToolbarProps>) {
  return () => {
    let {
      class: className,
      mix,
      children,
      orientation,
      loopFocus,
      disabled,
      ...props
    } = handle.props

    return (
      <toolbar.Context orientation={orientation} loopFocus={loopFocus} disabled={disabled}>
        <div
          data-slot="toolbar"
          {...props}
          class={cn(
            'flex w-fit items-center gap-1 rounded-md border bg-background p-1 shadow-xs data-[orientation=vertical]:flex-col data-[orientation=vertical]:items-stretch',
            className,
          )}
          mix={[toolbar.root(), mix]}
        >
          {children}
        </div>
      </toolbar.Context>
    )
  }
}

export type ToolbarButtonProps = Props<'button'> &
  toolbar.ToolbarButtonOptions &
  ToggleButtonVariantProps

/**
 * A toolbar button, styled like a toggle button (so `aria-pressed` shows when it's composed with
 * `toggleButton()`). Disabled buttons stay focusable unless `focusableWhenDisabled={false}`.
 */
export function ToolbarButton(handle: Handle<ToolbarButtonProps>) {
  return () => {
    let {
      class: className,
      mix,
      variant,
      size = 'sm',
      disabled,
      focusableWhenDisabled,
      nativeButton,
      ...props
    } = handle.props

    return (
      <button
        data-slot="toolbar-button"
        {...props}
        class={toggleButtonVariants({
          variant,
          size,
          class: cn('data-disabled:pointer-events-none data-disabled:opacity-50', className),
        })}
        mix={[toolbar.button({ disabled, focusableWhenDisabled, nativeButton }), mix]}
      />
    )
  }
}

export function ToolbarLink(handle: Handle<Props<'a'>>) {
  return () => {
    let { class: className, mix, ...props } = handle.props
    return (
      <a
        data-slot="toolbar-link"
        {...props}
        class={buttonVariants({
          variant: 'link',
          size: 'sm',
          class: cn('text-muted-foreground hover:text-foreground', className),
        })}
        mix={[toolbar.link(), mix]}
      />
    )
  }
}

export type ToolbarInputProps = Omit<Props<'input'>, 'disabled'> & toolbar.ToolbarInputOptions

export function ToolbarInput(handle: Handle<ToolbarInputProps>) {
  return () => {
    let { class: className, mix, disabled, focusableWhenDisabled, ...rest } = handle.props
    // Rest-destructuring flattens the `type`-discriminated input props union; restore it.
    let props = rest as Props<'input'>
    return (
      <input
        data-slot="toolbar-input"
        {...props}
        class={cn(
          'h-8 w-40 min-w-0 rounded-md border border-input bg-transparent px-2.5 py-1 text-sm shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 data-disabled:opacity-50 dark:bg-input/30',
          className,
        )}
        mix={[toolbar.input({ disabled, focusableWhenDisabled }), mix]}
      />
    )
  }
}

export type ToolbarGroupProps = Props<'div'> & { disabled?: boolean }

export function ToolbarGroup(handle: Handle<ToolbarGroupProps>) {
  return () => {
    let { class: className, mix, disabled, children, ...props } = handle.props
    return (
      <toolbar.GroupContext disabled={disabled}>
        <div
          data-slot="toolbar-group"
          {...props}
          class={cn(
            'flex items-center gap-1 data-[orientation=vertical]:flex-col data-[orientation=vertical]:items-stretch',
            className,
          )}
          mix={[toolbar.group(), mix]}
        >
          {children}
        </div>
      </toolbar.GroupContext>
    )
  }
}

export type ToolbarSeparatorProps = Props<'div'> & toolbar.ToolbarSeparatorOptions

export function ToolbarSeparator(handle: Handle<ToolbarSeparatorProps>) {
  return () => {
    let { class: className, mix, orientation, ...props } = handle.props
    return (
      <div
        data-slot="toolbar-separator"
        {...props}
        class={cn(
          'shrink-0 bg-border data-[orientation=horizontal]:mx-0.5 data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-auto data-[orientation=vertical]:mx-0.5 data-[orientation=vertical]:h-5 data-[orientation=vertical]:w-px',
          className,
        )}
        mix={[toolbar.separator({ orientation }), mix]}
      />
    )
  }
}
