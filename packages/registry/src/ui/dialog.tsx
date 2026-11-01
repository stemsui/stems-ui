import type { Handle, Props } from 'remix/component'
import * as dialog from 'stems-ui/dialog'

import { cn } from '#stems/lib/utils.ts'
import { buttonVariants } from '#stems/ui/button.tsx'

/*
 * State hooks used for styling (set by stems-ui/dialog):
 *   trigger: aria-expanded, data-popup-open, data-disabled
 *   content: the native <dialog> (`:open` while shown), data-open / data-closed,
 *            data-starting-style / data-ending-style, data-nested, data-nested-dialog-open,
 *            --nested-dialogs
 *
 * The popup is a native <dialog> opened with showModal(), so it sits in the top layer with no
 * portal, and shadcn's DialogOverlay becomes the dialog's own `::backdrop` (styled with
 * Tailwind's `backdrop:` variant). Closed dialogs are `display: none` from the UA stylesheet,
 * so the layout class is `open:grid`, never a bare `grid`. The exit animation finishes before
 * `dialog.close()` runs.
 */

export type DialogProps = dialog.DialogContextProps

export function Dialog(handle: Handle<DialogProps>) {
  return () => <dialog.Context {...handle.props} />
}

export type DialogTriggerProps = Props<'button'> & dialog.DialogTriggerOptions

export function DialogTrigger(handle: Handle<DialogTriggerProps>) {
  return () => {
    let { class: className, mix, disabled, ...props } = handle.props
    return (
      <button
        data-slot="dialog-trigger"
        {...props}
        class={cn(className)}
        mix={[dialog.trigger({ disabled }), mix]}
      />
    )
  }
}

export type DialogCloseProps = Props<'button'> & dialog.DialogCloseOptions

export function DialogClose(handle: Handle<DialogCloseProps>) {
  return () => {
    let { class: className, mix, disabled, ...props } = handle.props
    return (
      <button
        data-slot="dialog-close"
        {...props}
        class={cn(className)}
        mix={[dialog.close({ disabled }), mix]}
      />
    )
  }
}

/** The overlay classes, applied to the popup's `::backdrop`. */
export const dialogBackdropClass =
  'backdrop:bg-black/10 backdrop:duration-100 supports-backdrop-filter:backdrop:backdrop-blur-xs data-open:backdrop:animate-in data-open:backdrop:fade-in-0 data-closed:backdrop:animate-out data-closed:backdrop:fade-out-0 data-nested:backdrop:bg-transparent data-nested:backdrop:backdrop-blur-none'

export type DialogContentProps = Props<'dialog'> &
  dialog.DialogPopupOptions & {
    /** Render the close (X) button in the top-right corner. */
    showCloseButton?: boolean
  }

export function DialogContent(handle: Handle<DialogContentProps>) {
  return () => {
    let {
      class: className,
      mix,
      children,
      showCloseButton = true,
      initialFocus,
      finalFocus,
      ...props
    } = handle.props

    return (
      <dialog
        data-slot="dialog-content"
        {...props}
        class={cn(
          'm-auto w-full max-w-[calc(100%-2rem)] gap-6 rounded-xl bg-popover p-6 text-sm text-popover-foreground ring-1 ring-foreground/10 duration-100 outline-none open:grid sm:max-w-md',
          'data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
          // A nested dialog on top: step this one back.
          'transition-[scale,translate] ease-out data-nested-dialog-open:-translate-y-[calc(0.5rem*var(--nested-dialogs))] data-nested-dialog-open:scale-[calc(1-0.04*var(--nested-dialogs))]',
          dialogBackdropClass,
          className,
        )}
        mix={[dialog.popup({ initialFocus, finalFocus }), mix]}
      >
        {children}
        {showCloseButton && (
          <button
            data-slot="dialog-close"
            class={buttonVariants({
              variant: 'ghost',
              size: 'icon-sm',
              class: 'absolute top-4 right-4',
            })}
            mix={dialog.close()}
          >
            <XIcon />
            <span class="sr-only">Close</span>
          </button>
        )}
      </dialog>
    )
  }
}

export function DialogHeader(handle: Handle<Props<'div'>>) {
  return () => {
    let { class: className, ...props } = handle.props
    return <div data-slot="dialog-header" {...props} class={cn('flex flex-col gap-2', className)} />
  }
}

export type DialogFooterProps = Props<'div'> & {
  /** Append an outline "Close" button. */
  showCloseButton?: boolean
}

export function DialogFooter(handle: Handle<DialogFooterProps>) {
  return () => {
    let { class: className, children, showCloseButton = false, ...props } = handle.props
    return (
      <div
        data-slot="dialog-footer"
        {...props}
        class={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}
      >
        {children}
        {showCloseButton && (
          <button class={buttonVariants({ variant: 'outline' })} mix={dialog.close()}>
            Close
          </button>
        )}
      </div>
    )
  }
}

export function DialogTitle(handle: Handle<Props<'h2'>>) {
  return () => {
    let { class: className, mix, ...props } = handle.props
    return (
      <h2
        data-slot="dialog-title"
        {...props}
        class={cn('cn-font-heading leading-none font-medium', className)}
        mix={[dialog.title(), mix]}
      />
    )
  }
}

export function DialogDescription(handle: Handle<Props<'p'>>) {
  return () => {
    let { class: className, mix, ...props } = handle.props
    return (
      <p
        data-slot="dialog-description"
        {...props}
        class={cn(
          'text-sm text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground',
          className,
        )}
        mix={[dialog.description(), mix]}
      />
    )
  }
}

export { onDialogChange } from 'stems-ui/dialog'
export type { DialogChangeEvent } from 'stems-ui/dialog'

function XIcon() {
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
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  )
}
