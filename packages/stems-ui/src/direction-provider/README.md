# direction-provider

`DirectionProvider` sets the text direction (`ltr` or `rtl`) for a subtree, so Stems widgets flip
their horizontal keyboard navigation and positioning.

Base UI equivalent: [Direction Provider](https://base-ui.com/react/utils/direction-provider).

## Usage

```tsx
import { DirectionProvider } from 'stems-ui/direction-provider'
import * as slider from 'stems-ui/slider'

function App() {
  return () => (
    <DirectionProvider direction="rtl">
      <slider.Context defaultValue={25}>{/* ... */}</slider.Context>
    </DirectionProvider>
  )
}
```

If your app already sets `dir` on `<html>` or a container, you don't need the provider: Stems
reads `dir` directly.

## `stems-ui/direction-provider`

- `<DirectionProvider direction?>`: `direction` is `'ltr'` (default) or `'rtl'`.
- `getDirection(node)`: the direction that applies to a DOM node: the nearest `dir="ltr|rtl"`
  attribute, then the computed CSS `direction`, then `'ltr'`. This is what Stems widgets call at
  event time.
- `getDirectionFromContext(handle)`: the nearest provider's direction for a component or mixin
  `handle`, or `undefined` without a provider. Base UI's `useDirection`. Use it for render-time
  decisions; it doesn't see `dir` attributes the app set itself.
- Types: `TextDirection`, `DirectionProviderProps`, `DirectionContextValue`.

## Design: the provider renders `dir`

Stems widgets resolve direction with `getDirection(node)` inside event handlers, where they only
have a DOM node, not a component handle. So the provider has to be visible in the DOM.
`DirectionProvider` renders:

```html
<div dir="rtl" style="display: contents" data-direction-provider>…children…</div>
```

- `getDirection` finds it through `closest('[dir]')`, so every existing widget (tabs, accordion,
  radio group, toggle button group, slider, menu, select, combobox, OTP field, scroll area…)
  honors it with no changes, and nested providers or `dir` attributes override it.
- `display: contents` generates no box, so layout is unchanged: children stay flex or grid items
  of the provider's parent. A plain `div` has no role, so nothing is added to the accessibility
  tree (the old `display: contents` accessibility bugs affected elements with semantics, such as
  buttons and tables).
- It's in the server-rendered HTML, so direction is right before hydration.
- **Difference from Base UI:** Base UI's provider only changes component behavior and you must also
  set `dir` yourself. The Stems provider also sets the CSS direction of its subtree (text
  alignment, logical properties, bidi), which is what you want in practice. Base UI needs the
  context mainly for portaled popups; Stems popups render in place (top layer, no portals), so
  `dir` inherits naturally.
- The one structural cost is the extra element: selectors like `.parent > .child` and
  `:first-child` see it. Set `dir` on your own element instead if that matters.

## Utilities

Base UI's other utilities and how they map to Stems:

- **CSP Provider:** blocked upstream. Server-rendered `<style>` tags from `@remix-run/component`
  have no nonce, so a provider has nothing to configure yet (`docs/upstream-issues.md` §6). Stems
  modules don't inject style elements; they use inline `style` attributes only.
- **`mergeProps`:** not needed. Remix composes behavior with `mix` arrays
  (`mix={[tabs.tab({ value }), mix]}`), and `attrs()` merges attributes so explicit host props win.
- **`useRender`:** not needed. Mixins apply to whatever element you put them on, so there is no
  `render` prop to replace the element.
