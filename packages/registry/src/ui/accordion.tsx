import type { Handle, Props } from 'remix/component'
import * as accordion from 'stems-ui/accordion'

import { cn } from '#stems/lib/utils.ts'

/*
 * State hooks used for styling (set by stems-ui/accordion):
 *   root:    data-orientation, data-disabled
 *   item:    data-open, data-disabled, data-index
 *   trigger: aria-expanded, data-panel-open, data-disabled, data-index
 *   content: data-open / data-closed, data-starting-style / data-ending-style, hidden,
 *            --accordion-panel-height / --accordion-panel-width
 *
 * shadcn animates the panel with tw-animate-css keyframes (`animate-accordion-down/up`). Stems
 * uses a height transition on --accordion-panel-height instead, so no extra CSS package is
 * needed.
 */

export type AccordionProps = Omit<Props<'div'>, keyof accordion.AccordionContextProps> &
  accordion.AccordionContextProps

export function Accordion(handle: Handle<AccordionProps>) {
  return () => {
    let {
      class: className,
      mix,
      value,
      defaultValue,
      onValueChange,
      multiple,
      disabled,
      orientation,
      loopFocus,
      hiddenUntilFound,
      keepMounted,
      ...props
    } = handle.props

    return (
      <accordion.Context
        value={value}
        defaultValue={defaultValue}
        onValueChange={onValueChange}
        multiple={multiple}
        disabled={disabled}
        orientation={orientation}
        loopFocus={loopFocus}
        hiddenUntilFound={hiddenUntilFound}
        keepMounted={keepMounted}
      >
        <div
          data-slot="accordion"
          {...props}
          class={cn('flex w-full flex-col', className)}
          mix={[accordion.root(), mix]}
        />
      </accordion.Context>
    )
  }
}

export type AccordionItemProps = Omit<Props<'div'>, keyof accordion.AccordionItemContextProps> &
  accordion.AccordionItemContextProps

export function AccordionItem(handle: Handle<AccordionItemProps>) {
  return () => {
    let { class: className, mix, value, disabled, onOpenChange, ...props } = handle.props

    return (
      <accordion.ItemContext value={value} disabled={disabled} onOpenChange={onOpenChange}>
        <div
          data-slot="accordion-item"
          {...props}
          class={cn('not-last:border-b', className)}
          mix={[accordion.item(), mix]}
        />
      </accordion.ItemContext>
    )
  }
}

export function AccordionTrigger(handle: Handle<Props<'button'>>) {
  return () => {
    let { class: className, mix, children, ...props } = handle.props

    return (
      <h3 class="flex" mix={accordion.header()}>
        <button
          data-slot="accordion-trigger"
          {...props}
          class={cn(
            'group/accordion-trigger relative flex flex-1 items-start justify-between rounded-md border border-transparent py-4 text-left text-sm font-medium transition-all outline-none hover:underline focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:after:border-ring aria-disabled:pointer-events-none aria-disabled:opacity-50 data-disabled:pointer-events-none data-disabled:opacity-50 **:data-[slot=accordion-trigger-icon]:ml-auto **:data-[slot=accordion-trigger-icon]:size-4 **:data-[slot=accordion-trigger-icon]:text-muted-foreground',
            className,
          )}
          mix={[accordion.trigger(), mix]}
        >
          {children}
          <ChevronDownIcon class="pointer-events-none shrink-0 group-aria-expanded/accordion-trigger:hidden" />
          <ChevronUpIcon class="pointer-events-none hidden shrink-0 group-aria-expanded/accordion-trigger:inline" />
        </button>
      </h3>
    )
  }
}

export type AccordionContentProps = Props<'div'> & accordion.AccordionPanelOptions

export function AccordionContent(handle: Handle<AccordionContentProps>) {
  return () => {
    let { class: className, mix, children, hiddenUntilFound, keepMounted, ...props } = handle.props

    return (
      <div
        data-slot="accordion-content"
        {...props}
        class="h-(--accordion-panel-height) overflow-hidden text-sm transition-[height] duration-200 ease-out data-starting-style:h-0 data-ending-style:h-0 motion-reduce:transition-none [&[hidden]:not([hidden=until-found])]:hidden"
        mix={[accordion.panel({ hiddenUntilFound, keepMounted }), mix]}
      >
        <div
          class={cn(
            'pt-0 pb-4 [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground [&_p:not(:last-child)]:mb-4',
            className,
          )}
        >
          {children}
        </div>
      </div>
    )
  }
}

export { onAccordionChange } from 'stems-ui/accordion'
export type { AccordionChangeEvent } from 'stems-ui/accordion'

function ChevronDownIcon(handle: Handle<{ class?: string }>) {
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
      data-slot="accordion-trigger-icon"
      class={handle.props.class}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

function ChevronUpIcon(handle: Handle<{ class?: string }>) {
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
      data-slot="accordion-trigger-icon"
      class={handle.props.class}
    >
      <path d="m18 15-6-6-6 6" />
    </svg>
  )
}
