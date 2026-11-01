import { clientEntry, on, type Handle } from 'remix/component'
import { Switch } from '@stemsui/registry/ui/switch.tsx'

export const SwitchDemo = clientEntry(import.meta.url, function SwitchDemo(handle: Handle) {
  let airplaneMode = false
  let submitted: string | null = null

  return () => (
    <div class="flex w-full max-w-sm flex-col gap-6">
      <div class="flex items-center gap-2">
        <Switch
          id="airplane-mode"
          checked={airplaneMode}
          onCheckedChange={(checked) => {
            airplaneMode = checked
            void handle.update()
          }}
        />
        <label for="airplane-mode" class="text-sm leading-none font-medium select-none">
          Airplane mode
        </label>
        <span class="ml-auto text-sm text-muted-foreground" data-testid="airplane-state">
          {airplaneMode ? 'On' : 'Off'}
        </span>
      </div>

      <label class="flex items-center gap-2 text-sm leading-none font-medium select-none">
        <Switch size="sm" defaultChecked />
        Small, wrapped in a label
      </label>

      <label class="flex items-center gap-2 text-sm leading-none font-medium text-muted-foreground select-none">
        <Switch defaultChecked disabled />
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
        <label class="flex items-center justify-between gap-2 text-sm font-medium select-none">
          Email notifications
          <Switch name="notifications" defaultChecked />
        </label>
        <label class="flex items-center justify-between gap-2 text-sm font-medium select-none">
          Marketing emails
          <Switch name="marketing" value="yes" uncheckedValue="no" />
        </label>
        <button
          type="submit"
          class="inline-flex h-8 items-center justify-center self-start rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Save
        </button>
        <p class="text-sm text-muted-foreground" data-testid="switch-form-result">
          Submitted: <code class="font-mono text-foreground">{submitted ?? '(not yet)'}</code>
        </p>
      </form>
    </div>
  )
})
