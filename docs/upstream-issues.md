# Upstream issues (Remix 3.1)

Bugs and rough edges in Remix found while building Stems, with minimal reproductions, so they can be
reported to `remix-run/remix`. Each lists the Stems workaround.

## 1. Nodes added to a component's array output are appended after the parent's later siblings

**Version:** `remix@3.1.0` (`@remix-run/component@1.1.0`). **Confirmed** with the test below
(Nov 1, 2026): the first case passes, the second fails.

When a child component **returns an array** and that array grows on a re-render, the new DOM nodes
are appended at the end of the shared parent instead of after the component's existing nodes. An
array mapped directly in the owner's JSX is fine.

```tsx
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import type { Handle } from 'remix/component'
import { render } from 'remix/component/test'

it('keeps order when a child component returns a growing array', async (t) => {
  let items = ['a']
  let owner: Handle | undefined
  function Chips(handle: Handle<{ items: string[] }>) {
    return () => handle.props.items.map((item) => <span key={item}>{item}</span>)
  }
  function App(handle: Handle) {
    owner = handle
    return () => (
      <div id="root">
        <Chips items={items} />
        <input />
      </div>
    )
  }
  let { $, act, cleanup } = render(<App />)
  t.after(cleanup)
  items = ['a', 'b']
  await act(() => owner!.update())
  let order = [...$('#root')!.childNodes].map((n) => (n as Element).tagName + ':' + n.textContent)
  // Actual: ['SPAN:a', 'INPUT:', 'SPAN:b']
  assert.deepEqual(order, ['SPAN:a', 'SPAN:b', 'INPUT:'])
})
```

**Workaround in Stems:** `fixChipOrder()` in `packages/stems-ui/src/lib/combobox-core.ts` moves
chips back before the input after each render. Apps can avoid it by wrapping array output in an
element.

## 2. Mixins called without arguments receive the host props as their first argument

`createMixin` runners are called as `(...args, props)`, so `foo()` puts the props in the
options slot. Not a bug per se, but easy to get wrong (`@remix-run/ui`'s own `toggle()` would
crash on a no-argument call). **Workaround:** `splitOptions` in `src/lib/collapsible-panel.ts`.

## 3. Boolean `aria-*` values render differently on the server and the client

The server renderer writes `true` as a bare attribute and drops `false`; the client writes
`"true"`/`"false"`. **Workaround:** always pass aria values as strings.

## 4. A mixin's own `handle.update()` can re-render with stale arguments

After the owning component re-rendered, `handle.update()` from inside a mixin re-ran it with the
previous arguments/props (reverted a controlled input value). Reproduced by one agent, not by
another; worth a minimal repro before reporting. **Workaround:** re-render through the Context
provider's handle.

## 5. `attrs({ value: undefined })` clears inputs

`attrs()` copies keys whose value is `undefined`, and an explicit `value: undefined` makes the
reconciler clear the input's value, which wipes uncontrolled defaults. **Workaround:** only add the
key when it's defined.

## 6. Server-rendered `<style>` tags have no CSP nonce

Blocks a real CSP Provider (see `docs/audit.md`). No workaround yet.

## 7. `remix test` browser harness must live under the cwd

With pnpm the harness files are in the repo-root store, so package-level `remix test` fails with
"Harness scripts … are outside rootDir". **Workaround:** run tests from the repo root.

## 8. `remix test` browser iframes drift below the fold, which stalls WebKit

`remix test` runs each browser test file in an iframe appended to the runner page, under a
results list that grows as files finish. Finished iframes are hidden, but later ones end up
below the viewport. WebKit pauses `requestAnimationFrame` in offscreen iframes, so any test that
waits for a frame stalls until the runner's 90s "no progress" timeout (in our suite, the 22nd
file). Chromium and Firefox don't throttle same-origin iframes this way. **Workaround:** a very
tall `viewport` in `playwright.cross.config.ts`. A fix upstream could keep the active iframe
in view (e.g. `position: fixed`).
