import type { Handle, Props, RemixNode } from 'remix/component'
import * as navigationMenu from 'stems-ui/navigation-menu'

import { cn } from '#stems/lib/utils.ts'

/*
 * Styled after shadcn/ui's Base UI navigation menu (base-vega). Behavior:
 * stems-ui/navigation-menu.
 *
 * There is no Portal: `NavigationMenu` renders the shared popup (`NavigationMenuPositioner`: a
 * top-layer positioner with the visible popup box inside) after its children, with a
 * `NavigationMenuViewport` inside. Each `NavigationMenuContent` is declared inside its item but
 * renders inside that viewport.
 *
 * State hooks used for styling (set by stems-ui/navigation-menu):
 *   trigger:  aria-expanded, data-popup-open, data-pressed, data-disabled
 *   content:  data-open / data-closed, data-starting-style / data-ending-style,
 *             data-activation-direction (left | right | up | down)
 *   popup:    data-open / data-closed, data-side, data-align, presence attributes,
 *             --positioner-width / --positioner-height (final size), --popup-width /
 *             --popup-height (animated between items), --transform-origin,
 *             --available-width / --available-height
 *   link:     data-active, aria-current="page"
 */

export {
  onNavigationMenuChange,
  type NavigationMenuChangeDetails,
  type NavigationMenuChangeEvent,
  type NavigationMenuChangeReason,
} from 'stems-ui/navigation-menu'

export type NavigationMenuProps = Props<'nav'> &
  Omit<navigationMenu.NavigationMenuContextProps, 'children'> &
  Pick<navigationMenu.NavigationMenuPopupOptions, 'align'> & {
    children?: RemixNode
  }

export function NavigationMenu(handle: Handle<NavigationMenuProps>) {
  return () => {
    let {
      class: className,
      mix,
      children,
      align = 'start',
      value,
      defaultValue,
      onValueChange,
      onOpenChangeComplete,
      delay,
      closeDelay,
      orientation,
      ...props
    } = handle.props

    return (
      <navigationMenu.Context
        value={value}
        defaultValue={defaultValue}
        onValueChange={onValueChange}
        onOpenChangeComplete={onOpenChangeComplete}
        delay={delay}
        closeDelay={closeDelay}
        orientation={orientation}
      >
        <nav
          data-slot="navigation-menu"
          {...props}
          class={cn(
            'group/navigation-menu relative flex max-w-max flex-1 items-center justify-center',
            className,
          )}
          mix={[navigationMenu.root(), mix]}
        >
          {children}
          <NavigationMenuPositioner align={align} />
        </nav>
      </navigationMenu.Context>
    )
  }
}

export function NavigationMenuList(handle: Handle<Props<'ul'>>) {
  return () => {
    let { class: className, mix, ...props } = handle.props

    return (
      <ul
        data-slot="navigation-menu-list"
        {...props}
        class={cn('group flex flex-1 list-none items-center justify-center gap-0', className)}
        mix={[navigationMenu.list(), mix]}
      />
    )
  }
}

export type NavigationMenuItemProps = Props<'li'> & { value?: string }

export function NavigationMenuItem(handle: Handle<NavigationMenuItemProps>) {
  return () => {
    let { class: className, value, ...props } = handle.props

    return (
      <navigationMenu.ItemContext value={value}>
        <li data-slot="navigation-menu-item" {...props} class={cn('relative', className)} />
      </navigationMenu.ItemContext>
    )
  }
}

/** Classes of a navigation menu trigger; also use them for top-level links. */
export function navigationMenuTriggerStyle(): string {
  return 'group/navigation-menu-trigger inline-flex h-9 w-max items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-all outline-none hover:bg-muted focus:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-1 disabled:pointer-events-none disabled:opacity-50 data-disabled:pointer-events-none data-disabled:opacity-50 data-popup-open:bg-muted/50 data-popup-open:hover:bg-muted data-popup-open:focus:bg-muted'
}

export type NavigationMenuTriggerProps = Props<'button'> &
  navigationMenu.NavigationMenuTriggerOptions

export function NavigationMenuTrigger(handle: Handle<NavigationMenuTriggerProps>) {
  return () => {
    let { class: className, mix, children, disabled, ...props } = handle.props

    return (
      <button
        data-slot="navigation-menu-trigger"
        {...props}
        class={cn(navigationMenuTriggerStyle(), 'group', className)}
        mix={[navigationMenu.trigger({ disabled }), mix]}
      >
        {children}{' '}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
          class="relative top-px ml-1 size-3 transition duration-300 group-data-popup-open/navigation-menu-trigger:rotate-180"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
    )
  }
}

