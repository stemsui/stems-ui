# Installing Stems UI in a Remix 3 app

Verified on Nov 1, 2026 against a fresh `remix new` app (`remix@3.1.0`,
`shadcn@4.23.0`, `tailwindcss@4.3.3`).

Stems components are copied into your app with the shadcn CLI, like shadcn/ui. A Remix 3 app needs
five one-time setup steps first, because Remix serves unbundled TypeScript to the browser and Node
needs real file extensions.

## 1. Add an `#app/*` import alias

shadcn components import shared files through aliases. Remix has no bundler alias support, but Node
[subpath imports](https://nodejs.org/api/packages.html#subpath-imports) work on the server **and**
in Remix's asset server. Add to `package.json`:

```json
{
  "imports": {
    "#app/*": "./app/*"
  }
}
```

## 2. Remove `rewriteRelativeImportExtensions` from `tsconfig.json`

The starter enables it, but it only matters when TypeScript emits files, and Remix apps use
`noEmit`. With it enabled, TypeScript rejects `#app/....ts` imports (TS2877).

```diff
-    "rewriteRelativeImportExtensions": true,
```

## 3. Let the asset server serve components and their packages

In `app/assets.ts`:

```ts
allowFiles: ['app/routes.ts', 'app/**/public/**', 'app/ui/**', 'app/lib/**'],
allowPackages: ['remix', 'stems-ui', 'cn'],
```

If you install Data Table, also allow `@tanstack/table-core` and define `process.env.NODE_ENV` for browser compilation.
See [Data Table](/components/data-table#usage) for the configuration.

## 4. Set up Tailwind CSS v4

```sh
npm i -D tailwindcss @tailwindcss/cli
```

`app/styles/app.css`:

```css
@import 'tailwindcss';
```

Build it to `public/styles.css` (add `--watch` in development, e.g. alongside `npm run dev`):

```sh
npx tailwindcss -i app/styles/app.css -o public/styles.css
```

and link it in your document `<head>`:

```tsx
<link rel="stylesheet" href="/styles.css" />
```

## 5. Add `components.json`

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "base-vega",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "app/styles/app.css",
    "baseColor": "neutral",
    "cssVariables": true
  },
  "aliases": {
    "components": "#app/ui",
    "ui": "#app/ui",
    "utils": "#app/lib/utils",
    "lib": "#app/lib",
    "hooks": "#app/hooks"
  },
  "registries": {
    "@stemsui": "https://stemsui.com/r/{name}.json"
  }
}
```

To try unreleased components from a local checkout, run the docs app (`pnpm dev` in this repo)
and point `@stemsui` at `http://localhost:44100/r/{name}.json` instead.

## Add components

```sh
npx shadcn add @stemsui/theme @stemsui/dropdown-menu
```

This writes `app/ui/dropdown-menu.tsx` and `app/lib/utils.ts` and installs `stems-ui` and `cn`.
The `utils.ts` file re-exports `cn`, which joins class names and removes conflicting Tailwind classes.
The command also merges the theme variables into `app/styles/app.css`. The `theme`
item also installs `tw-animate-css` and `shadcn` and adds `@import "tw-animate-css"` and
`@import "shadcn/tailwind.css"`, the same imports `shadcn init` adds, so shadcn's animation and
`data-*` variant classes work. shadcn rewrites
imports to your aliases **and keeps the `.ts`/`.tsx` extensions** Remix needs, e.g.
`import { cn } from '#app/lib/utils.ts'`.

## Use them

Interactive components must render inside a `clientEntry(...)` boundary:

```tsx
import { clientEntry, type Handle } from 'remix/component'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  onMenuSelect,
} from '#app/ui/dropdown-menu.tsx'

export const ActionsMenu = clientEntry(import.meta.url, function ActionsMenu(_handle: Handle) {
  return () => (
    <div mix={onMenuSelect((event) => console.log(event.value))}>
      <DropdownMenu>
        <DropdownMenuTrigger>Open</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem value="edit">Edit</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
})
```

## Possible future simplification

Steps 1–5 could become a single `npx shadcn add @stemsui/init` item (shadcn items can ship
`package.json`-adjacent files and CSS), or a `remix doctor`-style check. Tracked in PLAN.md.
