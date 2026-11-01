import type { Handle, Props } from 'remix/component'

import { cn } from '#stems/lib/utils.ts'

export function Label(handle: Handle<Props<'label'>>) {
  return () => {
    let { class: className, ...props } = handle.props

    return (
      <label
        data-slot="label"
        {...props}
        class={cn(
          'flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
          className,
        )}
      />
    )
  }
}
