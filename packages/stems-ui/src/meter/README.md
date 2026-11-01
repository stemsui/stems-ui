# meter

`meter` displays a numeric value within a known range, such as storage used or battery level.

Base UI equivalent: [Meter](https://base-ui.com/react/components/meter).

## Usage

```tsx
import * as meter from 'stems-ui/meter'

function Storage() {
  return () => (
    <meter.Context value={24}>
      <div class="grid grid-cols-2" mix={meter.root()}>
        <span mix={meter.label()}>Storage used</span>
        <span class="text-right" mix={meter.value()}>
          <meter.ValueText />
        </span>
        <div class="col-span-2 h-2 bg-muted" mix={meter.track()}>
          <div class="h-full bg-primary" mix={meter.indicator()} />
        </div>
      </div>
    </meter.Context>
  )
}
```

## `stems-ui/meter`

- `<meter.Context>` props:
  - `value`: `number`.
  - `min`: defaults to `0`. `max`: defaults to `100`.
  - `format`: `Intl.NumberFormatOptions` for the value text.
  - `locale`: `Intl.LocalesArgument`. Defaults to the runtime locale.
  - `getAriaValueText(formattedValue, value)`: returns `aria-valuetext`.
- `meter.root()`: `role="meter"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`,
  `aria-valuetext`, and `aria-labelledby` pointing at `label()` (skipped when the host has
  `aria-label`).
- `meter.track()`: the track (no attributes).
- `meter.indicator()`: sets an inline style `width: <percentage>%` (clamped to 0–100), merged with
  the host `style`.
- `meter.value()`: the host for the value text. Sets `aria-hidden="true"`.
- `meter.label()`: sets the `id` the root's `aria-labelledby` points at.
- `<meter.ValueText>`: renders the formatted value as a text node. Put it inside the `value()`
  host. A function child customizes it: `{(formattedValue, value) => …}`.
- `formatValue(value, { format, locale })`: the formatter (shared with `stems-ui/progress`).

## Behavior notes

- Use a meter for a value in a range, and `stems-ui/progress` for task completion. A meter has no
  indeterminate state.
- Formatting follows Base UI: without `format`, the value is formatted as a percent of 100. Pass
  `format` for other units (`{ style: 'unit', unit: 'gigabyte' }`).
- Default `aria-valuetext`: the formatted value.
- See `stems-ui/progress` for notes on value text, locales during SSR, and `aria-labelledby`.

## Styling hooks

Base UI's Meter has no data attributes. Style the indicator through its inline `width`.

| Part        | Hook          | Values          |
| ----------- | ------------- | --------------- |
| `indicator` | `style.width` | `<percentage>%` |
