# separator

`separator` wires a host element as an accessible separator between groups of content. App code owns
the markup and visual styles.

Base UI equivalent: [Separator](https://base-ui.com/react/components/separator).

## Usage

```tsx
import { separator } from 'stems-ui/separator'

function Toolbar() {
  return () => (
    <div>
      <button type="button">Bold</button>
      <div class="h-4 w-px bg-border" mix={separator({ orientation: 'vertical' })} />
      <button type="button">Link</button>
    </div>
  )
}
```

## `stems-ui/separator`

- `separator(options?)`: wires `role="separator"`, `aria-orientation`, and `data-orientation`.
  - `orientation`: `'horizontal' | 'vertical'`. Defaults to `'horizontal'`.
  - `decorative`: when `true`, hides the separator from assistive technology (`aria-hidden`).

## Behavior notes

- `<hr>` hosts keep their implicit separator role.
- Explicit host props win: `attrs` only fills in values the element does not already set.

## Styling hooks

| Attribute          | Values                     |
| ------------------ | -------------------------- |
| `data-orientation` | `horizontal` \| `vertical` |
