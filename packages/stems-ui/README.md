# stems-ui

Headless, accessible UI primitives for [Remix 3](https://remix.run), covering the full
[Base UI](https://base-ui.com) component set: accordion, dialog, menu, popover, select, combobox,
tabs, toast, tooltip, form fields, and more.

Each module is written the Remix 3 way: a `Context` provider for shared state plus mixins you apply
to your own markup, bubbling events for changes, native-first elements (`<dialog>`, the popover
API, real form inputs), and correct server-rendered HTML.

```sh
npm i stems-ui
```

```tsx
import { clientEntry, type Handle } from 'remix/component'
import * as tabs from 'stems-ui/tabs'

export const AccountTabs = clientEntry(import.meta.url, function AccountTabs(_handle: Handle) {
  return () => (
    <tabs.Context defaultValue="account">
      <div mix={tabs.root()}>
        <div aria-label="Settings" mix={tabs.list()}>
          <button mix={tabs.tab({ value: 'account' })}>Account</button>
          <button mix={tabs.tab({ value: 'password' })}>Password</button>
        </div>
        <div mix={tabs.panel({ value: 'account' })}>Account settings</div>
        <div mix={tabs.panel({ value: 'password' })}>Password settings</div>
      </div>
    </tabs.Context>
  )
})
```

Every module documents its API, keyboard behavior, and styling hooks (data attributes and CSS
variables) in `src/<module>/README.md`.

Prefer styled components? The [Stems UI registry](https://github.com/stemsui/stems-ui) provides
shadcn/ui-style components built on these primitives that you add with the shadcn CLI:
`npx shadcn add @stemsui/dialog`.

## License

MIT
