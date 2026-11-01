import type { Handle, Props } from 'remix/component'
import { separator, type SeparatorOptions } from 'stems-ui/separator'

import { cn } from '#stems/lib/utils.ts'

export type SeparatorProps = Props<'div'> & SeparatorOptions

export function Separator(handle: Handle<SeparatorProps>) {
  return () => {
    let {
      class: className,
      mix,
      orientation = 'horizontal',
      decorative = true,
      ...props
    } = handle.props

    return (
      <div
        data-slot="separator"
        {...props}
        class={cn(
          'shrink-0 bg-border data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px',
          className,
        )}
        mix={[separator({ orientation, decorative }), mix]}
      />
    )
  }
}
