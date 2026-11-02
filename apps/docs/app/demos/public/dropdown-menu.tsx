import { clientEntry, type Handle } from 'remix/component'
import { buttonVariants } from '@stemsui/registry/ui/button.tsx'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuEmpty,
  DropdownMenuFilterInput,
  DropdownMenuFilterProvider,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuList,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  onMenuSelect,
} from '@stemsui/registry/ui/dropdown-menu.tsx'

export const DropdownMenuDemo = clientEntry(
  import.meta.url,
  function DropdownMenuDemo(handle: Handle) {
    let lastAction = 'none'
    let showStatusBar = true
    let position = 'bottom'

    return () => (
      <div
        class="flex flex-col items-center gap-4"
        mix={onMenuSelect((event) => {
          if (event.kind === 'item') {
            lastAction = String(event.value ?? event.label)
            void handle.update()
          }
        })}
      >
        <DropdownMenu>
          <DropdownMenuTrigger class={buttonVariants({ variant: 'outline' })}>
            Open menu
          </DropdownMenuTrigger>
          <DropdownMenuContent class="w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuItem value="profile">
                Profile
                <DropdownMenuShortcut>⇧⌘P</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem value="billing">
                Billing
                <DropdownMenuShortcut>⌘B</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem value="settings">
                Settings
                <DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem value="team">Team</DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>Invite users</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem value="invite-email">Email</DropdownMenuItem>
                  <DropdownMenuItem value="invite-message">Message</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem value="invite-more">More...</DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuItem value="new-team">
                New Team
                <DropdownMenuShortcut>⌘+T</DropdownMenuShortcut>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel>Appearance</DropdownMenuLabel>
              <DropdownMenuCheckboxItem
                checked={showStatusBar}
                onCheckedChange={(checked) => {
                  showStatusBar = checked
                  void handle.update()
                }}
              >
                Status bar
              </DropdownMenuCheckboxItem>
            </DropdownMenuGroup>
            <DropdownMenuRadioGroup
              value={position}
              onValueChange={(value) => {
                position = String(value)
                void handle.update()
              }}
            >
              <DropdownMenuLabel>Panel position</DropdownMenuLabel>
              <DropdownMenuRadioItem value="top">Top</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="bottom">Bottom</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="right">Right</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem value="api" disabled>
              API
            </DropdownMenuItem>
            <DropdownMenuItem value="logout" variant="destructive">
              Log out
              <DropdownMenuShortcut>⇧⌘Q</DropdownMenuShortcut>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <FilterableExample />

        <p class="text-sm text-muted-foreground" data-testid="menu-result">
          Last action: <span class="font-medium text-foreground">{lastAction}</span> · Status bar{' '}
          {showStatusBar ? 'on' : 'off'} · Panel {position}
        </p>
      </div>
    )
  },
)

const recentFolders = ['Inbox', 'Drafts', 'Archive']
const allFolders = ['Projects', 'Receipts', 'Résumés', 'Photos', 'Travel', 'Taxes 2026']

/**
 * A filterable menu: type to narrow the folders, use the arrow keys while focus stays in the
 * input, and press Enter to pick the highlighted one.
 */
function FilterableExample() {
  return () => (
    <DropdownMenuFilterProvider autoHighlight>
      <DropdownMenu>
        <DropdownMenuTrigger class={buttonVariants({ variant: 'outline' })}>
          Move to folder…
        </DropdownMenuTrigger>
        {/* Its own data-slot keeps the first demo's `dropdown-menu-content` selector unique. */}
        <DropdownMenuContent data-slot="dropdown-menu-filter-content" class="w-60">
          <DropdownMenuFilterInput
            aria-label="Filter folders"
            placeholder="Filter folders…"
            showClear
            data-testid="menu-filter-input"
          />
          <DropdownMenuEmpty data-testid="menu-filter-empty">No folders found.</DropdownMenuEmpty>
          <DropdownMenuList>
            <DropdownMenuGroup>
              <DropdownMenuLabel>Recent</DropdownMenuLabel>
              {recentFolders.map((folder) => (
                <DropdownMenuItem value={`move:${folder}`}>{folder}</DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
            <DropdownMenuGroup>
              <DropdownMenuLabel>All folders</DropdownMenuLabel>
              {allFolders.map((folder) => (
                <DropdownMenuItem value={`move:${folder}`}>{folder}</DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuList>
        </DropdownMenuContent>
      </DropdownMenu>
    </DropdownMenuFilterProvider>
  )
}
