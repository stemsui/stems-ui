import { clientEntry, type Handle } from 'remix/component'
import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
  onMenuSelect,
} from '@stemsui/registry/ui/context-menu.tsx'

export const ContextMenuDemo = clientEntry(
  import.meta.url,
  function ContextMenuDemo(handle: Handle) {
    let lastAction = 'none'
    let showBookmarks = true
    let showUrls = false
    let person = 'pedro'

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
        <ContextMenu>
          <ContextMenuTrigger
            tabIndex={0}
            data-testid="context-area"
            class="flex aspect-video w-full max-w-xs items-center justify-center rounded-xl border border-dashed text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            Right click here
          </ContextMenuTrigger>
          <ContextMenuContent class="w-52">
            <ContextMenuGroup>
              <ContextMenuItem value="back">
                Back
                <ContextMenuShortcut>⌘[</ContextMenuShortcut>
              </ContextMenuItem>
              <ContextMenuItem value="forward" disabled>
                Forward
                <ContextMenuShortcut>⌘]</ContextMenuShortcut>
              </ContextMenuItem>
              <ContextMenuItem value="reload">
                Reload
                <ContextMenuShortcut>⌘R</ContextMenuShortcut>
              </ContextMenuItem>
              <ContextMenuSub>
                <ContextMenuSubTrigger>More Tools</ContextMenuSubTrigger>
                <ContextMenuSubContent class="w-44">
                  <ContextMenuItem value="save-page">Save Page...</ContextMenuItem>
                  <ContextMenuItem value="create-shortcut">Create Shortcut...</ContextMenuItem>
                  <ContextMenuItem value="name-window">Name Window...</ContextMenuItem>
                  <ContextMenuSeparator />
                  <ContextMenuItem value="developer-tools">Developer Tools</ContextMenuItem>
                  <ContextMenuSeparator />
                  <ContextMenuItem value="delete" variant="destructive">
                    Delete
                  </ContextMenuItem>
                </ContextMenuSubContent>
              </ContextMenuSub>
            </ContextMenuGroup>
            <ContextMenuSeparator />
            <ContextMenuGroup>
              <ContextMenuCheckboxItem
                checked={showBookmarks}
                onCheckedChange={(checked) => {
                  showBookmarks = checked
                  void handle.update()
                }}
              >
                Show Bookmarks
              </ContextMenuCheckboxItem>
              <ContextMenuCheckboxItem
                checked={showUrls}
                onCheckedChange={(checked) => {
                  showUrls = checked
                  void handle.update()
                }}
              >
                Show Full URLs
              </ContextMenuCheckboxItem>
            </ContextMenuGroup>
            <ContextMenuSeparator />
            <ContextMenuRadioGroup
              value={person}
              onValueChange={(value) => {
                person = String(value)
                void handle.update()
              }}
            >
              <ContextMenuLabel>People</ContextMenuLabel>
              <ContextMenuRadioItem value="pedro">Pedro Duarte</ContextMenuRadioItem>
              <ContextMenuRadioItem value="colm">Colm Tuite</ContextMenuRadioItem>
            </ContextMenuRadioGroup>
          </ContextMenuContent>
        </ContextMenu>

        <p class="text-sm text-muted-foreground" data-testid="context-menu-result">
          Last action: <span class="font-medium text-foreground">{lastAction}</span> · Bookmarks{' '}
          {showBookmarks ? 'on' : 'off'} · Person {person}
        </p>
      </div>
    )
  },
)
