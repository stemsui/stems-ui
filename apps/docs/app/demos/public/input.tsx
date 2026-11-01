import { clientEntry, type Handle } from 'remix/component'
import { Input } from '@stemsui/registry/ui/input.tsx'
import { Label } from '@stemsui/registry/ui/label.tsx'

export const InputDemo = clientEntry(import.meta.url, function InputDemo(handle: Handle) {
  let name = ''

  return () => (
    <div class="flex w-full max-w-sm flex-col gap-6">
      <div class="flex flex-col gap-2">
        <Label for="input-email">Email</Label>
        <Input id="input-email" type="email" placeholder="you@example.com" />
      </div>

      <div class="flex flex-col gap-2">
        <Label for="input-name">Name (controlled)</Label>
        <Input
          id="input-name"
          placeholder="Ada Lovelace"
          value={name}
          onValueChange={(value) => {
            name = value
            void handle.update()
          }}
        />
        <p class="text-sm text-muted-foreground" data-testid="input-greeting">
          {name ? `Hello, ${name}!` : 'Type a name.'}
        </p>
      </div>

      <div class="flex flex-col gap-2">
        <Label for="input-username">Username (uncontrolled, with default)</Label>
        <Input id="input-username" defaultValue="adalovelace" />
      </div>

      <div class="flex flex-col gap-2">
        <Label for="input-file">Picture</Label>
        <Input id="input-file" type="file" />
      </div>

      <Input aria-label="Disabled" placeholder="Disabled" disabled />
    </div>
  )
})
