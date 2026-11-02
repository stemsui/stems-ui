import { defineConfig } from 'playwright/test'

// Cross-browser runs: `pnpm test:cross` (or `remix test --playwrightConfig ./playwright.cross.config.ts -p firefox`).
// The default config stays Chromium-only to keep everyday runs fast.
//
// `remix test` runs each browser test file in an iframe below a results list that grows as files
// finish, so later iframes end up below the fold. WebKit pauses requestAnimationFrame in offscreen
// iframes, which stalls anything that waits for a frame (our presence/animation helpers). A very
// tall viewport keeps every test iframe on screen.
const tallViewport = { width: 1280, height: 20000 }

export default defineConfig({
  projects: [
    { name: 'firefox', use: { browserName: 'firefox', viewport: tallViewport } },
    { name: 'webkit', use: { browserName: 'webkit', viewport: tallViewport } },
  ],
})
