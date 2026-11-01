import type { Handle, RemixNode } from 'remix/component'

import { AccordionDemo } from './public/accordion.tsx'
import { AvatarDemo } from './public/avatar.tsx'
import { ButtonDemo } from './public/button.tsx'
import { CollapsibleDemo } from './public/collapsible.tsx'
import { DropdownMenuDemo } from './public/dropdown-menu.tsx'
import { InputDemo } from './public/input.tsx'
import { LabelDemo } from './public/label.tsx'
import { MeterDemo } from './public/meter.tsx'
import { ProgressDemo } from './public/progress.tsx'
import { SwitchDemo } from './public/switch.tsx'
import { TabsDemo } from './public/tabs.tsx'
import { ToggleButtonDemo } from './public/toggle-button.tsx'

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
  switch: {
    title: 'Switch',
    description: 'A control that indicates whether a setting is on or off.',
    behavior: ['stems-ui/switch'],
    Demo: SwitchDemo,
  },
  tabs: {
    title: 'Tabs',
    description: 'A set of layered sections of content, displayed one at a time.',
    behavior: ['stems-ui/tabs'],
    Demo: TabsDemo,
  },
  'toggle-button': {
    title: 'Toggle Button',
    description: 'A two-state button that can be on or off.',
    behavior: ['stems-ui/toggle-button'],
    Demo: ToggleButtonDemo,
  },
  button: {
    title: 'Button',
    description: 'Displays a button or a component that looks like a button.',
    behavior: ['stems-ui/button'],
    Demo: ButtonDemo,
  },
  input: {
    title: 'Input',
    description: 'A text field for user input.',
    behavior: ['stems-ui/input'],
    Demo: InputDemo,
  },
  label: {
    title: 'Label',
    description: 'An accessible label for form controls.',
    behavior: [],
    Demo: LabelDemo,
  },
  avatar: {
    title: 'Avatar',
    description: 'An image with a fallback for representing a user.',
    behavior: ['stems-ui/avatar'],
    Demo: AvatarDemo,
  },
  progress: {
    title: 'Progress',
    description: 'Displays the completion status of a task.',
    behavior: ['stems-ui/progress'],
    Demo: ProgressDemo,
  },
  meter: {
    title: 'Meter',
    description: 'A graphical display of a numeric value within a range.',
    behavior: ['stems-ui/meter'],
    Demo: MeterDemo,
  },
  accordion: {
    title: 'Accordion',
    description:
      'A vertically stacked set of interactive headings that each reveal a section of content.',
    behavior: ['stems-ui/accordion'],
    Demo: AccordionDemo,
  },
  collapsible: {
    title: 'Collapsible',
    description: 'An interactive component which expands/collapses a panel.',
    behavior: ['stems-ui/collapsible'],
    Demo: CollapsibleDemo,
  },
}
