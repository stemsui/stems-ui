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
import { PopoverDemo } from './public/popover.tsx'
import { DialogDemo } from './public/dialog.tsx'
import { AlertDialogDemo } from './public/alert-dialog.tsx'
import { DrawerDemo } from './public/drawer.tsx'
import { ToastDemo } from './public/toast.tsx'
import { ContextMenuDemo } from './public/context-menu.tsx'
import { TooltipDemo } from './public/tooltip.tsx'
import { PreviewCardDemo } from './public/preview-card.tsx'

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
    behavior: ['stems-ui/menu'],
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
  popover: {
    title: 'Popover',
    description: 'An accessible popup anchored to a button.',
    behavior: ['stems-ui/popover'],
    Demo: PopoverDemo,
  },
  dialog: {
    title: 'Dialog',
    description: 'A popup that opens on top of the entire page.',
    behavior: ['stems-ui/dialog'],
    Demo: DialogDemo,
  },
  'alert-dialog': {
    title: 'Alert Dialog',
    description: 'A dialog that requires a user response to proceed.',
    behavior: ['stems-ui/alert-dialog'],
    Demo: AlertDialogDemo,
  },
  drawer: {
    title: 'Drawer',
    description: 'A panel that slides in from the edge of the screen, with swipe-to-dismiss.',
    behavior: ['stems-ui/drawer'],
    Demo: DrawerDemo,
  },
  toast: {
    title: 'Toast',
    description: 'Short, temporary notifications.',
    behavior: ['stems-ui/toast'],
    Demo: ToastDemo,
  },
  'context-menu': {
    title: 'Context Menu',
    description: 'A menu that appears at the pointer on right click or long press.',
    behavior: ['stems-ui/context-menu'],
    Demo: ContextMenuDemo,
  },
  tooltip: {
    title: 'Tooltip',
    description: 'A popup that shows a short hint when an element is hovered or focused.',
    behavior: ['stems-ui/tooltip'],
    Demo: TooltipDemo,
  },
  'preview-card': {
    title: 'Preview Card',
    description: 'A popup that previews a link destination on hover.',
    behavior: ['stems-ui/preview-card'],
    Demo: PreviewCardDemo,
  },
}
