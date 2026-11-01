import type { Handle, Props, RemixNode } from 'remix/component'
import * as previewCard from 'stems-ui/preview-card'

import { cn } from '#stems/lib/utils.ts'

/*
 * Styled after shadcn/ui's Base UI hover card (base-vega), under Base UI's name: Preview Card.
 * Behavior: stems-ui/preview-card.
 *
 * The popup is shown in the top layer (`popover="manual"`), so there is no Portal or Positioner
 * element: `PreviewCardContent` takes the positioner props (`side`, `align`, `sideOffset`,
 * `alignOffset`, `collisionPadding`) directly.
 *
 * State hooks used for styling (set by stems-ui/preview-card):
 *   trigger: data-popup-open
 *   content: data-open / data-closed, data-side, data-align, --transform-origin,
 *            --available-width / --available-height, --anchor-width / --anchor-height
 *
 * The card is a visual preview for sighted pointer and keyboard users: keep everything in it
 * available on the linked page.
 */

export {
  onPreviewCardChange,
  type PreviewCardChangeEvent,
  type PreviewCardOpenChangeDetails,
  type PreviewCardOpenChangeReason,
} from 'stems-ui/preview-card'

export type PreviewCardProps = previewCard.PreviewCardContextProps

export function PreviewCard(handle: Handle<PreviewCardProps>) {
  return () => <previewCard.Context {...handle.props} />
}

export type PreviewCardTriggerProps = Props<'a'> & previewCard.PreviewCardTriggerOptions

export function PreviewCardTrigger(handle: Handle<PreviewCardTriggerProps>) {
  return () => {
    let { mix, delay, closeDelay, ...props } = handle.props

    return (
      <a
        data-slot="preview-card-trigger"
        {...props}
        mix={[previewCard.trigger({ delay, closeDelay }), mix]}
      />
    )
  }
}

export type PreviewCardContentProps = Props<'div'> &
  previewCard.PreviewCardPopupOptions & {
    children?: RemixNode
  }

export function PreviewCardContent(handle: Handle<PreviewCardContentProps>) {
  return () => {
    let {
      class: className,
      mix,
      side = 'bottom',
      sideOffset = 4,
      align = 'center',
      alignOffset = 4,
      collisionPadding,
      arrowPadding,
      anchor,
      ...props
    } = handle.props

    return (
      <div
        data-slot="preview-card-content"
        {...props}
        class={cn(
          'z-50 w-64 origin-(--transform-origin) rounded-lg bg-popover p-4 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-hidden duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
          className,
        )}
        mix={[
          previewCard.popup({
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
      />
    )
  }
}
