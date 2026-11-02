# Stems UI

Accessible UI for [Remix 3](https://remix.run). Aims for the full surface area of
[Base UI](https://base-ui.com), styled like [shadcn/ui](https://ui.shadcn.com).

Stems owns its whole API: headless primitives written the Remix 3 way (mixins, `Context`, bubbling
events, native-first markup), with Remix's own `@remix-run/ui` as the style reference.

> Status: all 37 Base UI components implemented (headless + styled), not published yet. See
> [PLAN.md](./PLAN.md) for what's left before 1.0.

## Packages

| Path                | What                                                                 |
| ------------------- | -------------------------------------------------------------------- |
| `packages/stems-ui` | Headless primitives (`stems-ui` on npm)                              |
| `packages/registry` | Styled components, distributed as a shadcn-compatible registry       |
| `apps/docs`         | Remix 3 docs and playground; serves the registry JSON at `/r/*.json` |

Coverage against Base UI is tracked in [`coverage.json`](./coverage.json); the evidence behind it is
in [`docs/audit.md`](./docs/audit.md).

The registry also includes a styled [Table](./docs/components/table.md) and a
[Data Table](./docs/components/data-table.md) powered by TanStack Table v9, without React.

## Using it

See [docs/installation.md](./docs/installation.md). In short, after a one-time setup:

```sh
npx shadcn add @stemsui/theme @stemsui/dropdown-menu
```

## Developing

Requires Node ≥ 24.3 and pnpm.

```sh
pnpm install
pnpm build          # stems-ui → dist, registry → apps/docs/public/r
pnpm dev            # docs app on http://localhost:44100
pnpm test           # remix test: browser + e2e (run from the repo root)
pnpm typecheck
```

See [CONVENTIONS.md](./CONVENTIONS.md) before adding a component.

## License

MIT
