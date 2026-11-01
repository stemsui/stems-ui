import type { Handle, RemixNode } from 'remix/component'

import { DropdownMenuDemo } from './public/dropdown-menu.tsx'

export interface DemoEntry {
  title: string
  description: string
  /** Headless module(s) providing the behavior. */
  behavior: string[]
  /** A client-entry component rendering the demo. */
  Demo: (handle: Handle) => () => RemixNode
}

/**
 * Every component page. Keys are registry item names (`/components/<key>`).
 * Demo modules live in ./public/<key>.tsx and export a `clientEntry` component.
 */
export const demos: Record<string, DemoEntry> = {
  'dropdown-menu': {
    title: 'Dropdown Menu',
    description: 'A menu of actions or options, opened from a button.',
    behavior: ['@remix-run/ui/menu (temporary)', 'stems-ui/separator'],
    Demo: DropdownMenuDemo,
  },
}
