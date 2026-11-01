import type { Handle, Props } from 'remix/component'
import * as collapsible from 'stems-ui/collapsible'

import { cn } from '#stems/lib/utils.ts'

/*
 * State hooks used for styling (set by stems-ui/collapsible):
 *   root:    data-open / data-closed, data-disabled
 *   trigger: aria-expanded, data-panel-open, data-disabled
 *   content: data-open / data-closed, data-starting-style / data-ending-style, hidden,
 *            --collapsible-panel-height / --collapsible-panel-width
 */

export type CollapsibleProps = Omit<Props<'div'>, keyof collapsible.CollapsibleContextProps> &
  collapsible.CollapsibleContextProps

export function Collapsible(handle: Handle<CollapsibleProps>) {
  return () => {
    let {
      class: className,
      mix,
      open,
      defaultOpen,
      onOpenChange,
      disabled,
      ...props
    } = handle.props

    return (
      <collapsible.Context
        open={open}
        defaultOpen={defaultOpen}
        onOpenChange={onOpenChange}
        disabled={disabled}
      >
        <div
          data-slot="collapsible"
          {...props}
          class={cn(className)}
          mix={[collapsible.root(), mix]}
        />
      </collapsible.Context>
    )
  }
}

export function CollapsibleTrigger(handle: Handle<Props<'button'>>) {
  return () => {
    let { class: className, mix, ...props } = handle.props

    return (
      <button
        data-slot="collapsible-trigger"
        {...props}
        class={cn(className)}
        mix={[collapsible.trigger(), mix]}
      />
    )
  }
}

export type CollapsibleContentProps = Props<'div'> & collapsible.CollapsiblePanelOptions

export function CollapsibleContent(handle: Handle<CollapsibleContentProps>) {
  return () => {
    let { class: className, mix, hiddenUntilFound, keepMounted, ...props } = handle.props

    return (
      <div
        data-slot="collapsible-content"
        {...props}
        // Keep closed panels hidden even when a caller adds a display utility (`flex`, `grid`).
        class={cn('[&[hidden]:not([hidden=until-found])]:hidden', className)}
        mix={[collapsible.panel({ hiddenUntilFound, keepMounted }), mix]}
      />
    )
  }
}

export { onCollapsibleChange } from 'stems-ui/collapsible'
export type { CollapsibleChangeEvent } from 'stems-ui/collapsible'
