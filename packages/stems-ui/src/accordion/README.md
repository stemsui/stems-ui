# accordion

`accordion` wires a set of headings with collapsible panels: open state, ARIA, focus movement
between triggers, and the same height-animation hooks as `collapsible`. App code owns the markup
and visual styles.

Base UI equivalent: [Accordion](https://base-ui.com/react/components/accordion).

## Usage

```tsx
import * as accordion from 'stems-ui/accordion'

let panelClass =
  'h-(--accordion-panel-height) overflow-hidden transition-[height] duration-200 data-starting-style:h-0 data-ending-style:h-0'

function Faq() {
  return () => (
    <accordion.Context defaultValue={['shipping']}>
      <div mix={accordion.root()}>
        <accordion.ItemContext value="shipping">
          <div mix={accordion.item()}>
            <h3 mix={accordion.header()}>
              <button mix={accordion.trigger()}>How long does shipping take?</button>
            </h3>
            <div class={panelClass} mix={accordion.panel()}>
              Standard shipping takes 3–5 business days.
            </div>
          </div>
        </accordion.ItemContext>

        <accordion.ItemContext value="returns">
          <div mix={accordion.item()}>
            <h3 mix={accordion.header()}>
              <button mix={accordion.trigger()}>What is your return policy?</button>
            </h3>
            <div class={panelClass} mix={accordion.panel()}>
              Return any item within 30 days.
            </div>
          </div>
        </accordion.ItemContext>
      </div>
    </accordion.Context>
  )
}
```

The value is always an array of item values, in single and `multiple` mode. Listen for bubbling
changes on the root or an ancestor:

```tsx
<div
  mix={accordion.onAccordionChange((event) => {
    console.log(event.itemValue, event.open, event.value)
  })}
>
  …
</div>
```

## `stems-ui/accordion`

- `Context`: provider that owns the open items.
  - `value`: `string[]`. Controlled open items.
  - `defaultValue`: `string[]`. Initial uncontrolled open items. Defaults to `[]`.
  - `onValueChange(value, event?)`: called with the next open items.
  - `multiple`: `boolean`. Allow several open items. Defaults to `false` (opening an item closes
    the others; the open item can still be closed).
  - `disabled`: `boolean`. Disables every item. Defaults to `false`.
  - `orientation`: `'vertical' | 'horizontal'`. Picks the arrow keys. Defaults to `'vertical'`.
  - `loopFocus`: `boolean`. Arrow keys wrap around at the ends. Defaults to `true`.
  - `hiddenUntilFound`: `boolean`. Default for every panel's `hiddenUntilFound`. Defaults to
    `false`.
  - `keepMounted`: accepted for Base UI parity; panels are always kept mounted (see below).
- `ItemContext`: provider for one item.
  - `value`: `string`. Identifies the item in the accordion value. Defaults to a generated id.
  - `disabled`: `boolean`. Disables this item. Defaults to `false`.
  - `onOpenChange(open, event?)`: called before the root `onValueChange` when this item toggles.
- `root()`: the root element. Sets state attributes and is where change events are dispatched
  from (without it they're dispatched from the trigger or panel).
- `item()`: the element grouping one header and panel.
- `header()`: the heading around the trigger. Use a real heading (`<h3>`, …) for the level that
  fits the page.
- `trigger()`: the toggle button. Sets `type="button"`, `id`, `aria-expanded`, `aria-controls`,
  native `disabled`, and handles the keys below. Non-`<button>` hosts get `role="button"`,
  `tabIndex`, `aria-disabled`, and Enter/Space activation. An explicit `id` is kept and used for
  the panel's `aria-labelledby`.
- `panel(options?)`: the item content. Sets `id`, `role="region"`, `aria-labelledby`, `hidden`
  while closed, and the transition attributes and size variables below.
  - `hiddenUntilFound`: `boolean`. Overrides the root option. Closed panels use
    `hidden="until-found"`; a find-in-page match opens the item without animation.
  - `keepMounted`: accepted for Base UI parity. Has no effect.
- `onAccordionChange(handler)`: listener mixin for `AccordionChangeEvent`
  (`stems:accordion-change`, bubbles, has `value`, `itemValue`, `open`).

## Behavior notes

| Key                    | Action                                                           |
| ---------------------- | ---------------------------------------------------------------- |
| Enter / Space          | Toggle the focused item (native button behavior)                 |
| ArrowDown / ArrowUp    | Focus the next / previous enabled trigger (`vertical`)           |
| ArrowRight / ArrowLeft | Focus the next / previous enabled trigger (`horizontal`, RTL ok) |
| Home / End             | Focus the first / last enabled trigger                           |

- Disabled items are skipped by arrow keys. Focus wraps unless `loopFocus={false}`.
- Base UI 1.9 deprecated `orientation` and `loopFocus` and removed arrow-key focus movement
  (following an APG update). Stems keeps the movement, as `@remix-run/ui` does; Tab still moves
  through triggers normally.
- Panels share `collapsible`'s logic: closed panels get `hidden` (in server HTML too), opening
  shows `data-starting-style` for one frame with `--accordion-panel-height` measured in px, closing
  sets `data-ending-style` and hides the panel once its CSS transitions and animations finish.
  Once open, the variables are `auto`. Classes that set `display` override `hidden`.
- Panels are always kept mounted: the mixin can't remove app-owned markup.
- `data-index` is the item's render order in the accordion.

## Styling hooks

| Part    | Attribute             | Values / notes                                  |
| ------- | --------------------- | ----------------------------------------------- |
| root    | `data-orientation`    | `vertical` \| `horizontal`                      |
| root    | `data-disabled`       | present when the accordion is disabled          |
| item    | `data-open`           | present when the item is open                   |
| item    | `data-disabled`       | present when the item is disabled               |
| item    | `data-index`          | item index                                      |
| header  | `data-open`           | present when the item is open                   |
| header  | `data-disabled`       | present when the item is disabled               |
| header  | `data-index`          | item index                                      |
| trigger | `data-panel-open`     | present when the panel is open                  |
| trigger | `data-disabled`       | present when the item is disabled               |
| trigger | `data-index`          | item index                                      |
| trigger | `aria-expanded`       | `"true"` \| `"false"`                           |
| panel   | `data-open`           | present when open                               |
| panel   | `data-closed`         | present when closed (also while animating out)  |
| panel   | `data-orientation`    | `vertical` \| `horizontal`                      |
| panel   | `data-disabled`       | present when the item is disabled               |
| panel   | `data-index`          | item index                                      |
| panel   | `data-starting-style` | present on the first frame of opening           |
| panel   | `data-ending-style`   | present while animating out                     |
| panel   | `hidden`              | present when closed; `"until-found"` if enabled |

| Part  | CSS variable               | Value                                                  |
| ----- | -------------------------- | ------------------------------------------------------ |
| panel | `--accordion-panel-height` | content height in px while animating; `auto` once open |
| panel | `--accordion-panel-width`  | content width, same rules                              |
