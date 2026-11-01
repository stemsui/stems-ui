import { clientEntry, on, type Handle } from 'remix/component'
import { Slider } from '@stemsui/registry/ui/slider.tsx'

export const SliderDemo = clientEntry(import.meta.url, function SliderDemo(handle: Handle) {
  let volume = 50
  let range: number[] = [25, 75]
  let committed: string | null = null
  let submitted: string | null = null

  return () => (
    <div class="flex w-full max-w-sm flex-col gap-8">
      <div class="flex flex-col gap-3">
        <div class="flex items-center justify-between text-sm font-medium">
          <span id="volume-label">Volume</span>
          <span class="text-muted-foreground tabular-nums" data-testid="volume-value">
            {volume}
          </span>
        </div>
        <Slider
          aria-labelledby="volume-label"
          value={volume}
          onValueChange={(value) => {
            volume = value as number
            void handle.update()
          }}
        />
      </div>

      <div class="flex flex-col gap-3">
        <div class="flex items-center justify-between text-sm font-medium">
          <span>Price range</span>
          <span class="text-muted-foreground tabular-nums" data-testid="range-value">
            ${range[0]} – ${range[1]}
          </span>
        </div>
        <Slider
          value={range}
          step={5}
          minStepsBetweenValues={2}
          getAriaLabel={(index) => (index === 0 ? 'Minimum price' : 'Maximum price')}
          format={{ style: 'currency', currency: 'USD', maximumFractionDigits: 0 }}
          onValueChange={(value) => {
            range = value as number[]
            void handle.update()
          }}
          onValueCommitted={(value) => {
            committed = (value as number[]).join(', ')
            void handle.update()
          }}
        />
        <p class="text-xs text-muted-foreground" data-testid="range-committed">
          Committed: {committed ?? '(drag and release)'}
        </p>
      </div>

      <div class="flex h-40 items-stretch gap-8 px-2">
        <Slider aria-label="Bass" orientation="vertical" defaultValue={30} />
        <Slider aria-label="Treble" orientation="vertical" defaultValue={70} />
        <Slider aria-label="Disabled" orientation="vertical" defaultValue={50} disabled />
      </div>

      <form
        class="flex flex-col gap-3 rounded-lg border p-4"
        mix={on('submit', (event) => {
          event.preventDefault()
          let entries = [...new FormData(event.currentTarget).entries()]
          submitted = entries.map(([key, value]) => `${key}=${String(value)}`).join('&')
          void handle.update()
        })}
      >
        <span class="text-sm font-medium" id="brightness-label">
          Brightness
        </span>
        <Slider aria-labelledby="brightness-label" name="brightness" defaultValue={[20, 80]} />
        <button
          type="submit"
          class="inline-flex h-8 items-center justify-center self-start rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Save
        </button>
        <p class="text-sm text-muted-foreground" data-testid="slider-form-result">
          Submitted: <code class="font-mono text-foreground">{submitted ?? '(not yet)'}</code>
        </p>
      </form>
    </div>
  )
})
