// Adapted from @remix-run/ui 0.13.0 (packages/ui/src/lib/flash-attribute.ts).
// https://github.com/remix-run/remix - Copyright (c) 2025 Shopify Inc. MIT License.

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })
}

export async function flashAttribute(node: HTMLElement, attributeName: string, duration: number) {
  node.setAttribute(attributeName, 'true')
  await wait(duration)
  node.removeAttribute(attributeName)
}
