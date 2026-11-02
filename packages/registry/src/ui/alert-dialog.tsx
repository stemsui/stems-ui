import type { Handle, Props } from 'remix/component'
import * as alertDialog from 'stems-ui/alert-dialog'

import { cn } from '#stems/lib/utils.ts'
import { buttonVariants, type ButtonSize, type ButtonVariant } from '#stems/ui/button.tsx'

/*
 * State hooks used for styling (set by stems-ui/alert-dialog):
 *   trigger: aria-expanded, data-popup-open
 *   content: native <dialog> with role="alertdialog" (`:open` while shown), data-open /
 *            data-closed, data-starting-style / data-ending-style, data-nested,
 *            data-nested-dialog-open, --nested-dialogs
 *
 * Always modal (showModal()); the overlay is the dialog's `::backdrop`. Outside presses never
 * close it; Escape and AlertDialogCancel/AlertDialogAction (when closing) do.
 */

export type AlertDialogProps<Payload = unknown> = alertDialog.AlertDialogContextProps<Payload>

/**
 * `handle` connects detached `AlertDialogTrigger`s; `children` may be a function of
 * `{ payload }`.
 */
export function AlertDialog<Payload = unknown>(handle: Handle<AlertDialogProps<Payload>>) {
  return () => <alertDialog.Context {...handle.props} />
}

export type AlertDialogTriggerProps = Props<'button'> & alertDialog.AlertDialogTriggerOptions

export function AlertDialogTrigger(handle: Handle<AlertDialogTriggerProps>) {
  return () => {
    let { class: className, mix, disabled, handle: dialogHandle, payload, ...props } = handle.props
    return (
      <button
        data-slot="alert-dialog-trigger"
        {...props}
        class={cn(className)}
        mix={[alertDialog.trigger({ disabled, handle: dialogHandle, payload }), mix]}
      />
    )
  }
}

export type AlertDialogContentProps = Props<'dialog'> &
  alertDialog.AlertDialogPopupOptions & {
    size?: 'default' | 'sm'
  }

export function AlertDialogContent(handle: Handle<AlertDialogContentProps>) {
  return () => {
    let {
      class: className,
      mix,
      size = 'default',
      initialFocus,
      finalFocus,
      ...props
    } = handle.props

    return (
      <dialog
        data-slot="alert-dialog-content"
        data-size={size}
        {...props}
        class={cn(
          'group/alert-dialog-content m-auto w-full gap-6 rounded-xl bg-popover p-6 text-popover-foreground ring-1 ring-foreground/10 duration-100 outline-none open:grid data-[size=default]:max-w-xs data-[size=sm]:max-w-xs data-[size=default]:sm:max-w-lg',
          'data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
          'backdrop:bg-black/10 backdrop:duration-100 supports-backdrop-filter:backdrop:backdrop-blur-xs data-open:backdrop:animate-in data-open:backdrop:fade-in-0 data-closed:backdrop:animate-out data-closed:backdrop:fade-out-0 data-nested:backdrop:bg-transparent data-nested:backdrop:backdrop-blur-none',
          className,
        )}
        mix={[alertDialog.popup({ initialFocus, finalFocus }), mix]}
      />
    )
  }
}

export function AlertDialogHeader(handle: Handle<Props<'div'>>) {
  return () => {
    let { class: className, ...props } = handle.props
    return (
      <div
        data-slot="alert-dialog-header"
        {...props}
        class={cn(
          'grid grid-rows-[auto_1fr] place-items-center gap-1.5 text-center has-data-[slot=alert-dialog-media]:grid-rows-[auto_auto_1fr] has-data-[slot=alert-dialog-media]:gap-x-6 sm:group-data-[size=default]/alert-dialog-content:place-items-start sm:group-data-[size=default]/alert-dialog-content:text-left sm:group-data-[size=default]/alert-dialog-content:has-data-[slot=alert-dialog-media]:grid-rows-[auto_1fr]',
          className,
        )}
      />
    )
  }
}

export function AlertDialogFooter(handle: Handle<Props<'div'>>) {
  return () => {
    let { class: className, ...props } = handle.props
    return (
      <div
        data-slot="alert-dialog-footer"
        {...props}
        class={cn(
          'flex flex-col-reverse gap-2 group-data-[size=sm]/alert-dialog-content:grid group-data-[size=sm]/alert-dialog-content:grid-cols-2 sm:flex-row sm:justify-end',
          className,
        )}
      />
    )
  }
}

export function AlertDialogMedia(handle: Handle<Props<'div'>>) {
  return () => {
    let { class: className, ...props } = handle.props
    return (
      <div
        data-slot="alert-dialog-media"
        {...props}
        class={cn(
          "mb-2 inline-flex size-16 items-center justify-center rounded-md bg-muted sm:group-data-[size=default]/alert-dialog-content:row-span-2 *:[svg:not([class*='size-'])]:size-8",
          className,
        )}
      />
    )
  }
}

export function AlertDialogTitle(handle: Handle<Props<'h2'>>) {
  return () => {
    let { class: className, mix, ...props } = handle.props
    return (
      <h2
        data-slot="alert-dialog-title"
        {...props}
        class={cn(
          'cn-font-heading text-lg font-medium sm:group-data-[size=default]/alert-dialog-content:group-has-data-[slot=alert-dialog-media]/alert-dialog-content:col-start-2',
          className,
        )}
        mix={[alertDialog.title(), mix]}
      />
    )
  }
}

export function AlertDialogDescription(handle: Handle<Props<'p'>>) {
  return () => {
    let { class: className, mix, ...props } = handle.props
    return (
      <p
        data-slot="alert-dialog-description"
        {...props}
        class={cn(
          'text-sm text-balance text-muted-foreground md:text-pretty *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground',
          className,
        )}
        mix={[alertDialog.description(), mix]}
      />
    )
  }
}

export type AlertDialogActionProps = Props<'button'> & {
  variant?: ButtonVariant
  size?: ButtonSize
  /**
   * Close the dialog when pressed. Off by default (as in shadcn) so the action can run async
   * work first and close through `open` / `onOpenChange`.
   */
  closes?: boolean
}

export function AlertDialogAction(handle: Handle<AlertDialogActionProps>) {
  return () => {
    let {
      class: className,
      mix,
      variant = 'default',
      size = 'default',
      closes = false,
      ...props
    } = handle.props
    return (
      <button
        type="button"
        data-slot="alert-dialog-action"
        {...props}
        class={buttonVariants({ variant, size, class: className })}
        mix={closes ? [alertDialog.close(), mix] : mix}
      />
    )
  }
}

export type AlertDialogCancelProps = Props<'button'> &
  alertDialog.AlertDialogCloseOptions & {
    variant?: ButtonVariant
    size?: ButtonSize
  }

export function AlertDialogCancel(handle: Handle<AlertDialogCancelProps>) {
  return () => {
    let {
      class: className,
      mix,
      variant = 'outline',
      size = 'default',
      disabled,
      ...props
    } = handle.props
    return (
      <button
        data-slot="alert-dialog-cancel"
        {...props}
        class={buttonVariants({ variant, size, class: className })}
        mix={[alertDialog.close({ disabled }), mix]}
      />
    )
  }
}

export { onAlertDialogChange } from 'stems-ui/alert-dialog'
export type { AlertDialogChangeEvent } from 'stems-ui/alert-dialog'
