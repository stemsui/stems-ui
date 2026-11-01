# tabs

`stems-ui/tabs` wires app-owned markup into an accessible tab list with tab panels: roving focus,
manual or automatic activation, orientation, RTL, and an optional indicator that tracks the active
tab through CSS variables.

Base UI equivalent: [Tabs](https://base-ui.com/react/components/tabs).

## Usage

```tsx
import * as tabs from 'stems-ui/tabs'

function Settings() {
  return () => (
    <tabs.Context defaultValue="account">
      <div mix={tabs.root()}>
        <div class="relative flex gap-1" mix={tabs.list()}>
          <button mix={tabs.tab({ value: 'account' })}>Account</button>
          <button mix={tabs.tab({ value: 'password' })}>Password</button>
          <button mix={tabs.tab({ value: 'billing', disabled: true })}>Billing</button>
          <span
            class="absolute bottom-0 left-0 h-0.5 w-(--active-tab-width) translate-x-(--active-tab-left) bg-current transition-[translate,width]"
            mix={tabs.indicator()}
          />
        </div>
        <div mix={tabs.panel({ value: 'account' })}>Account settings</div>
        <div mix={tabs.panel({ value: 'password' })}>Password settings</div>
        <div mix={tabs.panel({ value: 'billing' })}>Billing settings</div>
      </div>
    </tabs.Context>
  )
}
```

Listen for changes with the callback or the bubbling event:

```tsx
import { onTabsChange } from 'stems-ui/tabs'

;<section mix={onTabsChange((event) => console.log(event.value, event.activationDirection))}>
  ...
</section>
```

## `stems-ui/tabs`

- `Context`: provider that owns the tabs state.
  - `value`: `string | null`. The active tab (controlled). `null` means no tab is active. Tabs are
    controlled whenever `value` is not `undefined`.
  - `defaultValue`: `string | null`. The initially active tab (uncontrolled). When omitted, the first
    enabled tab becomes active. `null` starts with no active tab.
  - `onValueChange(value, event)`: called when the user activates a different tab. `event` is the
    `TabsChangeEvent` that was dispatched.
  - `orientation`: `'horizontal' | 'vertical'`. Defaults to `'horizontal'`.
- `root()`: the element that groups the list and panels. Sets state attributes only.
- `list(options?)`: `role="tablist"`, `aria-orientation` (vertical only), and keyboard navigation.
  - `activateOnFocus`: activate tabs as arrow keys focus them. Defaults to `false` (manual
    activation: Enter, Space, or click).
  - `loopFocus`: wrap focus from the last tab to the first and back. Defaults to `true`.
- `tab({ value, disabled? })`: `role="tab"`, `aria-selected`, `aria-controls`, roving `tabindex`, and
  `type="button"` on `<button>` hosts. Disabled tabs get native `disabled` on `<button>` hosts and
  `aria-disabled="true"` on other hosts.
- `indicator()`: a decorative element (`role="presentation"`) placed inside the list. It is `hidden`
  until the active tab has been measured in the browser, and while no tab is active.
- `panel({ value })`: `role="tabpanel"`, `aria-labelledby`, and `tabindex="0"` while active. Inactive
  panels are `hidden` and `inert`.
- `TabsChangeEvent`: `stems:tabs-change`, dispatched (bubbling) from the activated tab. Fields:
  `value`, `previousValue`, `activationDirection`.
- `onTabsChange(handler)`: typed listener for `stems:tabs-change`.
- `TabsContextValue`: read it in a component with `handle.context.get(tabs.Context)`. It exposes
  `value`, `orientation`, `activationDirection`, `isActive(value)`, `getTabId(value)`,
  `getPanelId(value)`, and `activate(value)`.

## Behavior notes

| Key                    | Action                                                                         |
| ---------------------- | ------------------------------------------------------------------------------ |
| ArrowRight / ArrowLeft | Horizontal: focus the next / previous enabled tab (mirrored with `dir="rtl"`). |
| ArrowDown / ArrowUp    | Vertical: focus the next / previous enabled tab.                               |
| Home / End             | Focus the first / last enabled tab.                                            |
| Enter / Space          | Activate the focused tab.                                                      |

- Arrow keys only move focus unless `activateOnFocus` is set. Disabled tabs are skipped.
- The active tab is the only tab in the page tab sequence (`tabindex="0"`). When no tab is active,
  the first enabled tab is.
- Text direction is read from the nearest `dir` attribute (or computed `direction`) when the key is
  pressed, so it can change at runtime.
- Server-rendered HTML already has the correct active tab, panel visibility, ids, and data
  attributes. Without a `value` or `defaultValue`, the first enabled tab is chosen in render order,
  so render the list before the panels.
- Panels stay in the DOM (hidden and `inert`): a mixin can't remove its host. Base UI's `keepMounted`
  is implemented by the styled `TabsContent` component, which drops inactive children unless
  `keepMounted` is set. Do the same in your own components with `handle.context.get(tabs.Context)`.
- Explicit host props win over the mixins' defaults. Don't override `id` on tabs or panels: the
  generated ids link them through `aria-controls` / `aria-labelledby`.
- `onValueChange` only fires for user activation (and `activate()`), never for the implicit initial
  pick.
- Tab values are strings.

## Styling hooks

| Part      | Attribute                   | Values                                         |
| --------- | --------------------------- | ---------------------------------------------- |
| all parts | `data-orientation`          | `horizontal` \| `vertical`                     |
| all parts | `data-activation-direction` | `left` \| `right` \| `up` \| `down` \| `none`  |
| tab       | `data-active`               | Present when the tab is active.                |
| tab       | `data-disabled`             | Present when the tab is disabled.              |
| panel     | `data-hidden`               | Present when the panel is hidden.              |
| panel     | `data-index`                | The panel's index.                             |
| indicator | `hidden`                    | Present until measured, or with no active tab. |

`data-activation-direction` compares the newly active tab's position to the previous one, and is
`none` until the first change.

Indicator CSS variables (in `px`, relative to the list's padding box):

| Variable              | Description                                      |
| --------------------- | ------------------------------------------------ |
| `--active-tab-left`   | Distance from the list's left edge to the tab.   |
| `--active-tab-right`  | Distance from the tab to the list's right edge.  |
| `--active-tab-top`    | Distance from the list's top edge to the tab.    |
| `--active-tab-bottom` | Distance from the tab to the list's bottom edge. |
| `--active-tab-width`  | Width of the active tab.                         |
| `--active-tab-height` | Height of the active tab.                        |

The variables update after the active tab changes and whenever the list or a tab resizes
(`ResizeObserver`).
