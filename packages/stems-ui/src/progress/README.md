# progress

`progress` displays the status of a task that takes a long time, as an accessible progress bar.

Base UI equivalent: [Progress](https://base-ui.com/react/components/progress).

## Usage

```tsx
import * as progress from 'stems-ui/progress'

function Export(handle: Handle<{ value: number | null }>) {
  return () => (
    <progress.Context value={handle.props.value}>
      <div class="grid grid-cols-2" mix={progress.root()}>
        <span mix={progress.label()}>Export data</span>
        <span class="text-right" mix={progress.value()}>
          <progress.ValueText />
        </span>
        <div class="col-span-2 h-1 bg-muted" mix={progress.track()}>
          <div class="h-full bg-primary transition-[width]" mix={progress.indicator()} />
        </div>
      </div>
    </progress.Context>
  )
}
```

## `stems-ui/progress`

- `<progress.Context>` props:
  - `value`: `number | null`. `null` means indeterminate.
  - `min`: defaults to `0`. `max`: defaults to `100`.
  - `format`: `Intl.NumberFormatOptions` for the value text.
  - `locale`: `Intl.LocalesArgument`. Defaults to the runtime locale.
  - `getAriaValueText(formattedValue, value)`: returns `aria-valuetext`.
- `progress.root()`: `role="progressbar"`, `aria-valuenow` (omitted when indeterminate),
  `aria-valuemin`, `aria-valuemax`, `aria-valuetext`, and `aria-labelledby` pointing at `label()`
  (skipped when the host has `aria-label`).
- `progress.track()`: the track. Status attributes only.
- `progress.indicator()`: sets an inline style `width: <percentage>%` (plus Base UI's
  `inset-inline-start: 0; height: inherit`), merged with the host `style`. No width when
  indeterminate.
- `progress.value()`: the host for the value text. Sets `aria-hidden="true"` (the root already
  exposes the value).
- `progress.label()`: sets the `id` the root's `aria-labelledby` points at.
- `<progress.ValueText>`: renders the formatted value as a text node, with no element of its own.
  Put it inside the `value()` host. Pass a function child to customize it:
  `{(formattedValue, value) => …}` (`formattedValue` is `null` when indeterminate).
- `formatValue(value, { format, locale })`: the formatter, for use outside a Context.

## Behavior notes

- Mixins can't render children, so the value text comes from `<progress.ValueText>` (a hostless
  component reading the Context) or `formatValue()`.
- Formatting follows Base UI: without `format`, the value is formatted as a percent of 100
  (`value / 100` with `style: 'percent'`), whatever `min`/`max` are. Pass `format` for other units.
- Default `aria-valuetext`: the formatted value, or `"indeterminate progress"`.
- The status is `complete` when `value === max`, `progressing` for other finite values, and
  `indeterminate` for `null`.
- Server rendering: Base UI uses `en-US` until hydration. Stems uses the runtime locale on both
  sides, so pass `locale` if the server and browser locales might differ.
- The root's `aria-labelledby` is always set (unless the host has `aria-label`). If there is no
  `label()` element, the reference doesn't resolve and assistive technology ignores it.

## Styling hooks

All parts (`root`, `track`, `indicator`, `value`, `label`):

| Attribute            | Values                                   |
| -------------------- | ---------------------------------------- |
| `data-complete`      | Present when the progress has completed. |
| `data-progressing`   | Present while the progress is ongoing.   |
| `data-indeterminate` | Present when `value` is `null`.          |
