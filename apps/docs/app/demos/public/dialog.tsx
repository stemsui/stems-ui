import { clientEntry, on, type Handle } from 'remix/component'
import { buttonVariants } from '@stemsui/registry/ui/button.tsx'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@stemsui/registry/ui/dialog.tsx'
import { Input } from '@stemsui/registry/ui/input.tsx'
import { Label } from '@stemsui/registry/ui/label.tsx'

export const DialogDemo = clientEntry(import.meta.url, function DialogDemo(handle: Handle) {
  let saved = 'Pedro Duarte'
  // Controlled fields; `saved` is updated when the form is submitted.
  let name = saved
  let username = '@peduarte'

  return () => (
    <div class="flex flex-col items-center gap-4">
      <Dialog>
        <DialogTrigger class={buttonVariants({ variant: 'outline' })}>Edit profile</DialogTrigger>
        <DialogContent class="sm:max-w-[425px]">
          <form
            class="grid gap-6"
            mix={on('submit', (event) => {
              event.preventDefault()
              saved = name
              void handle.update()
            })}
          >
            <DialogHeader>
              <DialogTitle>Edit profile</DialogTitle>
              <DialogDescription>
                Make changes to your profile here. Click save when you're done.
              </DialogDescription>
            </DialogHeader>
            <div class="grid gap-4">
              <div class="grid gap-3">
                <Label for="dialog-demo-name">Name</Label>
                <Input
                  id="dialog-demo-name"
                  name="name"
                  value={name}
                  onValueChange={(value) => {
                    name = value
                    void handle.update()
                  }}
                />
              </div>
              <div class="grid gap-3">
                <Label for="dialog-demo-username">Username</Label>
                <Input
                  id="dialog-demo-username"
                  name="username"
                  value={username}
                  onValueChange={(value) => {
                    username = value
                    void handle.update()
                  }}
                />
              </div>
            </div>
            <DialogFooter class="sm:justify-between">
              <Dialog>
                <DialogTrigger
                  type="button"
                  class={buttonVariants({ variant: 'ghost' })}
                  data-testid="nested-trigger"
                >
                  Privacy settings
                </DialogTrigger>
                <DialogContent class="sm:max-w-sm" data-testid="nested-dialog">
                  <DialogHeader>
                    <DialogTitle>Privacy settings</DialogTitle>
                    <DialogDescription>
                      This dialog is nested: Escape or a click outside closes only this one.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter showCloseButton />
                </DialogContent>
              </Dialog>
              <div class="flex flex-col-reverse gap-2 sm:flex-row">
                <DialogClose type="button" class={buttonVariants({ variant: 'outline' })}>
                  Cancel
                </DialogClose>
                <DialogClose type="submit" class={buttonVariants()}>
                  Save changes
                </DialogClose>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <p class="text-sm text-muted-foreground" data-testid="dialog-result">
        Name: <span class="font-medium text-foreground">{saved}</span>
      </p>
    </div>
  )
})
