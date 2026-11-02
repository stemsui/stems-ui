import { clientEntry, type Handle } from 'remix/component'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  onMenuSelect,
} from '@stemsui/registry/ui/dropdown-menu.tsx'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@stemsui/registry/ui/select.tsx'
import {
  ToggleButtonGroup,
  ToggleButtonGroupItem,
} from '@stemsui/registry/ui/toggle-button-group.tsx'
import { toggleButtonVariants } from '@stemsui/registry/ui/toggle-button.tsx'
import {
  Toolbar,
  ToolbarButton,
  ToolbarLink,
  ToolbarSeparator,
  toolbarButton,
  toolbarItem,
} from '@stemsui/registry/ui/toolbar.tsx'

function Icon(handle: Handle<{ paths: string[] }>) {
  return () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      {handle.props.paths.map((d) => (
        <path d={d} />
      ))}
    </svg>
  )
}

const bold = ['M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8']
const italic = ['M19 4h-9', 'M14 20H5', 'M15 4 9 20']
const underline = ['M6 4v6a6 6 0 0 0 12 0V4', 'M4 20h16']
const alignLeft = ['M21 5H3', 'M15 12H3', 'M17 19H3']
const alignCenter = ['M21 5H3', 'M17 12H7', 'M19 19H5']
const alignRight = ['M21 5H3', 'M21 12H9', 'M21 19H7']
const undo = ['M9 14 4 9l5-5', 'M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11']
const chevronDown = ['m6 9 6 6 6-6']

const fonts = [
  { value: 'sans', label: 'Sans serif' },
  { value: 'serif', label: 'Serif' },
  { value: 'mono', label: 'Monospace' },
]

export const ToolbarDemo = clientEntry(import.meta.url, function ToolbarDemo(handle: Handle) {
  let formatting: string[] = ['bold']
  let alignment: string[] = ['left']
  let lastAction = 'none'

  return () => (
    <div
      class="flex w-full flex-col items-center gap-4"
      mix={onMenuSelect((event) => {
        lastAction = String(event.value ?? event.label)
        void handle.update()
      })}
    >
      <Toolbar aria-label="Text formatting" class="w-full max-w-2xl">
        <ToolbarButton aria-label="Undo" disabled>
          <Icon paths={undo} />
        </ToolbarButton>
        <ToolbarSeparator />
        <ToggleButtonGroup
          aria-label="Style"
          multiple
          size="sm"
          spacing={1}
          value={formatting}
          onValueChange={(value) => {
            formatting = value
            void handle.update()
          }}
        >
          <ToggleButtonGroupItem value="bold" aria-label="Bold" mix={toolbarItem()}>
            <Icon paths={bold} />
          </ToggleButtonGroupItem>
          <ToggleButtonGroupItem value="italic" aria-label="Italic" mix={toolbarItem()}>
            <Icon paths={italic} />
          </ToggleButtonGroupItem>
          <ToggleButtonGroupItem value="underline" aria-label="Underline" mix={toolbarItem()}>
            <Icon paths={underline} />
          </ToggleButtonGroupItem>
        </ToggleButtonGroup>
        <ToolbarSeparator />
        <ToggleButtonGroup
          aria-label="Alignment"
          size="sm"
          spacing={1}
          value={alignment}
          onValueChange={(value) => {
            // Keep one alignment pressed.
            if (value.length > 0) alignment = value
            void handle.update()
          }}
        >
          <ToggleButtonGroupItem value="left" aria-label="Align left" mix={toolbarItem()}>
            <Icon paths={alignLeft} />
          </ToggleButtonGroupItem>
          <ToggleButtonGroupItem value="center" aria-label="Align center" mix={toolbarItem()}>
            <Icon paths={alignCenter} />
          </ToggleButtonGroupItem>
          <ToggleButtonGroupItem value="right" aria-label="Align right" mix={toolbarItem()}>
            <Icon paths={alignRight} />
          </ToggleButtonGroupItem>
        </ToggleButtonGroup>
        <ToolbarSeparator />
        <Select items={fonts} defaultValue="sans">
          <SelectTrigger
            size="sm"
            aria-label="Font"
            class="w-32 border-transparent shadow-none hover:bg-muted dark:bg-transparent"
            mix={toolbarItem()}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false} align="start">
            {fonts.map((font) => (
              <SelectItem value={font.value}>{font.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DropdownMenu>
          <DropdownMenuTrigger
            class={toggleButtonVariants({ size: 'sm', class: 'gap-1 px-2' })}
            mix={toolbarButton()}
          >
            Insert
            <Icon paths={chevronDown} />
          </DropdownMenuTrigger>
          <DropdownMenuContent class="w-40">
            <DropdownMenuItem value="image">Image</DropdownMenuItem>
            <DropdownMenuItem value="table">Table</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem value="divider">Divider</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <ToolbarSeparator class="ml-auto" />
        <ToolbarLink href="#history">Edited 5m ago</ToolbarLink>
      </Toolbar>
      <p class="text-sm text-muted-foreground">
        Formatting: {formatting.length > 0 ? formatting.join(', ') : 'none'} · Align: {alignment[0]}{' '}
        · Inserted: {lastAction}
      </p>
    </div>
  )
})
