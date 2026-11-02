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
import { FieldDemo } from './public/field.tsx'
import { FieldsetDemo } from './public/fieldset.tsx'
import { FormDemo } from './public/form.tsx'
import { CheckboxDemo } from './public/checkbox.tsx'
import { CheckboxGroupDemo } from './public/checkbox-group.tsx'
import { RadioGroupDemo } from './public/radio-group.tsx'
import { ToggleButtonGroupDemo } from './public/toggle-button-group.tsx'
import { NumberFieldDemo } from './public/number-field.tsx'
import { SliderDemo } from './public/slider.tsx'
import { OtpFieldDemo } from './public/otp-field.tsx'
import { SelectDemo } from './public/select.tsx'
import { ComboboxDemo } from './public/combobox.tsx'
import { AutocompleteDemo } from './public/autocomplete.tsx'
import { MenubarDemo } from './public/menubar.tsx'
import { NavigationMenuDemo } from './public/navigation-menu.tsx'
import { ScrollAreaDemo } from './public/scroll-area.tsx'
import { ToolbarDemo } from './public/toolbar.tsx'
import { TableDemo } from './public/table.tsx'
import { DataTableDemo } from './public/data-table.tsx'

export interface DemoEntry {
  title: string
  description: string
  /** Registry item to install, when it differs from the page key. */
  registryItem?: string
  /** Headless module(s) providing the behavior. */
  behavior: string[]
  /** Reference for styled-only components and optional third-party integrations. */
  documentation?: string
  behaviorDescription?: string
  /** A client-entry component rendering the demo. */
  Demo: (handle: Handle) => () => RemixNode
}

/**
 * Every component page. Keys are registry item names (`/components/<key>`).
 * Demo modules live in ./public/<key>.tsx and export a `clientEntry` component.
 */
export const demos: Record<string, DemoEntry> = {
  table: {
    title: 'Table',
    description: 'Styled native table parts for tabular data.',
    behavior: [],
    documentation: 'docs/components/table.md',
    Demo: TableDemo,
  },
  'data-table': {
    title: 'Data Table',
    description: 'Typed, composable data tables powered by TanStack Table v9.',
    behavior: [],
    behaviorDescription: 'TanStack Table v9, with a Remix adapter in the registry',
    documentation: 'docs/components/data-table.md',
    Demo: DataTableDemo,
  },
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
  field: {
    title: 'Field',
    description: 'Labels, descriptions, and validation for a form control.',
    behavior: ['stems-ui/field'],
    Demo: FieldDemo,
  },
  fieldset: {
    title: 'Fieldset',
    description: 'Groups related form controls under a legend.',
    registryItem: 'field',
    behavior: ['stems-ui/fieldset', 'stems-ui/field'],
    Demo: FieldsetDemo,
  },
  form: {
    title: 'Form',
    description: 'A native form with consolidated validation errors.',
    behavior: ['stems-ui/form', 'stems-ui/field'],
    Demo: FormDemo,
  },
  checkbox: {
    title: 'Checkbox',
    description: 'A control for toggling an option on or off.',
    behavior: ['stems-ui/checkbox'],
    Demo: CheckboxDemo,
  },
  'checkbox-group': {
    title: 'Checkbox Group',
    description: 'Shared state for a set of checkboxes.',
    registryItem: 'checkbox',
    behavior: ['stems-ui/checkbox-group', 'stems-ui/checkbox'],
    Demo: CheckboxGroupDemo,
  },
  'radio-group': {
    title: 'Radio Group',
    description: 'A set of options where only one can be selected.',
    behavior: ['stems-ui/radio-group', 'stems-ui/radio'],
    Demo: RadioGroupDemo,
  },
  'toggle-button-group': {
    title: 'Toggle Button Group',
    description: 'A set of toggle buttons with shared state.',
    behavior: ['stems-ui/toggle-button-group', 'stems-ui/toggle-button'],
    Demo: ToggleButtonGroupDemo,
  },
  'number-field': {
    title: 'Number Field',
    description: 'A numeric input with increment and decrement buttons and a scrub area.',
    behavior: ['stems-ui/number-field'],
    Demo: NumberFieldDemo,
  },
  slider: {
    title: 'Slider',
    description: 'Select a value or range by dragging a thumb.',
    behavior: ['stems-ui/slider'],
    Demo: SliderDemo,
  },
  'otp-field': {
    title: 'OTP Field',
    description: 'Entry for one-time passwords and verification codes.',
    behavior: ['stems-ui/otp-field'],
    Demo: OtpFieldDemo,
  },
  select: {
    title: 'Select',
    description: 'Choose one or more values from a dropdown list.',
    behavior: ['stems-ui/select'],
    Demo: SelectDemo,
  },
  combobox: {
    title: 'Combobox',
    description:
      'An input with a filterable list of options; single with groups, or multiple as chips.',
    behavior: ['stems-ui/combobox'],
    Demo: ComboboxDemo,
  },
  autocomplete: {
    title: 'Autocomplete',
    description: 'A free-text input with suggestions and inline completion.',
    behavior: ['stems-ui/autocomplete'],
    Demo: AutocompleteDemo,
  },
  menubar: {
    title: 'Menubar',
    description: 'A horizontal bar of menus, like a desktop application menu.',
    behavior: ['stems-ui/menubar', 'stems-ui/menu'],
    Demo: MenubarDemo,
  },
  'navigation-menu': {
    title: 'Navigation Menu',
    description: 'A collection of links and menus for website navigation.',
    behavior: ['stems-ui/navigation-menu'],
    Demo: NavigationMenuDemo,
  },
  'scroll-area': {
    title: 'Scroll Area',
    description: 'A native scroll container with custom scrollbars.',
    behavior: ['stems-ui/scroll-area'],
    Demo: ScrollAreaDemo,
  },
  toolbar: {
    title: 'Toolbar',
    description: 'A container for grouping a set of buttons and controls.',
    behavior: [
      'stems-ui/toolbar',
      'stems-ui/toggle-button-group',
      'stems-ui/select',
      'stems-ui/menu',
    ],
    Demo: ToolbarDemo,
  },
}
