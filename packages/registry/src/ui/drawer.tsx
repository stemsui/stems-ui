import type { Handle, Props } from 'remix/component'
import * as drawer from 'stems-ui/drawer'

import { cn } from '#stems/lib/utils.ts'

/*
 * State hooks used for styling (set by stems-ui/drawer):
 *   trigger: aria-expanded, data-popup-open
 *   popup:   the native <dialog> (`:open` while shown), data-open / data-closed,
 *            data-starting-style / data-ending-style, data-swipe-direction, data-swiping,
 *            data-swipe-dismiss, data-nested, data-nested-drawer-open,
 *            data-nested-drawer-swiping, --drawer-swipe-movement-x / -y,
 *            --drawer-swipe-progress, --drawer-swipe-strength, --nested-drawers,
 *            --drawer-frontmost-height
 *
 * Visuals follow shadcn's Base UI drawer. Differences from shadcn's markup:
 * - The popup is a native <dialog> in the top layer, so there's no Portal or Viewport, and the
 *   overlay is the dialog's `::backdrop` (it inherits --drawer-swipe-progress from the dialog).
 *   The UA's modal-dialog insets and max sizes are reset per swipe direction.
 * - Snap points are not supported yet.
 */

interface DrawerStyleContext {
  readonly modal: drawer.DrawerModal
  readonly showSwipeHandle: boolean
  readonly swipeDirection: drawer.DrawerSwipeDirection
}

export type DrawerProps = drawer.DrawerContextProps & {
  /** Render a drag handle at the swipe edge of the popup. */
  showSwipeHandle?: boolean
}

export function Drawer(handle: Handle<DrawerProps, DrawerStyleContext>) {
  handle.context.set({
    get modal() {
      return handle.props.modal ?? true
    },
    get showSwipeHandle() {
      return handle.props.showSwipeHandle ?? false
    },
    get swipeDirection() {
      return handle.props.swipeDirection ?? 'down'
    },
  })

  return () => {
    let { showSwipeHandle: _showSwipeHandle, swipeDirection = 'down', ...props } = handle.props
    return <drawer.Context swipeDirection={swipeDirection} {...props} />
  }
}

export type DrawerTriggerProps = Props<'button'> & drawer.DrawerTriggerOptions

export function DrawerTrigger(handle: Handle<DrawerTriggerProps>) {
  return () => {
    let { class: className, mix, disabled, ...props } = handle.props
    return (
      <button
        data-slot="drawer-trigger"
        {...props}
        class={cn(className)}
        mix={[drawer.trigger({ disabled }), mix]}
      />
    )
  }
}

export type DrawerCloseProps = Props<'button'> & drawer.DrawerCloseOptions

export function DrawerClose(handle: Handle<DrawerCloseProps>) {
  return () => {
    let { class: className, mix, disabled, ...props } = handle.props
    return (
      <button
        data-slot="drawer-close"
        {...props}
        class={cn(className)}
        mix={[drawer.close({ disabled }), mix]}
      />
    )
  }
}

export function DrawerSwipeHandle(handle: Handle<Props<'div'>>) {
  return () => {
    let { class: className, ...props } = handle.props
    return (
      <div
        data-slot="drawer-swipe-handle"
        aria-hidden="true"
        {...props}
        class={cn(
          'relative z-10 flex shrink-0 cursor-grab transition-opacity duration-200 group-data-nested-drawer-open/drawer-popup:opacity-0 group-data-nested-drawer-swiping/drawer-popup:opacity-100 group-data-[swipe-axis=x]/drawer-popup:h-full group-data-[swipe-axis=x]/drawer-popup:w-3 group-data-[swipe-axis=x]/drawer-popup:items-center group-data-[swipe-axis=y]/drawer-popup:h-3 group-data-[swipe-axis=y]/drawer-popup:w-full group-data-[swipe-axis=y]/drawer-popup:justify-center group-data-[swipe-direction=down]/drawer-popup:items-end group-data-[swipe-direction=left]/drawer-popup:order-last group-data-[swipe-direction=left]/drawer-popup:justify-start group-data-[swipe-direction=right]/drawer-popup:justify-end group-data-[swipe-direction=up]/drawer-popup:order-last group-data-[swipe-direction=up]/drawer-popup:items-start after:block after:shrink-0 after:rounded-full after:bg-muted group-data-[swipe-axis=x]/drawer-popup:after:h-[100px] group-data-[swipe-axis=x]/drawer-popup:after:w-1.5 group-data-[swipe-axis=y]/drawer-popup:after:h-1.5 group-data-[swipe-axis=y]/drawer-popup:after:w-[100px] active:cursor-grabbing',
          className,
        )}
      />
    )
  }
}

