# Theming

Stems' styled components use [shadcn/ui](https://ui.shadcn.com/docs/theming)'s theme tokens, so
any shadcn theme works with them. This guide covers where the tokens come from, how to swap them,
dark mode, radius, and how component state reaches your styles through data attributes.

## Theme tokens

`npx shadcn add @stemsui/theme` merges the theme into your Tailwind CSS file
(`app/styles/app.css`). In this repo the source of truth is
`packages/registry/src/styles/theme.css`; the registry build turns it into the `theme` item.

The theme has three parts:

1. **Variables on `:root` and `.dark`.** Plain CSS custom properties holding colors (in `oklch`)
   and the base radius:

   ```css
   :root {
     --radius: 0.625rem;
     --background: oklch(1 0 0);
     --foreground: oklch(0.145 0 0);
     --primary: oklch(0.205 0 0);
     --primary-foreground: oklch(0.985 0 0);
     /* …card, popover, secondary, muted, accent, destructive, border, input, ring */
   }

   .dark {
     --background: oklch(0.145 0 0);
     --foreground: oklch(0.985 0 0);
     /* … */
   }
   ```

2. **An `@theme inline` block** that maps them to Tailwind utilities, so
   `--color-primary: var(--primary)` gives you `bg-primary`, `text-primary`, `border-primary`,
   `ring-primary/50`, and so on. Components only use these semantic names (`bg-popover`,
   `text-muted-foreground`, `border-input`), never raw colors.

3. **A small base layer:** borders default to `border-border`, outlines to `outline-ring/50`, and
   `body` gets `bg-background text-foreground`. The theme item also adds
   `@import "tw-animate-css"` and `@import "shadcn/tailwind.css"` for the enter/exit animation
   classes and the `data-*` variants described below.

Colors come in pairs: a surface (`--popover`) and the text that sits on it
(`--popover-foreground`). If you add your own token, add both and map both in `@theme inline`:

```css
:root {
  --success: oklch(0.6 0.15 150);
  --success-foreground: oklch(0.98 0 0);
}
.dark {
  --success: oklch(0.7 0.15 150);
  --success-foreground: oklch(0.15 0 0);
}
@theme inline {
  --color-success: var(--success);
  --color-success-foreground: var(--success-foreground);
}
```

## Using another shadcn theme

