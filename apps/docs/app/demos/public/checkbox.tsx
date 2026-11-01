import { clientEntry, on, type Handle } from 'remix/component'
import { Checkbox } from '@stemsui/registry/ui/checkbox.tsx'

export const CheckboxDemo = clientEntry(import.meta.url, function CheckboxDemo(handle: Handle) {
  let terms = false
  let submitted: string | null = null

  return () => (
    <div class="flex w-full max-w-sm flex-col gap-6">
      <div class="flex items-center gap-3">
        <Checkbox
          id="terms"
          checked={terms}
          onCheckedChange={(checked) => {
            terms = checked
            void handle.update()
          }}
        />
        <label for="terms" class="text-sm leading-none font-medium select-none">
          Accept terms and conditions
        </label>
        <span class="ml-auto text-sm text-muted-foreground" data-testid="terms-state">
          {terms ? 'Accepted' : 'Not accepted'}
        </span>
      </div>

      <label class="flex items-start gap-3 select-none">
        <Checkbox defaultChecked />
        <span class="grid gap-1.5">
          <span class="text-sm leading-none font-medium">Wrapped in a label</span>
          <span class="text-sm text-muted-foreground">
            Clicking anywhere on the label toggles the checkbox.
          </span>
        </span>
      </label>

      <label class="flex items-center gap-3 text-sm leading-none font-medium select-none">
        <Checkbox indeterminate />
        Indeterminate
      </label>

      <label class="flex items-center gap-3 text-sm leading-none font-medium text-muted-foreground select-none">
        <Checkbox disabled />
        Disabled
      </label>

      <form
        class="flex flex-col gap-3 rounded-lg border p-4"
        mix={on('submit', (event) => {
          event.preventDefault()
          let entries = [...new FormData(event.currentTarget).entries()]
          submitted = entries.map(([key, value]) => `${key}=${String(value)}`).join('&')
          void handle.update()
        })}
      >
        <label class="flex items-center gap-3 text-sm font-medium select-none">
          <Checkbox name="newsletter" value="weekly" defaultChecked />
          Weekly newsletter
        </label>
        <label class="flex items-center gap-3 text-sm font-medium select-none">
          <Checkbox name="marketing" value="yes" uncheckedValue="no" />
          Marketing emails
        </label>
        <label class="flex items-center gap-3 text-sm font-medium select-none">
          <Checkbox name="agree" required />I agree (required)
        </label>
        <button
          type="submit"
          class="inline-flex h-8 items-center justify-center self-start rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Save
        </button>
        <p class="text-sm text-muted-foreground" data-testid="checkbox-form-result">
          Submitted: <code class="font-mono text-foreground">{submitted ?? '(not yet)'}</code>
        </p>
      </form>
    </div>
  )
})
