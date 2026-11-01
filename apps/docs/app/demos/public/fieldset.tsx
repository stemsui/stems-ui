import { clientEntry, on, type Handle } from 'remix/component'
import { Button } from '@stemsui/registry/ui/button.tsx'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '@stemsui/registry/ui/field.tsx'
import { Input } from '@stemsui/registry/ui/input.tsx'

export const FieldsetDemo = clientEntry(import.meta.url, function FieldsetDemo(handle: Handle) {
  let locked = false

  return () => (
    <div class="flex w-full max-w-md flex-col gap-6">
      <FieldSet disabled={locked} data-testid="fieldset-billing">
        <FieldLegend>Billing address</FieldLegend>
        <FieldDescription>Where we send your invoices.</FieldDescription>
        <FieldGroup>
          <Field>
            <FieldLabel>Street</FieldLabel>
            <Input placeholder="12 Analytical Way" />
          </Field>
          <div class="grid grid-cols-2 gap-4">
            <Field>
              <FieldLabel>City</FieldLabel>
              <Input placeholder="London" />
            </Field>
            <Field>
              <FieldLabel>Postal code</FieldLabel>
              <Input placeholder="SW1A 1AA" />
            </Field>
          </div>
        </FieldGroup>
      </FieldSet>

      {/* Toggles the fieldset's `disabled`, which propagates to every field inside. */}
      <Button
        variant="outline"
        type="button"
        class="self-start"
        data-testid="fieldset-toggle"
        mix={on('click', () => {
          locked = !locked
          void handle.update()
        })}
      >
        {locked ? 'Unlock address' : 'Lock address'}
      </Button>
    </div>
  )
})
