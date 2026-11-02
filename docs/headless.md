# Headless usage

The styled registry components are thin wrappers. All the behavior (ARIA, keyboard, focus, state,
form participation, positioning) lives in `stems-ui`, which you can use directly with your own
markup and any styling approach: Tailwind, plain CSS, or Remix's `css()`.

## Install

```sh
npm i stems-ui
```

> `stems-ui` is not published to npm yet. Until it is, use it from this repository as a workspace
> package.

Remix serves unbundled modules to the browser, so let the asset server serve the package. In
`app/assets.ts`:

```ts
allowPackages: ['remix', 'stems-ui'],
```

## Modules, Context, and mixins

Each widget is a subpath module, imported as a namespace:

```tsx
import * as tabs from 'stems-ui/tabs'
import * as popover from 'stems-ui/popover'
```

A module exports two kinds of things:

- **`Context`**, a provider component that owns the widget's shared state and takes the root
  options (`value`, `defaultValue`, `onValueChange`, `orientation`, …). It renders no element of
  its own.
- **Mixins**, one per part, named after [Base UI](https://base-ui.com)'s parts: `tabs.root()`,
  `tabs.list()`, `tabs.tab({ value })`, `tabs.panel({ value })`. A mixin adds attributes, event
  listeners, and refs to the element you put it on.

You write the elements and attach behavior with the `mix` prop:

```tsx
<tabs.Context defaultValue="account">
  <div mix={tabs.root()}>
    <div mix={tabs.list()}>
      <button mix={tabs.tab({ value: 'account' })}>Account</button>
      <button mix={tabs.tab({ value: 'password' })}>Password</button>
    </div>
    <div mix={tabs.panel({ value: 'account' })}>…</div>
    <div mix={tabs.panel({ value: 'password' })}>…</div>
  </div>
</tabs.Context>
```

`mix` takes a single mixin or an array, so behavior and styles compose on one element:

```tsx
<button mix={[tabCss, tabs.tab({ value: 'account' }), on('focus', track)]}>Account</button>
```

Mixins are applied in order. Props you write on the element win over the attributes a mixin sets
(`<button mix={tabs.tab(…)} type="submit">` keeps `type="submit"`), so don't override ids or ARIA
attributes the mixin links together unless the module's README says you can.

Every option is optional where Base UI's is: `tabs.root()` and `popover.trigger()` take no
arguments.

## Controlled and uncontrolled state

Every stateful value can be owned by the `Context` (uncontrolled) or by you (controlled). Names
follow Base UI: `value` / `defaultValue` / `onValueChange`, `open` / `defaultOpen` /
`onOpenChange`, `checked` / `defaultChecked` / `onCheckedChange`, `pressed` / `defaultPressed` /
`onPressedChange`.

```tsx
// Uncontrolled: the Context keeps the state.
;<popover.Context defaultOpen={false}>…</popover.Context>

// Controlled: you keep it, and re-render when it changes.
function Filters(handle: Handle) {
  let open = false
  return () => (
    <popover.Context
      open={open}
      onOpenChange={(next) => {
        open = next
        void handle.update()
      }}
    >
      …
    </popover.Context>
  )
}
```

A value is controlled whenever its controlled option is not `undefined`. Callbacks receive the
next value first, then details (the event, and a `reason` such as `'escape-key'` or
`'outside-press'` for popups).

## Events

Every change also dispatches a **bubbling DOM event** named `stems:<widget>-<change>`
(`stems:tabs-change`, `stems:popover-change`, `stems:menu-select`). Each module exports the event
class and a typed listener mixin, so an ancestor can react without threading callbacks through
props:

```tsx
import { onTabsChange } from 'stems-ui/tabs'

;<section mix={onTabsChange((event) => console.log(event.value, event.previousValue))}>
  <tabs.Context defaultValue="a">…</tabs.Context>
</section>
```

The README of each module lists its events and their fields (see the **API reference** on each
component page).

## Reading state in your own parts

`Context` values are readable from any component inside the provider:

```tsx
function ActiveLabel(handle: Handle) {
  let state = handle.context.get(tabs.Context)
  return () => <p>Showing {state.value}</p>
}
```

Use this for things a mixin can't do, such as not rendering inactive panel content (the styled
`TabsContent` does exactly that for Base UI's `keepMounted`).

## Client entries

Mixins attach event listeners only in the browser, so interactive widgets must render inside a
`clientEntry(...)` boundary, directly or through an ancestor:

```tsx
import { clientEntry, type Handle } from 'remix/component'

export const SettingsTabs = clientEntry(import.meta.url, function SettingsTabs(handle: Handle) {
  return () => <tabs.Context defaultValue="account">…</tabs.Context>
})
```

- Put the boundary around the smallest piece that needs the browser. The rest of the page stays
  server-only HTML.
- Props passed to a client entry from the server are serialized. Pass data (strings, numbers,
  plain objects), not callbacks: keep `onValueChange` handlers and state inside the entry.
- The module must be servable by the asset server (in the starter, anything under
  `app/**/public/**` is).

## Server rendering

- State attributes are correct in the server-rendered HTML: the active tab has `aria-selected`
  and `data-active`, inactive panels are `hidden`, closed popups are `hidden` with `data-closed`,
  checkboxes have `data-checked` and their hidden form `<input>`. Styles that depend on them work
  before hydration.
- Ids that link parts (`aria-controls`, `aria-labelledby`) are generated during render, so they
  match on the server and the client.
- Without a `defaultValue`, widgets that pick a default (tabs pick the first enabled tab) choose
  in render order, so render the list before the panels.
- Anything that needs layout, such as popup positioning, the tabs indicator's CSS variables, or
  measured panel heights, is computed in the browser after hydration. Measured parts start
  `hidden` where a wrong first frame would show.
- Popups use the platform's top layer (`popover="manual"`, `<dialog>`), so there are no portals.
  Render a popup next to its trigger; it escapes `overflow` and `z-index` on its own.

## Example: tabs styled with `css()`

A complete client entry: controlled tabs with automatic activation and a sliding indicator,
styled with plain CSS through `css()` from `remix/component`. State reaches the styles through data
attributes (`[data-active]`, `[data-disabled]`) and CSS variables (`--active-tab-left`,
`--active-tab-width`).

```tsx
import { clientEntry, css, type Handle } from 'remix/component'
import * as tabs from 'stems-ui/tabs'

const sections = [
  { value: 'account', label: 'Account', body: 'Name, email, and avatar.' },
  { value: 'security', label: 'Security', body: 'Password and two-factor authentication.' },
  { value: 'billing', label: 'Billing', body: 'Plans and invoices.', disabled: true },
]

export const SettingsTabs = clientEntry(
  import.meta.url,
  function SettingsTabs(handle: Handle<{ initial?: string }>) {
    // Controlled: this component owns the value and re-renders when it changes.
    let value = handle.props.initial ?? 'account'

    return () => (
      <tabs.Context
        value={value}
        onValueChange={(next) => {
          value = next ?? 'account'
          void handle.update()
        }}
      >
        <div mix={[rootCss, tabs.root()]}>
          <div mix={[listCss, tabs.list({ activateOnFocus: true })]}>
            {sections.map((section) => (
              <button
                key={section.value}
                mix={[tabCss, tabs.tab({ value: section.value, disabled: section.disabled })]}
              >
                {section.label}
              </button>
            ))}
            <span mix={[indicatorCss, tabs.indicator()]} />
          </div>
          {sections.map((section) => (
            <div key={section.value} mix={[panelCss, tabs.panel({ value: section.value })]}>
              {section.body}
            </div>
          ))}
        </div>
      </tabs.Context>
    )
  },
)

const rootCss = css({ display: 'grid', gap: '1rem', maxWidth: '28rem' })

const listCss = css({
  position: 'relative',
  display: 'flex',
  gap: '0.25rem',
  borderBottom: '1px solid #e4e4e7',
})

const tabCss = css({
  appearance: 'none',
  border: 0,
  background: 'transparent',
  padding: '0.5rem 0.75rem',
  font: 'inherit',
  color: '#71717a',
  cursor: 'pointer',
  '&[data-active]': { color: '#09090b' },
  '&[data-disabled]': { opacity: 0.5, cursor: 'not-allowed' },
  '&:focus-visible': { outline: '2px solid #2563eb', outlineOffset: '-2px' },
})

const indicatorCss = css({
  position: 'absolute',
  bottom: '-1px',
  left: 0,
  height: '2px',
  width: 'var(--active-tab-width)',
  translate: 'var(--active-tab-left) 0',
  background: '#09090b',
  transition: 'translate 200ms ease, width 200ms ease',
})

const panelCss = css({
  color: '#3f3f46',
  '&:focus-visible': { outline: '2px solid #2563eb', outlineOffset: '2px' },
})
```

Render it from any server component, for example `<SettingsTabs initial="security" />`. The
server HTML already shows the Security panel; arrow keys, the indicator, and `onValueChange` start
working once the entry hydrates.

`css()` rules go into the `rmx` cascade layer and are inlined into the server-rendered `<head>`, so
there's no flash of unstyled content. The same markup works with Tailwind classes instead: replace
each `mix={[someCss, …]}` with a `class` using variants such as `data-active:text-foreground`. See
[Theming](./theming.md#styling-state-with-data-attributes).
