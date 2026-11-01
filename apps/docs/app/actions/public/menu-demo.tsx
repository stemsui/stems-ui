import { clientEntry, type Handle } from 'remix/component'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
  onMenuSelect,
} from '@stemsui/registry/ui/dropdown-menu.tsx'

export const MenuDemo = clientEntry(import.meta.url, function MenuDemo(handle: Handle) {
  let lastAction = 'none'
  let showStatusBar = true

  return () => (
    <div
      class="flex flex-col items-center gap-4"
      mix={onMenuSelect((event) => {
        if (event.item.name === 'statusBar') {
          showStatusBar = !showStatusBar
        }
        lastAction = event.item.name
        void handle.update()
      })}
    >
      <DropdownMenu label="Account">
        <DropdownMenuTrigger class="inline-flex h-9 items-center rounded-md border bg-background px-4 text-sm font-medium shadow-xs hover:bg-accent hover:text-accent-foreground aria-expanded:bg-accent">
          Open menu
        </DropdownMenuTrigger>
        <DropdownMenuContent class="w-56">
          <DropdownMenuLabel>My Account</DropdownMenuLabel>
          <DropdownMenuGroup>
            <DropdownMenuItem name="profile">
              Profile
              <DropdownMenuShortcut>⇧⌘P</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem name="billing">
              Billing
              <DropdownMenuShortcut>⌘B</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem name="team" disabled>
              Team
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuCheckboxItem name="statusBar" label="Status bar" checked={showStatusBar}>
            Status bar
          </DropdownMenuCheckboxItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem name="logout" variant="destructive">
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <p class="text-sm text-muted-foreground" data-testid="menu-result">
        Last action: <span class="font-medium text-foreground">{lastAction}</span> · Status bar{' '}
        {showStatusBar ? 'on' : 'off'}
      </p>
    </div>
  )
})
