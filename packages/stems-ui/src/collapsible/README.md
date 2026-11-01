# collapsible

`collapsible` wires a trigger button to a panel that opens and closes, with height-animation
hooks. App code owns the markup and visual styles.

Base UI equivalent: [Collapsible](https://base-ui.com/react/components/collapsible).

## Usage

```tsx
import * as collapsible from 'stems-ui/collapsible'

function RecoveryKeys() {
  return () => (
    <collapsible.Context defaultOpen={false}>
      <div mix={collapsible.root()}>
        <button mix={collapsible.trigger()}>Recovery keys</button>
        <div
          class="h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-150 data-starting-style:h-0 data-ending-style:h-0 [&[hidden]:not([hidden=until-found])]:hidden"
          mix={collapsible.panel()}
        >
          <div>alien-bean-pasta</div>
          <div>wild-irish-burrito</div>
        </div>
      </div>
    </collapsible.Context>
  )
}
```

Control the state with `open` and `onOpenChange`, or let the context own it with `defaultOpen`.
Listen for bubbling changes on the root or an ancestor:

```tsx
<div mix={collapsible.onCollapsibleChange((event) => console.log(event.open))}>…</div>
```

## `stems-ui/collapsible`

- `Context`: provider that owns the open state.
  - `open`: `boolean`. Controlled open state.
  - `defaultOpen`: `boolean`. Initial uncontrolled state. Defaults to `false`.
  - `onOpenChange(open, event?)`: called when the trigger is pressed, or when find-in-page
    reveals a `hiddenUntilFound` panel.
  - `disabled`: `boolean`. Disables the trigger. Defaults to `false`.
- `root()`: optional root element. Sets state attributes and is where change events are
  dispatched from (without it they're dispatched from the trigger or panel).
- `trigger()`: the toggle button. Sets `type="button"`, `aria-expanded`, `aria-controls`, and
  native `disabled`. Non-`<button>` hosts get `role="button"`, `tabIndex`, `aria-disabled`, and
  Enter/Space activation.
- `panel(options?)`: the collapsible content. Sets `id`, `hidden` while closed, and the transition
  attributes and size variables below.
  - `hiddenUntilFound`: `boolean`. Closed panels use `hidden="until-found"`, so the browser's
    find-in-page can search them. A match opens the panel (without animation) and calls
    `onOpenChange(true, event)`. Defaults to `false`.
  - `keepMounted`: accepted for Base UI parity. Has no effect: the panel is app-owned markup, so
    it always stays in the DOM and closed panels are hidden with `hidden`.
- `onCollapsibleChange(handler)`: listener mixin for `CollapsibleChangeEvent`
  (`stems:collapsible-change`, bubbles, has `open`).

## Behavior notes

- Closed panels get the `hidden` attribute in server HTML and on the client, so they're hidden
  even without CSS. Classes that set `display` override `hidden`: add
  `[&[hidden]:not([hidden=until-found])]:hidden` (Tailwind) when the panel has a display class.
- Opening: the panel is shown with `data-starting-style`, `--collapsible-panel-height` is set to
  the measured content height in px, and the attribute is removed on the next frame so CSS can
  transition from the starting style. When animations finish, the variables become `auto` so the
  panel follows content size changes.
- Closing: the variables are set to the current px size, `data-ending-style` is added, and the
  panel is hidden once its CSS transitions and animations finish (`element.getAnimations()`).
  Reopening mid-close reverses from the current size.
- `beforematch` (find-in-page, fragment navigation) opens a `hiddenUntilFound` panel even when
  the collapsible is `disabled`. If a controlled owner doesn't open it, `hidden="until-found"` is
  restored.
- Explicit host props win (`attrs()` semantics). Changing the panel `id` breaks the trigger's
  `aria-controls`, so leave it generated.
- No keyboard handling beyond the native button: Enter and Space toggle.

## Styling hooks

| Part    | Attribute             | Values / notes                                  |
| ------- | --------------------- | ----------------------------------------------- |
| root    | `data-open`           | present when open                               |
| root    | `data-closed`         | present when closed                             |
| root    | `data-disabled`       | present when disabled                           |
| trigger | `data-panel-open`     | present when open                               |
| trigger | `data-disabled`       | present when disabled                           |
| trigger | `aria-expanded`       | `"true"` \| `"false"`                           |
| panel   | `data-open`           | present when open                               |
| panel   | `data-closed`         | present when closed (also while animating out)  |
| panel   | `data-starting-style` | present on the first frame of opening           |
| panel   | `data-ending-style`   | present while animating out                     |
| panel   | `hidden`              | present when closed; `"until-found"` if enabled |

| Part  | CSS variable                 | Value                                 |
| ----- | ---------------------------- | ------------------------------------- |
| panel | `--collapsible-panel-height` | content height in px while animating; |
|       |                              | `auto` once open                      |
| panel | `--collapsible-panel-width`  | content width, same rules             |
