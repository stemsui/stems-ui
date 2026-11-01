import type { Handle, Props, RemixNode } from 'remix/component'
import * as tabs from 'stems-ui/tabs'

import { cn } from '#stems/lib/utils.ts'

/*
 * Styled after shadcn/ui's Base UI tabs (base-vega). Behavior: stems-ui/tabs.
 *
 * shadcn's `data-horizontal:` / `data-vertical:` variants come from `shadcn/tailwind.css`; they are
 * spelled `data-[orientation=...]:` here so the component works without that import.
 *
 * State hooks used for styling (set by stems-ui/tabs):
 *   root, list, trigger, content: data-orientation="horizontal|vertical"
 *   trigger: data-active, data-disabled, :disabled
 *   content: [hidden]
 */

export { onTabsChange, type TabsChangeEvent } from 'stems-ui/tabs'

type TabsContextOptions = Omit<tabs.TabsContextProps, 'children'>

export type TabsProps = Omit<Props<'div'>, keyof TabsContextOptions> & TabsContextOptions

export function Tabs(handle: Handle<TabsProps>) {
  return () => {
    let {
      class: className,
      mix,
      value,
      defaultValue,
      onValueChange,
      orientation = 'horizontal',
      children,
      ...props
    } = handle.props

    return (
      <tabs.Context
        value={value}
        defaultValue={defaultValue}
        onValueChange={onValueChange}
        orientation={orientation}
      >
        <div
          data-slot="tabs"
          {...props}
          class={cn('group/tabs flex gap-2 data-[orientation=horizontal]:flex-col', className)}
          mix={[tabs.root(), mix]}
        >
          {children}
        </div>
      </tabs.Context>
    )
  }
}

export type TabsListVariant = 'default' | 'line'

const tabsListVariantClasses: Record<TabsListVariant, string> = {
  default: 'bg-muted',
  line: 'gap-1 bg-transparent',
}

/** Class names for a tabs list, like shadcn's `tabsListVariants` (cva). */
export function tabsListVariants({ variant = 'default' }: { variant?: TabsListVariant } = {}) {
  return cn(
    'group/tabs-list inline-flex w-fit items-center justify-center rounded-lg p-[3px] text-muted-foreground group-data-[orientation=horizontal]/tabs:h-9 group-data-[orientation=vertical]/tabs:h-fit group-data-[orientation=vertical]/tabs:flex-col data-[variant=line]:rounded-none',
    tabsListVariantClasses[variant],
  )
}

export type TabsListProps = Props<'div'> &
  tabs.TabsListOptions & {
    variant?: TabsListVariant
  }

export function TabsList(handle: Handle<TabsListProps>) {
  return () => {
    let {
      class: className,
      mix,
      variant = 'default',
      activateOnFocus,
      loopFocus,
      ...props
    } = handle.props

    return (
      <div
        data-slot="tabs-list"
        data-variant={variant}
        {...props}
        class={cn(tabsListVariants({ variant }), className)}
        mix={[tabs.list({ activateOnFocus, loopFocus }), mix]}
      />
    )
  }
}

export type TabsTriggerProps = Props<'button'> & tabs.TabsTabOptions

export function TabsTrigger(handle: Handle<TabsTriggerProps>) {
  return () => {
    let { class: className, mix, value, disabled, ...props } = handle.props

    return (
      <button
        data-slot="tabs-trigger"
        {...props}
        class={cn(
          "relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-sm font-medium whitespace-nowrap text-foreground/60 transition-all group-data-[orientation=vertical]/tabs:w-full group-data-[orientation=vertical]/tabs:justify-start hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-disabled:pointer-events-none aria-disabled:opacity-50 dark:text-muted-foreground dark:hover:text-foreground group-data-[variant=default]/tabs-list:data-active:shadow-sm group-data-[variant=line]/tabs-list:data-active:shadow-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
          'group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:data-active:bg-transparent dark:group-data-[variant=line]/tabs-list:data-active:border-transparent dark:group-data-[variant=line]/tabs-list:data-active:bg-transparent',
          'data-active:bg-background data-active:text-foreground dark:data-active:border-input dark:data-active:bg-input/30 dark:data-active:text-foreground',
          'after:absolute after:bg-foreground after:opacity-0 after:transition-opacity group-data-[orientation=horizontal]/tabs:after:inset-x-0 group-data-[orientation=horizontal]/tabs:after:bottom-[-5px] group-data-[orientation=horizontal]/tabs:after:h-0.5 group-data-[orientation=vertical]/tabs:after:inset-y-0 group-data-[orientation=vertical]/tabs:after:-right-1 group-data-[orientation=vertical]/tabs:after:w-0.5 group-data-[variant=line]/tabs-list:data-active:after:opacity-100',
          className,
        )}
        mix={[tabs.tab({ value, disabled }), mix]}
      />
    )
  }
}

export type TabsContentProps = Props<'div'> &
  tabs.TabsPanelOptions & {
    /**
     * Keep the panel's children rendered while it is hidden. The panel element itself always
     * stays in the DOM (hidden and inert).
     * @default false
     */
    keepMounted?: boolean
    children?: RemixNode
  }

export function TabsContent(handle: Handle<TabsContentProps>) {
  return () => {
    let { class: className, mix, value, keepMounted = false, children, ...props } = handle.props
    let active = handle.context.get(tabs.Context).isActive(value)

    return (
      <div
        data-slot="tabs-content"
        {...props}
        class={cn('flex-1 text-sm outline-none', className)}
        mix={[tabs.panel({ value }), mix]}
      >
        {active || keepMounted ? children : null}
      </div>
    )
  }
}
