import { clientEntry, on, type Handle } from 'remix/component'
import { RadioGroup, RadioGroupItem } from '@stemsui/registry/ui/radio-group.tsx'

const densities = [
  { value: 'default', label: 'Default' },
  { value: 'comfortable', label: 'Comfortable' },
  { value: 'compact', label: 'Compact' },
]

export const RadioGroupDemo = clientEntry(import.meta.url, function RadioGroupDemo(handle: Handle) {
  let density = 'comfortable'
  let submitted: string | null = null

  return () => (
    <div class="flex w-full max-w-sm flex-col gap-8">
      <div class="flex flex-col gap-3">
        <RadioGroup
          aria-label="Density"
          value={density}
          onValueChange={(value) => {
            density = value
            void handle.update()
          }}
        >
          {densities.map((option) => (
            <div class="flex items-center gap-3">
              <RadioGroupItem value={option.value} id={`density-${option.value}`} />
              <label
                for={`density-${option.value}`}
                class="text-sm leading-none font-medium select-none"
              >
                {option.label}
              </label>
            </div>
          ))}
        </RadioGroup>
        <p class="text-sm text-muted-foreground" data-testid="radio-group-value">
          Density: <code class="font-mono text-foreground">{density}</code>
        </p>
      </div>

      <form
        class="flex flex-col gap-4 rounded-lg border p-4"
        mix={on('submit', (event) => {
          event.preventDefault()
          let entries = [...new FormData(event.currentTarget).entries()]
          submitted = entries.map(([key, value]) => `${key}=${String(value)}`).join('&')
          void handle.update()
        })}
      >
        <div id="plan-label" class="text-sm font-medium">
          Plan (required)
        </div>
        <RadioGroup name="plan" required aria-labelledby="plan-label">
          <label class="flex items-center gap-3 text-sm select-none">
            <RadioGroupItem value="free" />
            Free
          </label>
          <label class="flex items-center gap-3 text-sm select-none">
            <RadioGroupItem value="pro" />
            Pro
          </label>
          <label class="flex items-center gap-3 text-sm text-muted-foreground select-none">
            <RadioGroupItem value="enterprise" disabled />
            Enterprise (unavailable)
          </label>
        </RadioGroup>
        <button
          type="submit"
          class="inline-flex h-8 items-center justify-center self-start rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Continue
        </button>
        <p class="text-sm text-muted-foreground" data-testid="radio-form-result">
          Submitted: <code class="font-mono text-foreground">{submitted ?? '(not yet)'}</code>
        </p>
      </form>
    </div>
  )
})