Because the variable names are shadcn's, a theme from [tweakcn](https://tweakcn.com), the
[shadcn themes page](https://ui.shadcn.com/themes), or another shadcn project drops in as is:

1. Copy the theme's CSS.
2. In `app/styles/app.css`, replace the `:root { … }` and `.dark { … }` blocks with the theme's.
3. Keep the `@theme inline` block. If the new theme defines tokens it doesn't map yet and you want
   utilities for them (`--chart-1` → `bg-chart-1`, `--font-sans` → `font-sans`), add a line per
   token: `--color-chart-1: var(--chart-1);`, `--font-sans: var(--font-sans);`.
4. Rebuild your CSS (`npx tailwindcss -i app/styles/app.css -o public/styles.css`).

Tokens the components don't use (charts, sidebar) are harmless to keep.

## Dark mode

The theme declares Tailwind's `dark` variant as "inside an element with the `dark` class":

```css
@custom-variant dark (&:is(.dark *));
```

Put `class="dark"` on `<html>` and both the `.dark` variables and every `dark:` utility apply.
To set it before the first paint (no flash of the light theme), add an inline script to the
`<head>` of your document component, before the stylesheet. It uses a saved choice when there is
one and follows the OS setting otherwise:

```tsx
import { unsafeHTML, type Handle, type RemixNode } from 'remix/component'

const themeScript = `(() => {
  try {
    let saved = localStorage.getItem('theme')
    let dark = saved ? saved === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches
    document.documentElement.classList.toggle('dark', dark)
  } catch {}
})()`

export function Document(handle: Handle<{ children?: RemixNode }>) {
  return () => (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="color-scheme" content="light dark" />
        <script innerHTML={unsafeHTML(themeScript)} />
        <link rel="stylesheet" href="/styles.css" />
        {/* … import map and entry script */}
      </head>
      <body>{handle.props.children}</body>
    </html>
  )
}
```

`innerHTML` only accepts values created with `unsafeHTML(...)`. That's fine here because the script
is a constant in your code.

A toggle is a small client entry that flips the class and stores the choice:

```tsx
import { clientEntry, on, type Handle } from 'remix/component'

export const ThemeToggle = clientEntry(import.meta.url, function ThemeToggle(handle: Handle) {
  return () => (
    <button
      type="button"
      aria-label="Toggle dark mode"
      mix={on('click', () => {
        let dark = document.documentElement.classList.toggle('dark')
        localStorage.setItem('theme', dark ? 'dark' : 'light')
      })}
    >
      <span class="dark:hidden">Dark</span>
      <span class="hidden dark:inline">Light</span>
    </button>
  )
})
```

Pick the icon or label with `dark:` classes rather than reading the theme during render. The
server doesn't know the theme, so state read in render would differ between the server HTML and
the browser.

To also theme native form controls and scrollbars, set `color-scheme` from the same class:

```css
@layer base {
  :root {
    color-scheme: light;
  }
  .dark {
    color-scheme: dark;
  }
}
```

## Radius

Everything rounds from one variable. `@theme inline` derives the scale from it:

| Utility      | Value                       |
| ------------ | --------------------------- |
| `rounded-sm` | `calc(var(--radius) - 4px)` |
| `rounded-md` | `calc(var(--radius) - 2px)` |
| `rounded-lg` | `var(--radius)`             |
| `rounded-xl` | `calc(var(--radius) + 4px)` |

Set `--radius: 0` on `:root` for square corners, or `1rem` for a softer look. You can also set it
on any element to change the radius of just that subtree.

## Styling state with data attributes

The headless layer (`stems-ui`) reports component state as **data attributes** on the elements it
manages. The names follow [Base UI](https://base-ui.com)'s documented attributes, so shadcn's Base UI
styles work unchanged. Boolean attributes are present (with an empty value) or absent, and they are
already correct in the server-rendered HTML.

Tailwind v4 turns any `data-*` attribute into a variant, and `shadcn/tailwind.css` adds a few
named ones. Some common ones:

| Variant                             | Matches                            | Set on (examples)                           |
| ----------------------------------- | ---------------------------------- | ------------------------------------------- |
| `data-open:` / `data-closed:`       | popup or panel state               | popover, menu, dialog, accordion            |
| `data-popup-open:`                  | the trigger of an open popup       | popover, menu, select triggers              |
| `data-highlighted:`                 | the item with keyboard/hover focus | menu, select, combobox items                |
| `data-checked:` / `data-unchecked:` | checked state                      | checkbox, switch, radio, menu items         |
| `data-active:`                      | the active item                    | tabs, navigation menu                       |
| `data-pressed:`                     | pressed state                      | toggle button                               |
| `data-disabled:`                    | disabled parts                     | every interactive part                      |
| `data-invalid:`                     | failed validation                  | field, inputs                               |
| `data-starting-style:`              | first frame of an enter animation  | popups, dialogs, toasts                     |
| `data-ending-style:`                | while an exit animation runs       | popups, dialogs, toasts                     |
| `data-[side=bottom]:`               | attributes with values             | anchored popups (`data-side`, `data-align`) |
| `data-[orientation=vertical]:`      | attributes with values             | tabs, slider, toolbar, separator            |

Each component page lists every attribute and CSS variable in its **Styling hooks** section.

Combine them with Tailwind's usual modifiers. Here a menu item highlights on keyboard focus and
dims when disabled, and a popup animates in and out:

```tsx
<div
  class="rounded-md px-2 py-1.5 data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50"
  mix={menu.item({ value: 'rename' })}
>
  Rename
</div>

<div
  class="origin-(--transform-origin) transition-[opacity,scale] duration-150 data-starting-style:scale-95 data-starting-style:opacity-0 data-ending-style:scale-95 data-ending-style:opacity-0"
  mix={popover.popup({ side: 'bottom' })}
>
  …
</div>
```

To style a child from its parent's state, mark the parent as a named group and use
`group-data-*`:

```tsx
<span class="group/switch …" mix={switch_.root()}>
  <span class="translate-x-0 group-data-checked/switch:translate-x-4" mix={switch_.thumb()} />
</span>
```

ARIA attributes work the same way when they carry the state you need: `aria-expanded:`,
`aria-invalid:`, `aria-disabled:`.

### CSS variables

Some parts also expose measurements as CSS variables (again Base UI's names), for example
`--anchor-width` and `--transform-origin` on anchored popups, `--active-tab-left` and
`--active-tab-width` on the tabs indicator, and `--accordion-panel-height` on accordion panels. Use
them in arbitrary values: `w-(--anchor-width)`, `origin-(--transform-origin)`,
`translate-x-(--active-tab-left)`.

### Changing a component's look

The registry copies component source into your app (`app/ui/*.tsx`), so the most direct way to
restyle a component is to edit its classes. To adjust one instance, pass `class`: it's merged with
`cn()` (`tailwind-merge`), so your classes replace conflicting defaults:

```tsx
<Button class="rounded-full px-6">Save</Button>
```

Every part also has a `data-slot` attribute (`data-slot="dropdown-menu-item"`), which you can
target from CSS or a parent: `[&_[data-slot=dropdown-menu-item]]:py-2`.
