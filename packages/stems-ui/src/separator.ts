import { attrs, createMixin } from '@remix-run/component'
import type { ElementProps, MixinFactory } from '@remix-run/component'

export type SeparatorOrientation = 'horizontal' | 'vertical'

export interface SeparatorOptions {
  /**
   * The visual orientation of the separator.
   * @default 'horizontal'
   */
  orientation?: SeparatorOrientation
  /**
   * Purely visual separators are hidden from assistive technology.
   * @default false
   */
  decorative?: boolean
}

const separatorMixin: MixinFactory<HTMLElement, [options?: SeparatorOptions], ElementProps> =
  createMixin<HTMLElement, [options?: SeparatorOptions], ElementProps>((_handle, hostType) => {
    // Remix calls the runner with `(...args, props)`, so when `separator()` is called without
    // options the host props arrive first. Only treat the first argument as options when a second
    // (the props) follows it.
    return (...args: [SeparatorOptions | undefined, ElementProps] | [ElementProps]) => {
      let options: SeparatorOptions = args.length > 1 ? (args[0] ?? {}) : {}
      let orientation = options.orientation ?? 'horizontal'

      if (options.decorative) {
        return attrs({
          'aria-hidden': true,
          'data-orientation': orientation,
          role: hostType === 'hr' ? 'none' : undefined,
        })
      }

      return attrs({
        // `<hr>` already has an implicit separator role.
        role: hostType === 'hr' ? undefined : 'separator',
        // `aria-orientation` defaults to horizontal, so only set it when it differs.
        'aria-orientation': orientation === 'vertical' ? 'vertical' : undefined,
        'data-orientation': orientation,
      })
    }
  })

/**
 * Wires a host element as a separator between groups of content.
 *
 * Sets `role="separator"` (unless the host is an `<hr>`), `aria-orientation` for vertical
 * separators, and `data-orientation` for styling. Decorative separators are hidden from
 * assistive technology instead.
 */
export const separator = separatorMixin
