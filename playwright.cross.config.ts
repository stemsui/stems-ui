import { defineConfig } from 'playwright/test'

// Cross-browser runs: `pnpm test:cross` (or `remix test --playwrightConfig ./playwright.cross.config.ts -p firefox`).
// The default config stays Chromium-only to keep everyday runs fast.
export default defineConfig({
  projects: [
    { name: 'firefox', use: { browserName: 'firefox' } },
    { name: 'webkit', use: { browserName: 'webkit' } },
  ],
})
