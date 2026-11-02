import type { Handle, Props, RemixNode } from 'remix/component'
import * as popover from 'stems-ui/popover'

import { cn } from '#stems/lib/utils.ts'

/*
 * Styled after shadcn/ui's Base UI popover (base-vega). Behavior: stems-ui/popover.
 *
 * The popup is shown in the top layer (`popover="manual"`), so there is no Portal or Positioner
 * element: `PopoverContent` takes the positioner props (`side`, `align`, `sideOffset`,
 * `alignOffset`, `collisionPadding`) directly.
 *
 * State hooks used for styling (set by stems-ui/popover):
 *   trigger: aria-expanded, data-popup-open
 *   content: data-open / data-closed, data-side, data-align, --transform-origin,
 *            --available-width / --available-height, --anchor-width / --anchor-height
 *
 * To style the trigger as a button, pass `class={buttonVariants({ variant: 'outline' })}`.
 */

export {
  onPopoverChange,
  type PopoverChangeEvent,
  type PopoverOpenChangeDetails,
  type PopoverOpenChangeReason,
} from 'stems-ui/popover'

export type PopoverProps<Payload = unknown> = popover.PopoverContextProps<Payload>

/** `handle` connects detached `PopoverTrigger`s; `children` may be a function of `{ payload }`. */
export function Popover<Payload = unknown>(handle: Handle<PopoverProps<Payload>>) {
  return () => <popover.Context {...handle.props} />
}

export type PopoverTriggerProps = Props<'button'> & popover.PopoverTriggerOptions

export function PopoverTrigger(handle: Handle<PopoverTriggerProps>) {
  return () => {
    let {
      mix,
      disabled,
      openOnHover,
      delay,
      closeDelay,
      handle: popoverHandle,
      payload,
      ...props
    } = handle.props

    return (
      <button
        data-slot="popover-trigger"
        {...props}
        mix={[
          popover.trigger({
            disabled,
            openOnHover,
            delay,
            closeDelay,
            handle: popoverHandle,
            payload,
          }),
          mix,
        ]}
      />
    )
  }
}

export type PopoverContentProps = Props<'div'> &
  popover.PopoverPopupOptions & {
    children?: RemixNode
  }

export function PopoverContent(handle: Handle<PopoverContentProps>) {
  return () => {
    let {
      class: className,
      mix,
      side = 'bottom',
      align = 'center',
      sideOffset = 4,
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
        data-slot="popover-content"
        {...props}
        class={cn(
          'z-50 flex w-72 origin-(--transform-origin) flex-col gap-4 rounded-md bg-popover p-4 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-hidden duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
          className,
        )}
        mix={[
          popover.popup({
            side,
            align,
            sideOffset,
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

export function PopoverHeader(handle: Handle<Props<'div'>>) {
  return () => {
    let { class: className, ...props } = handle.props

    return (
      <div
        data-slot="popover-header"
        {...props}
        class={cn('flex flex-col gap-1 text-sm', className)}
      />
    )
  }
}

export function PopoverTitle(handle: Handle<Props<'h2'>>) {
  return () => {
    let { class: className, mix, ...props } = handle.props

    return (
      <h2
        data-slot="popover-title"
        {...props}
        class={cn('font-medium', className)}
        mix={[popover.title(), mix]}
      />
    )
  }
}

export function PopoverDescription(handle: Handle<Props<'p'>>) {
  return () => {
    let { class: className, mix, ...props } = handle.props

    return (
      <p
        data-slot="popover-description"
        {...props}
        class={cn('text-muted-foreground', className)}
        mix={[popover.description(), mix]}
      />
    )
  }
}