export function NavigationMenuContent(handle: Handle<navigationMenu.NavigationMenuContentProps>) {
  return () => {
    let { class: className, ...props } = handle.props

    return (
      <navigationMenu.Content
        data-slot="navigation-menu-content"
        {...props}
        class={cn(
          'h-full w-auto p-2 pr-2.5 transition-[opacity,transform,translate] duration-[0.35s] ease-[cubic-bezier(0.22,1,0.36,1)] data-starting-style:opacity-0 data-ending-style:opacity-0 data-starting-style:data-[activation-direction=left]:-translate-x-1/2 data-starting-style:data-[activation-direction=right]:translate-x-1/2 data-ending-style:data-[activation-direction=left]:translate-x-1/2 data-ending-style:data-[activation-direction=right]:-translate-x-1/2 **:data-[slot=navigation-menu-link]:focus:ring-0 **:data-[slot=navigation-menu-link]:focus:outline-none',
          className,
        )}
      />
    )
  }
}

export type NavigationMenuPositionerProps = Props<'div'> &
  navigationMenu.NavigationMenuPopupOptions & {
    children?: RemixNode
  }

/**
 * The shared popup. Like Base UI, two elements: the positioner (the stems-ui popup element, in
 * the top layer, sized to the final `--positioner-width` / `--positioner-height` right away so
 * it's positioned correctly) and the visible box inside it, which animates `--popup-width` /
 * `--popup-height` between items. `NavigationMenu` renders it; render your own (with
 * `children`, e.g. a custom `NavigationMenuViewport`) only when composing
 * `navigationMenu.Context` yourself.
 */
export function NavigationMenuPositioner(handle: Handle<NavigationMenuPositionerProps>) {
  return () => {
    let {
      class: className,
      mix,
      children,
      side = 'bottom',
      sideOffset = 8,
      align = 'start',
      alignOffset = 0,
      collisionPadding,
      arrowPadding,
      anchor,
      ...props
    } = handle.props

    return (
      <div
        data-slot="navigation-menu-positioner"
        {...props}
        class={cn(
          "isolate z-50 m-0 h-(--positioner-height) w-(--positioner-width) max-w-(--available-width) origin-(--transform-origin) overflow-visible bg-transparent p-0 text-popover-foreground transition-[opacity,scale,top,left] duration-[0.35s] ease-[cubic-bezier(0.22,1,0.36,1)] outline-none before:absolute before:content-[''] data-[side=bottom]:before:top-[-10px] data-[side=bottom]:before:right-0 data-[side=bottom]:before:left-0 data-[side=bottom]:before:h-2.5 data-[side=top]:before:right-0 data-[side=top]:before:bottom-[-10px] data-[side=top]:before:left-0 data-[side=top]:before:h-2.5 data-ending-style:scale-90 data-ending-style:opacity-0 data-ending-style:duration-150 data-ending-style:ease-[ease] data-starting-style:scale-90 data-starting-style:opacity-0",
          className,
        )}
        mix={[
          navigationMenu.popup({
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
        <div
          data-slot="navigation-menu-popup"
          class="relative h-(--popup-height) w-(--popup-width) max-w-(--available-width) rounded-lg bg-popover text-popover-foreground shadow ring-1 ring-foreground/10 transition-[width,height] duration-[0.35s] ease-[cubic-bezier(0.22,1,0.36,1)]"
        >
          {children ?? <NavigationMenuViewport />}
        </div>
      </div>
    )
  }
}

export function NavigationMenuViewport(handle: Handle<navigationMenu.NavigationMenuViewportProps>) {
  return () => {
    let { class: className, ...props } = handle.props

    return (
      <navigationMenu.Viewport
        data-slot="navigation-menu-viewport"
        {...props}
        class={cn('relative size-full overflow-hidden', className)}
      />
    )
  }
}

export type NavigationMenuLinkProps = Props<'a'> & navigationMenu.NavigationMenuLinkOptions

export function NavigationMenuLink(handle: Handle<NavigationMenuLinkProps>) {
  return () => {
    let { class: className, mix, active, closeOnClick, ...props } = handle.props

    return (
      <a
        data-slot="navigation-menu-link"
        {...props}
        class={cn(
          "flex items-center gap-1.5 rounded-md p-2 text-sm transition-all outline-none hover:bg-muted focus:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-1 in-data-[slot=navigation-menu-content]:rounded-sm data-active:bg-muted/50 data-active:hover:bg-muted data-active:focus:bg-muted [&_svg:not([class*='size-'])]:size-4",
          className,
        )}
        mix={[navigationMenu.link({ active, closeOnClick }), mix]}
      />
    )
  }
}

/** A small caret under the open trigger (Base UI `NavigationMenu.Icon`). Use inside an item. */
export function NavigationMenuIndicator(handle: Handle<Props<'span'>>) {
  return () => {
    let { class: className, mix, ...props } = handle.props

    return (
      <span
        data-slot="navigation-menu-indicator"
        {...props}
        class={cn(
          'pointer-events-none absolute top-full left-1/2 z-1 flex h-1.5 w-4 -translate-x-1/2 items-end justify-center overflow-hidden opacity-0 transition-opacity data-popup-open:opacity-100',
          className,
        )}
        mix={[navigationMenu.icon(), mix]}
      >
        <span class="relative top-[60%] h-2 w-2 rotate-45 rounded-tl-sm bg-border shadow-md" />
      </span>
    )
  }
}
