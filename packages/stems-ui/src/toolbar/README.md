# toolbar

`toolbar` groups buttons, links, inputs, and other controls (toggle button groups, menus,
selects) into one `role="toolbar"` widget with a single roving tab stop and arrow-key navigation.
App code owns the markup and visual styles.

Base UI equivalent: [Toolbar](https://base-ui.com/react/components/toolbar).

## Usage

```tsx
import * as menu from 'stems-ui/menu'
import { toggleButton } from 'stems-ui/toggle-button'
import * as toggleButtonGroup from 'stems-ui/toggle-button-group'
import * as toolbar from 'stems-ui/toolbar'

function Formatting() {
  return () => (
    <toolbar.Context>
      <div aria-label="Formatting" mix={toolbar.root()}>
        <toggleButtonGroup.Context multiple>
          <div aria-label="Style" mix={toggleButtonGroup.root()}>
            <button mix={[toolbar.button(), toggleButton({ value: 'bold' })]}>B</button>
            <button mix={[toolbar.button(), toggleButton({ value: 'italic' })]}>I</button>
          </div>
        </toggleButtonGroup.Context>
        <div mix={toolbar.separator()} />
        <menu.Context>
          <button mix={[toolbar.button(), menu.trigger()]}>Insert</button>
          <div mix={menu.popup()}>
            <div mix={menu.item()}>Image</div>
          </div>
        </menu.Context>
        <toolbar.GroupContext disabled>
          <div aria-label="History" mix={toolbar.group()}>
            <button mix={toolbar.button()}>Undo</button>
          </div>
        </toolbar.GroupContext>
        <input aria-label="Find" mix={toolbar.input()} />
        <a href="/history" mix={toolbar.link()}>
          Edited 5m ago
        </a>
      </div>
    </toolbar.Context>
  )
}
```

### Putting other widgets in a toolbar

Base UI does this with `<Toolbar.Button render={<Menu.Trigger />} />`. In Stems, add a toolbar
mixin to the other widget's element, **first** in `mix` (mixin attributes are defaults, and the
first one wins, so the toolbar's `tabIndex` takes precedence):

- `toolbar.button(options)` for `<button>` elements: toggle buttons, and the triggers of menus,
  selects, popovers, dialogs. It adds the `stems-ui/button` behavior, so `disabled` set here keeps
  the element focusable (`aria-disabled`) and blocks its activation, as in Base UI: set
  `disabled` on the toolbar mixin rather than on the trigger.
- `toolbar.item(options)` for anything else (a non-button host, a number field input, a custom
  widget). It only adds the element to the roving focus; disable the composed widget itself too.

A `toggleButtonGroup.Context` inside a toolbar hands its roving focus to the toolbar, so its
buttons need a toolbar mixin like any other item.

## `stems-ui/toolbar`

- `Context`: owns the toolbar state. Props (Base UI `Toolbar.Root`):
  - `orientation`: `'horizontal'` (default; Left/Right, mirrored in RTL) or `'vertical'`
    (Up/Down).
  - `loopFocus`: wrap arrow-key focus at the ends. Defaults to `true`.
  - `disabled`: disable every item. Items stay focusable unless `focusableWhenDisabled: false`.
  - `handle.context.get(toolbar.Context)` returns `{ orientation, loopFocus, disabled }`.
- `GroupContext`: `disabled` for the items inside a group. Base UI's `Toolbar.Group` takes
  `disabled` itself; a mixin can't pass state to the elements inside it, so the prop lives on this
  provider (wrap the `group()` element in it).
- `root()`: `role="toolbar"`, `aria-orientation`, `data-orientation`, `data-disabled`, and the
  keyboard handling. Name it with `aria-label` or `aria-labelledby`.
- `button(options)`: a toolbar item with button behavior (`type="button"`, or `role="button"` and
  Enter/Space on other hosts). Options:
  - `disabled`: also set by the toolbar or the group.
  - `focusableWhenDisabled`: default `true`. A disabled button gets `aria-disabled` and stays in
    the arrow-key order; with `false` it gets the native `disabled` attribute and is skipped.
  - `nativeButton`: whether the host is a `<button>` (default: detected from the host).
- `link()`: a toolbar item for an `<a href>`. Links can't be disabled.
- `input(options)`: a toolbar item for a native `<input>`. `disabled`, `focusableWhenDisabled`
  (default `true`: `aria-disabled` + `readOnly`, so the input stays focusable but can't be edited;
  `false`: native `disabled`). Clicks and pointer presses are prevented while disabled.
- `item(options)`: adds any element to the roving focus. `disabled` (affects navigation only; the
  toolbar's and group's `disabled` apply) and `focusableWhenDisabled` (default `true`).
- `group()`: `role="group"`, `data-orientation`, `data-disabled`.
- `separator(options)`: `stems-ui/separator`, with `orientation` defaulting to the opposite of the
  toolbar's (a horizontal toolbar gets vertical separators). Not focusable.

Every mixin can be called without arguments.

## Behavior notes

- **Focus:** the items form one tab stop: the last focused item, or the first focusable one.
  Disabled items stay in the order unless `focusableWhenDisabled` is `false`; natively disabled
  elements (`:disabled`, e.g. a `disabled` toggle button composed with `toolbar.item()`) are
  always skipped.
- The keys are handled on `root()` in the bubble phase, only for key presses on an item that no
  other handler already used (`event.defaultPrevented`). A menu or select trigger keeps its own
  keys (ArrowDown opens it in a horizontal toolbar), and keys inside an open popup are ignored.
- **Inputs:** Left / Right (Up / Down when vertical) move the caret and only leave the input from
  its start or end; Shift (selecting), an existing selection, and Home / End keep the native
  behavior. An input reached with the arrow keys has its text selected. Base UI recommends at most
  one input, placed last, in a horizontal toolbar.
- **Home / End** move to the first / last item. Base UI's toolbar doesn't handle them; Stems
  follows the WAI-ARIA toolbar pattern here.
- Base UI's `render` prop has no Stems equivalent; compose mixins instead (see above).

| Key                        | Action                                             |
| -------------------------- | -------------------------------------------------- |
| `ArrowRight` / `ArrowLeft` | Next / previous item (horizontal; mirrored in RTL) |
| `ArrowDown` / `ArrowUp`    | Next / previous item (vertical)                    |
| `Home` / `End`             | First / last item (not inside an input)            |
| `Tab`                      | Leaves the toolbar                                 |

## Styling hooks

| Part      | Attribute          | Present when / value                                 |
| --------- | ------------------ | ---------------------------------------------------- |
| root      | `data-orientation` | `"horizontal"` or `"vertical"`                       |
| root      | `data-disabled`    | The toolbar is disabled                              |
| button    | `data-orientation` | The toolbar's orientation                            |
| button    | `data-disabled`    | The button, its group, or the toolbar is disabled    |
| button    | `data-focusable`   | `focusableWhenDisabled` is `true` (the default)      |
| input     | `data-orientation` | The toolbar's orientation                            |
| input     | `data-disabled`    | The input, its group, or the toolbar is disabled     |
| input     | `data-focusable`   | `focusableWhenDisabled` is `true` (the default)      |
| link      | `data-orientation` | The toolbar's orientation                            |
| item      | `data-orientation` | The toolbar's orientation                            |
| group     | `data-orientation` | The toolbar's orientation                            |
| group     | `data-disabled`    | The group or the toolbar is disabled                 |
| separator | `data-orientation` | `"vertical"` in a horizontal toolbar, and vice versa |
