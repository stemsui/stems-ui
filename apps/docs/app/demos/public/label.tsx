import { clientEntry, type Handle } from 'remix/component'
import { Input } from '@stemsui/registry/ui/input.tsx'
import { Label } from '@stemsui/registry/ui/label.tsx'

export const LabelDemo = clientEntry(import.meta.url, function LabelDemo(_handle: Handle) {
  return () => (
    <div class="flex w-full max-w-sm flex-col gap-6">
      <div class="flex items-center gap-2">
        <input id="label-terms" type="checkbox" class="peer size-4 accent-primary" />
        <Label for="label-terms">Accept terms and conditions</Label>
      </div>

      <div class="flex items-center gap-2">
        <input id="label-disabled" type="checkbox" class="peer size-4" disabled />
        <Label for="label-disabled">Disabled option</Label>
      </div>

      <div class="flex flex-col gap-2">
        <Label for="label-username">Username</Label>
        <Input id="label-username" placeholder="ada" />
      </div>
    </div>
  )
})