/** shadcn's DrawerOverlay, applied to the popup's `::backdrop`. */
const overlayClass =
  'backdrop:min-h-dvh backdrop:bg-black/10 backdrop:opacity-[max(var(--drawer-overlay-min-opacity,0),calc(1-var(--drawer-swipe-progress)))] backdrop:transition-opacity backdrop:duration-450 backdrop:ease-[cubic-bezier(0.32,0.72,0,1)] data-starting-style:backdrop:opacity-0 data-ending-style:backdrop:opacity-0 data-ending-style:backdrop:duration-[calc(var(--drawer-swipe-strength)*400ms)] data-swiping:backdrop:duration-0 supports-backdrop-filter:backdrop:backdrop-blur-xs data-nested:backdrop:bg-transparent data-nested:backdrop:backdrop-blur-none'

const popupClass = [
  // Base. (`max-w-none` and the per-direction `*-auto` insets undo the UA modal-dialog styles.)
  'group/drawer-popup m-(--drawer-inset,0px) max-w-none h-(--drawer-content-height) max-h-(--drawer-content-max-height,none) min-h-0 w-(--drawer-content-width,auto) transform-[translate3d(var(--translate-x,0px),var(--translate-y,0px),0)_scale(var(--stack-scale))] flex-col overflow-visible border-0 bg-popover p-0 text-sm text-popover-foreground transition-[transform,height,opacity,filter] duration-450 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform outline-none select-none open:flex [interpolate-size:allow-keywords] data-[swipe-direction=down]:rounded-t-xl data-[swipe-direction=down]:border-t data-[swipe-direction=left]:rounded-r-xl data-[swipe-direction=left]:border-r data-[swipe-direction=right]:rounded-l-xl data-[swipe-direction=right]:border-l data-[swipe-direction=up]:rounded-b-xl data-[swipe-direction=up]:border-b',
  // Nested.
  'data-nested-drawer-open:overflow-hidden data-nested-drawer-open:brightness-95',
  // Bleed.
  'after:pointer-events-none after:absolute after:bg-(--drawer-bleed-background,var(--color-popover)) data-[swipe-axis=x]:after:inset-y-0 data-[swipe-axis=x]:after:w-(--bleed) data-[swipe-axis=y]:after:inset-x-0 data-[swipe-axis=y]:after:h-(--bleed) data-[swipe-direction=down]:after:top-full data-[swipe-direction=left]:after:right-full data-[swipe-direction=right]:after:left-full data-[swipe-direction=up]:after:bottom-full',
  // Sizing.
  '[--drawer-content-height:var(--drawer-height,auto)] data-[swipe-axis=x]:[--drawer-content-width:75%] data-[swipe-axis=y]:[--drawer-content-max-height:calc(100dvh-6rem)] data-[swipe-axis=x]:sm:[--drawer-content-width:24rem]',
  // Stack.
  '[--bleed:3rem] [--peek:1rem] [--stack-height:var(--drawer-frontmost-height,var(--drawer-height,0px))] [--stack-peek-offset:max(0px,calc((var(--nested-drawers)-var(--stack-progress))*var(--peek)))] [--stack-progress:clamp(0,var(--drawer-swipe-progress),1)] [--stack-scale-base:max(0,calc(1-(var(--nested-drawers)*var(--stack-step))))] [--stack-scale:clamp(0,calc(var(--stack-scale-base)+(var(--stack-step)*var(--stack-progress))),1)] [--stack-shrink:calc(1-var(--stack-scale))] [--stack-step:0.05]',
  // Transitions.
  'data-ending-style:transform-(--closed-transform) data-ending-style:opacity-[0.9999] data-ending-style:duration-[calc(var(--drawer-swipe-strength)*400ms)] data-nested-drawer-swiping:duration-0 data-ending-style:data-nested-drawer-swiping:duration-[calc(var(--drawer-swipe-strength)*400ms)] data-starting-style:transform-(--closed-transform) data-swiping:duration-0 data-ending-style:data-swiping:duration-[calc(var(--drawer-swipe-strength)*400ms)]',
  // Axis: y.
  'data-[swipe-axis=y]:inset-x-0 data-[swipe-axis=y]:data-nested-drawer-open:h-(--stack-height)',
  // Axis: x.
  'data-[swipe-axis=x]:inset-y-0 data-[swipe-axis=x]:max-h-none data-[swipe-axis=x]:flex-row',
  // Direction: down.
  'data-[swipe-direction=down]:top-auto data-[swipe-direction=down]:bottom-0 data-[swipe-direction=down]:origin-bottom data-[swipe-direction=down]:[--closed-transform:translate3d(0,calc(100%+var(--drawer-inset,0px)+2px),0)] data-[swipe-direction=down]:[--translate-y:calc(var(--drawer-snap-point-offset,0px)+var(--drawer-swipe-movement-y)-var(--stack-peek-offset)-(var(--stack-shrink)*var(--stack-height)))]',
  // Direction: up.
  'data-[swipe-direction=up]:top-0 data-[swipe-direction=up]:bottom-auto data-[swipe-direction=up]:origin-top data-[swipe-direction=up]:[--closed-transform:translate3d(0,calc(-100%-var(--drawer-inset,0px)-2px),0)] data-[swipe-direction=up]:[--translate-y:calc(var(--drawer-snap-point-offset,0px)+var(--drawer-swipe-movement-y)+var(--stack-peek-offset)+(var(--stack-shrink)*var(--stack-height)))]',
  // Direction: left.
  'data-[swipe-direction=left]:right-auto data-[swipe-direction=left]:left-0 data-[swipe-direction=left]:origin-left data-[swipe-direction=left]:[--closed-transform:translate3d(calc(-100%-var(--drawer-inset,0px)-2px),0,0)] data-[swipe-direction=left]:[--translate-x:calc(var(--drawer-swipe-movement-x)+var(--stack-peek-offset)+(var(--stack-shrink)*100%))]',
  // Direction: right.
  'data-[swipe-direction=right]:right-0 data-[swipe-direction=right]:left-auto data-[swipe-direction=right]:origin-right data-[swipe-direction=right]:[--closed-transform:translate3d(calc(100%+var(--drawer-inset,0px)+2px),0,0)] data-[swipe-direction=right]:[--translate-x:calc(var(--drawer-swipe-movement-x)-var(--stack-peek-offset)-(var(--stack-shrink)*100%))]',
].join(' ')

