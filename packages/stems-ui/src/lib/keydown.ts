// Adapted from @remix-run/ui 0.13.0 (packages/ui/src/lib/keydown.ts).
// https://github.com/remix-run/remix - Copyright (c) 2025 Shopify Inc. MIT License.

import { createMixin, on } from '@remix-run/component'

export const onKeyDown = createMixin<
  HTMLElement,
  [key: string, handler: (event: KeyboardEvent) => void]
>(
  () => (key, handler) =>
    on('keydown', (event) => {
      if (event.key === key) {
        event.preventDefault()
        handler(event)
      }
    }),
  { ssr: false },
)
