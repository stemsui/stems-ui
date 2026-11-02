import type { Handle, Props } from 'remix/component'
import * as scrollArea from 'stems-ui/scroll-area'

import { cn } from '#stems/lib/utils.ts'

/*
 * Styled after shadcn/ui's Base UI scroll area (base-vega). Behavior: stems-ui/scroll-area.
 *
 * Like shadcn, `children` render inside the viewport, so a `<ScrollBar orientation="horizontal" />`
 * passed as a child works (it is absolutely positioned against the root). Unlike shadcn, the
 * children are wrapped in a `scroll-area-content` element so content size changes are observed.
 *
 * shadcn's `data-horizontal:` / `data-vertical:` variants are spelled `data-[orientation=...]:`
 * so the component works without `shadcn/tailwind.css`.
 *
 * State hooks used for styling (set by stems-ui/scroll-area):
 *   root, viewport: data-has-overflow-x/y, data-overflow-{x,y}-{start,end}, data-scrolling
 *   viewport: --scroll-area-overflow-{x,y}-{start,end}
 *   scrollbar: data-orientation, data-hovering, data-scrolling, [hidden] without overflow
 */

export type ScrollAreaProps = Props<'div'> & Omit<scrollArea.ScrollAreaContextProps, 'children'>

export function ScrollArea(handle: Handle<ScrollAreaProps>) {
  return () => {
    let { class: className, mix, children, overflowEdgeThreshold, ...props } = handle.props

    return (
      <scrollArea.Context overflowEdgeThreshold={overflowEdgeThreshold}>
        <div
          data-slot="scroll-area"
          {...props}
          class={cn('relative', className)}
          mix={[scrollArea.root(), mix]}
        >
          <div
            data-slot="scroll-area-viewport"
            class="size-full rounded-[inherit] transition-[color,box-shadow] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 [&::-webkit-scrollbar]:hidden"
            mix={scrollArea.viewport()}
          >
            <div data-slot="scroll-area-content" mix={scrollArea.content()}>
              {children}
            </div>
          </div>
          <ScrollBar />
          <div data-slot="scroll-area-corner" mix={scrollArea.corner()} />
        </div>
      </scrollArea.Context>
    )
  }
}

export type ScrollBarProps = Props<'div'> & scrollArea.ScrollAreaScrollbarOptions

export function ScrollBar(handle: Handle<ScrollBarProps>) {
  return () => {
    let { class: className, mix, orientation = 'vertical', keepMounted, ...props } = handle.props

    return (
      <div
        data-slot="scroll-area-scrollbar"
        {...props}
        class={cn(
          'flex touch-none p-px transition-colors select-none data-[orientation=horizontal]:h-2.5 data-[orientation=horizontal]:flex-col data-[orientation=horizontal]:border-t data-[orientation=horizontal]:border-t-transparent data-[orientation=vertical]:h-full data-[orientation=vertical]:w-2.5 data-[orientation=vertical]:border-l data-[orientation=vertical]:border-l-transparent',
          className,
        )}
        mix={[scrollArea.scrollbar({ orientation, keepMounted }), mix]}
      >
        <div
          data-slot="scroll-area-thumb"
          class="relative flex-1 rounded-full bg-border"
          mix={scrollArea.thumb({ orientation })}
        />
      </div>
    )
  }
}
