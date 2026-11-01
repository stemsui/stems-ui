# avatar

`avatar` shows a user's image, with a fallback (initials or an icon) while the image is missing,
loading, or broken.

Base UI equivalent: [Avatar](https://base-ui.com/react/components/avatar).

## Usage

```tsx
import * as avatar from 'stems-ui/avatar'

function UserAvatar() {
  return () => (
    <avatar.Context>
      <span class="avatar" mix={avatar.root()}>
        <img src="/ada.png" alt="Ada Lovelace" mix={avatar.image()} />
        <span mix={avatar.fallback({ delay: 600 })}>AL</span>
      </span>
    </avatar.Context>
  )
}
```

## `stems-ui/avatar`

- `<avatar.Context>`: owns the image loading status shared by the parts. No props besides
  `children`.
- `avatar.root()`: the root element. Adds no attributes; it mirrors Base UI's anatomy.
- `avatar.image(options?)`: put on an `<img>`. Reads `src` from the host.
  - `onLoadingStatusChange(status)`: called with `'loading'`, then `'loaded'` or `'error'`
    (`'idle'` when `src` is removed).
  - `keepMounted`: keep the image visible while it loads in place, instead of hiding it until a
    preload finishes. Use with `loading="lazy"` and stack the image over the fallback; hide it with
    `data-loading` / `data-error` (prefer `visibility` over `display: none`, which would stop lazy
    loading). Defaults to `false`.
- `avatar.fallback(options?)`
  - `delay`: milliseconds to wait before showing the fallback. Defaults to `0`.
- Types: `ImageLoadingStatus = 'idle' | 'loading' | 'loaded' | 'error'`.

## Behavior notes

- Mixins can't add or remove their host, so the image stays in the DOM. By default it is `hidden`
  until a `new Image()` preload of `src` succeeds (Base UI only renders it then). While not loaded
  it also has `aria-hidden="true"`, so the fallback names the avatar.
- The fallback is `hidden` once the image has loaded, and before its `delay` has passed.
- Server rendering: an image with `src` renders `hidden` with `data-loading`, and the fallback
  renders visible (or hidden, with a `delay`), so there is no flash of a broken or half-loaded
  image. Loading starts after hydration.
- Changing `src` restarts loading.
- `image()` and `fallback()` also work without `<avatar.Context>`, but then the fallback can't see
  the image status and only honors its `delay`.
- The `hidden` attribute needs a stylesheet that doesn't override it (Tailwind's preflight makes
  `[hidden]` `display: none !important`).

## Styling hooks

| Part       | Attribute      | Values                                                |
| ---------- | -------------- | ----------------------------------------------------- |
| `image`    | `data-loading` | Present while the image is loading.                   |
| `image`    | `data-error`   | Present when the image failed to load.                |
| `image`    | `hidden`       | Present until loaded (not `keepMounted`).             |
| `fallback` | `hidden`       | Present when the image has loaded, or during `delay`. |

Base UI's `data-starting-style` / `data-ending-style` on the image are not implemented yet.
