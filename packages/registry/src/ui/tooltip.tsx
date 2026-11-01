import type { Handle, Props, RemixNode } from 'remix/component'
import * as tooltip from 'stems-ui/tooltip'

import { cn } from '#stems/lib/utils.ts'

/*
 * Styled after shadcn/ui's Base UI tooltip (base-vega). Behavior: stems-ui/tooltip.
 *
 * The popup is shown in the top layer (`popover="manual"`), so there is no Portal or Positioner
 * element: `TooltipContent` takes the positioner props (`side`, `align`, `sideOffset`,
 * `alignOffset`, `collisionPadding`) directly and renders the arrow.
 *
 * Like shadcn, `TooltipProvider` defaults `delay` to 0. Wrap a group of tooltips (or the app)
 * in it so adjacent tooltips open instantly once one is open.
 *
 * State hooks used for styling (set by stems-ui/tooltip):
 *   trigger: data-popup-open, data-trigger-disabled
 *   content: data-open / data-closed, data-side, data-align, data-instant, --transform-origin
 *   arrow:   data-side, data-uncentered
 *
 * `data-instant:animate-none` (not in shadcn) skips the animation when moving between grouped
 * tooltips and on Escape / press, as Base UI intends.
 *
 * Tooltips are visual hints only: give the trigger an accessible name (`aria-label`) that
 * matches the tooltip text.
 */

export {
  onTooltipChange,
  type TooltipChangeEvent,
  type TooltipOpenChangeDetails,
  type TooltipOpenChangeReason,
} from 'stems-ui/tooltip'

export type TooltipProviderProps = tooltip.TooltipProviderProps

export function TooltipProvider(handle: Handle<TooltipProviderProps>) {
  return () => {
    let { delay = 0, ...props } = handle.props
    return <tooltip.Provider delay={delay} {...props} />
  }
}

export type TooltipProps = tooltip.TooltipContextProps

export function Tooltip(handle: Handle<TooltipProps>) {
  return () => <tooltip.Context {...handle.props} />
}

export type TooltipTriggerProps = Props<'button'> & tooltip.TooltipTriggerOptions

export function TooltipTrigger(handle: Handle<TooltipTriggerProps>) {
  return () => {
    let { mix, delay, closeDelay, closeOnClick, disabled, ...props } = handle.props

    return (
      <button
        type="button"
        data-slot="tooltip-trigger"
        {...props}
        mix={[tooltip.trigger({ delay, closeDelay, closeOnClick, disabled }), mix]}
      />
    )
  }
}

export type TooltipContentProps = Props<'div'> &
  tooltip.TooltipPopupOptions & {
    children?: RemixNode
  }

export function TooltipContent(handle: Handle<TooltipContentProps>) {
  return () => {
    let {
      class: className,
      mix,
      side = 'top',
      sideOffset = 4,
      align = 'center',
      alignOffset = 0,
      collisionPadding,
      arrowPadding,
      anchor,
      children,
      ...props
    } = handle.props

    return (
      <div
        data-slot="tooltip-content"
        {...props}
        class={cn(
          'z-50 inline-flex w-fit max-w-xs origin-(--transform-origin) items-center gap-1.5 overflow-visible rounded-md bg-foreground px-3 py-1.5 text-xs text-background has-data-[slot=kbd]:pr-1.5 data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 **:data-[slot=kbd]:relative **:data-[slot=kbd]:isolate **:data-[slot=kbd]:z-50 **:data-[slot=kbd]:rounded-sm data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 data-instant:animate-none',
          className,
        )}
        mix={[
          tooltip.popup({
            side,
            sideOffset,
            align,
            alignOffset,
            collisionPadding,
            arrowPadding,
            anchor,
          }),
          mix,
        ]}
      >
        {children}
        <div
          data-slot="tooltip-arrow"
          class="z-50 size-2.5 translate-y-[calc(-50%-2px)] rotate-45 rounded-[2px] bg-foreground fill-foreground data-[side=bottom]:top-1 data-[side=inline-end]:top-1/2! data-[side=inline-end]:-left-1 data-[side=inline-end]:-translate-y-1/2 data-[side=inline-start]:top-1/2! data-[side=inline-start]:-right-1 data-[side=inline-start]:-translate-y-1/2 data-[side=left]:top-1/2! data-[side=left]:-right-1 data-[side=left]:-translate-y-1/2 data-[side=right]:top-1/2! data-[side=right]:-left-1 data-[side=right]:-translate-y-1/2 data-[side=top]:-bottom-2.5"
          mix={tooltip.arrow()}
        />
      </div>
    )
  }
}
