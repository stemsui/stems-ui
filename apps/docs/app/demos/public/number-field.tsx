import { clientEntry, on, type Handle } from 'remix/component'
import { NumberField, NumberFieldScrubArea } from '@stemsui/registry/ui/number-field.tsx'

export const NumberFieldDemo = clientEntry(
  import.meta.url,
  function NumberFieldDemo(handle: Handle) {
    let quantity: number | null = 1
    let submitted: string | null = null

    return () => (
      <div class="flex w-full max-w-xs flex-col gap-8">
        <NumberField
          id="quantity"
          value={quantity}
          min={0}
          max={20}
          onValueChange={(value) => {
            quantity = value
            void handle.update()
          }}
        >
          <label for="quantity" class="text-sm leading-none font-medium select-none">
            Quantity{' '}
            <span class="font-normal text-muted-foreground" data-testid="quantity-value">
              ({quantity ?? 'empty'})
            </span>
          </label>
        </NumberField>

        <NumberField
          id="price"
          defaultValue={1299.5}
          min={0}
          step={0.5}
          format={{ style: 'currency', currency: 'EUR' }}
          locale="de-DE"
          allowWheelScrub
        >
          <NumberFieldScrubArea>
            <label for="price">Price (drag me, de-DE)</label>
          </NumberFieldScrubArea>
        </NumberField>

        <NumberField
          id="discount"
          defaultValue={0.15}
          min={0}
          max={1}
          step={0.01}
          format={{ style: 'percent' }}
        >
          <label for="discount" class="text-sm leading-none font-medium select-none">
            Discount
          </label>
        </NumberField>

        <NumberField aria-label="Disabled" defaultValue={42} disabled />

        <form
          class="flex flex-col gap-3 rounded-lg border p-4"
          mix={on('submit', (event) => {
            event.preventDefault()
            let entries = [...new FormData(event.currentTarget).entries()]
            submitted = entries.map(([key, value]) => `${key}=${String(value)}`).join('&')
            void handle.update()
          })}
        >
          <NumberField id="guests" name="guests" min={1} max={12} required>
            <label for="guests" class="text-sm leading-none font-medium select-none">
              Guests
            </label>
          </NumberField>
          <button
            type="submit"
            class="inline-flex h-8 items-center justify-center self-start rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Book
          </button>
          <p class="text-sm text-muted-foreground" data-testid="number-field-form-result">
            Submitted: <code class="font-mono text-foreground">{submitted ?? '(not yet)'}</code>
          </p>
        </form>
      </div>
    )
  },
)