export type DrawerContentProps = Props<'dialog'> & drawer.DrawerPopupOptions

export function DrawerContent(handle: Handle<DrawerContentProps>) {
  let context = handle.context.get(Drawer) as DrawerStyleContext | undefined

  return () => {
    let { class: className, mix, children, initialFocus, finalFocus, ...props } = handle.props
    let direction = context?.swipeDirection ?? 'down'
    let axis = direction === 'down' || direction === 'up' ? 'y' : 'x'
    let modal = context?.modal ?? true

    return (
      <dialog
        data-slot="drawer-popup"
        data-swipe-axis={axis}
        {...props}
        class={cn(popupClass, modal === true && overlayClass, className)}
        mix={[drawer.popup({ initialFocus, finalFocus }), mix]}
      >
        {context?.showSwipeHandle && <DrawerSwipeHandle />}
        <div
          data-slot="drawer-content"
          class="flex min-h-0 flex-1 flex-col overflow-hidden overscroll-contain rounded-[inherit] transition-opacity duration-300 ease-[cubic-bezier(0.45,1.005,0,1.005)] select-text group-data-nested-drawer-open/drawer-popup:opacity-0 group-data-nested-drawer-swiping/drawer-popup:opacity-100 group-data-swiping/drawer-popup:select-none"
          mix={drawer.content()}
        >
          {children}
        </div>
      </dialog>
    )
  }
}

export function DrawerHeader(handle: Handle<Props<'div'>>) {
  return () => {
    let { class: className, ...props } = handle.props
    return (
      <div
        data-slot="drawer-header"
        {...props}
        class={cn(
          'flex shrink-0 flex-col gap-0.5 p-4 pb-0 group-data-[swipe-axis=y]/drawer-popup:text-center md:gap-1.5 md:text-left',
          className,
        )}
      />
    )
  }
}

export function DrawerFooter(handle: Handle<Props<'div'>>) {
  return () => {
    let { class: className, ...props } = handle.props
    return (
      <div
        data-slot="drawer-footer"
        {...props}
        class={cn('mt-auto flex shrink-0 flex-col gap-2 p-4 pt-0', className)}
      />
    )
  }
}

export function DrawerTitle(handle: Handle<Props<'h2'>>) {
  return () => {
    let { class: className, mix, ...props } = handle.props
    return (
      <h2
        data-slot="drawer-title"
        {...props}
        class={cn('cn-font-heading font-medium text-foreground', className)}
        mix={[drawer.title(), mix]}
      />
    )
  }
}

export function DrawerDescription(handle: Handle<Props<'p'>>) {
  return () => {
    let { class: className, mix, ...props } = handle.props
    return (
      <p
        data-slot="drawer-description"
        {...props}
        class={cn('text-sm text-balance text-muted-foreground', className)}
        mix={[drawer.description(), mix]}
      />
    )
  }
}

export { onDrawerChange } from 'stems-ui/drawer'
export type { DrawerChangeEvent } from 'stems-ui/drawer'
