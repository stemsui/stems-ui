# Contributing a component

This is the workflow every component follows (humans and agents alike). Read
[`CONVENTIONS.md`](./CONVENTIONS.md) first; it defines the API rules and lists the Remix runtime
pitfalls we've already hit.

## Before you start

1. Read the component's entry in `coverage.json` (phase, Remix reference, gaps to close, what it
   builds on) and the Base UI spec at `https://base-ui.com/react/components/<name>.md` (parts,
   props, data attributes, CSS variables).
2. Read a finished module of the same kind as a model:
   - simple control: `packages/stems-ui/src/switch.ts`, `button.ts`
   - composite with roving focus: `src/tabs.ts` (+ `src/lib/roving-focus.ts`)
   - anchored popup: `src/popover.ts` built on `src/lib/popup.ts` (read its doc comments)
   - modal: `src/dialog.ts` built on `src/lib/dialog-root.ts`
   - list with indicators: `src/lib/menu.tsx`
3. If `@remix-run/ui` has a reference implementation, read its tagged source with tests (MIT;
   port with the attribution header from CONVENTIONS.md). The npm package omits tests, so fetch
   the tag:
   `curl -sL https://codeload.github.com/remix-run/remix/tar.gz/refs/tags/ui@0.13.0 | tar xz --wildcards '*/packages/ui/*'`
4. shadcn styles to copy: `https://ui.shadcn.com/r/styles/base-vega/<item>.json`
   (`files[0].content`). The theme already includes `tw-animate-css` and `shadcn/tailwind.css`.

## What to deliver

| Piece               | Path                                                                                                                                                                                    |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Headless module     | `packages/stems-ui/src/<name>.ts(x)`                                                                                                                                                    |
| Browser tests       | `packages/stems-ui/src/<name>.test.browser.tsx`                                                                                                                                         |
| Server-render tests | `packages/stems-ui/src/<name>.test.ts(x)` (`renderToString` from `remix/component/server`)                                                                                              |
| README              | `packages/stems-ui/src/<name>/README.md`                                                                                                                                                |
| Styled component    | `packages/registry/src/ui/<item>.tsx` (behavior only from `stems-ui/*`, Remix from `remix/component`, utils via `#stems/lib/utils.ts`, other registry items via `#stems/ui/<item>.tsx`) |
| Docs demo           | `apps/docs/app/demos/public/<item>.tsx`, exporting `<PascalItem>Demo` as a `clientEntry` (a placeholder may already exist; keep its export name)                                        |

Tests must cover ARIA, keyboard, controlled and uncontrolled state, data attributes, events,
form participation where relevant, and calling every mixin with no arguments.

Shared files are integrated by the maintainer, not by component authors: any `package.json`,
`tsconfig`, `packages/registry/registry.json`, `apps/docs/app/demos/index.ts`, `coverage.json`,
`PLAN.md`, `CONVENTIONS.md`. Report what they need instead (see below).

## Verify

From the repo root:

```sh
# only your tests (avoid globs like `src/foo*` that match the `src/foo/` README folder)
./node_modules/.bin/remix test 'packages/stems-ui/src/<name>.test*'
pnpm --filter stems-ui typecheck
pnpm --filter @stemsui/registry typecheck
(cd apps/docs && npx tsc --noEmit)
./node_modules/.bin/prettier --write <your files>
```

Browser tests use real Chromium, but synthetic events don't trigger default actions. Check real
keyboard and pointer behavior and the visuals in the docs app:

```sh
(cd packages/stems-ui && npx tsc -p tsconfig.build.json)   # docs serve stems-ui from dist
pnpm --filter @stemsui/docs run css:build
(cd apps/docs && PORT=<your port> NODE_ENV=development node --import remix/node-tsx server.ts) &
# drive http://localhost:<port>/components/<item> with Playwright
# (a script outside the repo can import '<repo>/node_modules/playwright/index.mjs'),
# screenshot light and dark (add class "dark" to <html>), then stop the server.
```

The dev server can keep serving a stale server-rendered module after you edit a demo; restart it.

## Report

- API summary: parts, options, data attributes, CSS variables, events, change reasons.
- Files created or changed.
- The `registry.json` item(s) (`type: registry:ui`, `dependencies`, `registryDependencies`
  such as `@stemsui/utils` and any other registry items you import, `files`).
- The `apps/docs/app/demos/index.ts` entry (key, title, description, behavior modules, Demo).
- Test counts, typecheck status, what you verified in a real browser.
- `coverage.json` gaps you did not close, and concerns.
