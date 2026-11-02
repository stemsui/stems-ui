import type { Handle, Props } from 'remix/component'

import { cn } from '#stems/lib/utils.ts'

// Styles adapted from shadcn/ui's base-vega Table (MIT).
// https://ui.shadcn.com/r/styles/base-vega/table.json

export function Table(handle: Handle<Props<'table'>>) {
  return () => {
    let { class: className, ...props } = handle.props
    return (
      <div data-slot="table-container" class="relative w-full overflow-x-auto">
        <table
          data-slot="table"
          {...props}
          class={cn('w-full caption-bottom text-sm', className)}
        />
      </div>
    )
  }
}

export function TableHeader(handle: Handle<Props<'thead'>>) {
  return () => {
    let { class: className, ...props } = handle.props
    return <thead data-slot="table-header" {...props} class={cn('[&_tr]:border-b', className)} />
  }
}

export function TableBody(handle: Handle<Props<'tbody'>>) {
  return () => {
    let { class: className, ...props } = handle.props
    return (
      <tbody
        data-slot="table-body"
        {...props}
        class={cn('[&_tr:last-child]:border-0', className)}
      />
    )
  }
}

export function TableFooter(handle: Handle<Props<'tfoot'>>) {
  return () => {
    let { class: className, ...props } = handle.props
    return (
      <tfoot
        data-slot="table-footer"
        {...props}
        class={cn('border-t bg-muted/50 font-medium [&>tr]:last:border-b-0', className)}
      />
    )
  }
}

export function TableRow(handle: Handle<Props<'tr'>>) {
  return () => {
    let { class: className, ...props } = handle.props
    return (
      <tr
        data-slot="table-row"
        {...props}
        class={cn(
          'border-b transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-selected:bg-muted',
          className,
        )}
      />
    )
  }
}

export function TableHead(handle: Handle<Props<'th'>>) {
  return () => {
    let { class: className, ...props } = handle.props
    return (
      <th
        data-slot="table-head"
        scope="col"
        {...props}
        class={cn(
          'h-10 px-2 text-start align-middle font-medium whitespace-nowrap text-foreground has-[[role=checkbox]]:pe-0 [&>[role=checkbox]]:translate-y-[2px]',
          className,
        )}
      />
    )
  }
}

export function TableCell(handle: Handle<Props<'td'>>) {
  return () => {
    let { class: className, ...props } = handle.props
    return (
      <td
        data-slot="table-cell"
        {...props}
        class={cn(
          'p-2 align-middle whitespace-nowrap has-[[role=checkbox]]:pe-0 [&>[role=checkbox]]:translate-y-[2px]',
          className,
        )}
      />
    )
  }
}

export function TableCaption(handle: Handle<Props<'caption'>>) {
  return () => {
    let { class: className, ...props } = handle.props
    return (
      <caption
        data-slot="table-caption"
        {...props}
        class={cn('mt-4 text-sm text-muted-foreground', className)}
      />
    )
  }
}
