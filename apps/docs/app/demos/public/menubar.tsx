import { clientEntry, type Handle } from 'remix/component'
import {
  Menubar,
  MenubarCheckboxItem,
  MenubarContent,
  MenubarGroup,
  MenubarItem,
  MenubarLabel,
  MenubarMenu,
  MenubarRadioGroup,
  MenubarRadioItem,
  MenubarSeparator,
  MenubarShortcut,
  MenubarSub,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarTrigger,
  onMenuSelect,
} from '@stemsui/registry/ui/menubar.tsx'

export const MenubarDemo = clientEntry(import.meta.url, function MenubarDemo(handle: Handle) {
  let lastAction = 'none'
  let bookmarksBar = false
  let fullUrls = true
  let profile = 'benoit'

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
      <Menubar aria-label="Application" class="w-72">
        <MenubarMenu>
          <MenubarTrigger>File</MenubarTrigger>
          <MenubarContent>
            <MenubarGroup>
              <MenubarItem value="new-tab">
                New Tab <MenubarShortcut>⌘T</MenubarShortcut>
              </MenubarItem>
              <MenubarItem value="new-window">
                New Window <MenubarShortcut>⌘N</MenubarShortcut>
              </MenubarItem>
              <MenubarItem disabled>New Incognito Window</MenubarItem>
            </MenubarGroup>
            <MenubarSeparator />
            <MenubarSub>
              <MenubarSubTrigger>Share</MenubarSubTrigger>
              <MenubarSubContent>
                <MenubarItem value="share-email">Email link</MenubarItem>
                <MenubarItem value="share-messages">Messages</MenubarItem>
                <MenubarItem value="share-notes">Notes</MenubarItem>
              </MenubarSubContent>
            </MenubarSub>
            <MenubarSeparator />
            <MenubarItem value="print">
              Print... <MenubarShortcut>⌘P</MenubarShortcut>
            </MenubarItem>
          </MenubarContent>
        </MenubarMenu>
        <MenubarMenu>
          <MenubarTrigger>Edit</MenubarTrigger>
          <MenubarContent>
            <MenubarItem value="undo">
              Undo <MenubarShortcut>⌘Z</MenubarShortcut>
            </MenubarItem>
            <MenubarItem value="redo">
              Redo <MenubarShortcut>⇧⌘Z</MenubarShortcut>
            </MenubarItem>
            <MenubarSeparator />
            <MenubarSub>
              <MenubarSubTrigger>Find</MenubarSubTrigger>
              <MenubarSubContent>
                <MenubarItem value="search-web">Search the web</MenubarItem>
                <MenubarSeparator />
                <MenubarItem value="find">Find...</MenubarItem>
                <MenubarItem value="find-next">Find Next</MenubarItem>
                <MenubarItem value="find-previous">Find Previous</MenubarItem>
              </MenubarSubContent>
            </MenubarSub>
            <MenubarSeparator />
            <MenubarItem value="cut">Cut</MenubarItem>
            <MenubarItem value="copy">Copy</MenubarItem>
            <MenubarItem value="paste">Paste</MenubarItem>
          </MenubarContent>
        </MenubarMenu>
        <MenubarMenu>
          <MenubarTrigger>View</MenubarTrigger>
          <MenubarContent class="w-64">
            <MenubarCheckboxItem
              checked={bookmarksBar}
              onCheckedChange={(checked) => {
                bookmarksBar = checked
                void handle.update()
              }}
            >
              Always Show Bookmarks Bar
            </MenubarCheckboxItem>
            <MenubarCheckboxItem
              checked={fullUrls}
              onCheckedChange={(checked) => {
                fullUrls = checked
                void handle.update()
              }}
            >
              Always Show Full URLs
            </MenubarCheckboxItem>
            <MenubarSeparator />
            <MenubarItem inset value="reload">
              Reload <MenubarShortcut>⌘R</MenubarShortcut>
            </MenubarItem>
            <MenubarItem inset disabled>
              Force Reload <MenubarShortcut>⇧⌘R</MenubarShortcut>
            </MenubarItem>
            <MenubarSeparator />
            <MenubarItem inset value="fullscreen">
              Toggle Fullscreen
            </MenubarItem>
          </MenubarContent>
        </MenubarMenu>
        <MenubarMenu>
          <MenubarTrigger>Profiles</MenubarTrigger>
          <MenubarContent>
            <MenubarGroup>
              <MenubarLabel inset>Switch profile</MenubarLabel>
              <MenubarRadioGroup
                value={profile}
                onValueChange={(value) => {
                  profile = String(value)
                  void handle.update()
                }}
              >
                <MenubarRadioItem value="andy">Andy</MenubarRadioItem>
                <MenubarRadioItem value="benoit">Benoit</MenubarRadioItem>
                <MenubarRadioItem value="luis">Luis</MenubarRadioItem>
              </MenubarRadioGroup>
            </MenubarGroup>
            <MenubarSeparator />
            <MenubarItem inset value="edit-profiles">
              Edit...
            </MenubarItem>
            <MenubarSeparator />
            <MenubarItem inset value="add-profile">
              Add Profile...
            </MenubarItem>
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
      <p class="text-sm text-muted-foreground">
        Last action: {lastAction} · Profile: {profile}
      </p>
    </div>
  )
})
