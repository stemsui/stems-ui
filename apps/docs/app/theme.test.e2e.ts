import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import { describe, it } from 'remix/test'

import { router } from './router.ts'
import { routes } from './routes.ts'

describe('docs theme', () => {
  for (let { name, colorScheme, saved, dark } of [
    { name: 'saved dark mode', colorScheme: 'light', saved: 'dark', dark: true },
    { name: 'system dark mode', colorScheme: 'dark', saved: null, dark: true },
    { name: 'saved light mode', colorScheme: 'dark', saved: 'light', dark: false },
  ] as const) {
    it(`preserves ${name} through navigation and reloads`, async (t) => {
      let page = await t.serve(await createTestServer(router.fetch))
      await page.emulateMedia({ colorScheme })
      await page.addInitScript((theme) => {
        if (theme === null) localStorage.removeItem('theme')
        else localStorage.setItem('theme', theme)
      }, saved)
      await page.goto(routes.home.href())
      // Wait for the entry module to install client-side navigation before clicking a link.
      await page.evaluate(async () => {
        let entry = document.querySelector<HTMLScriptElement>('script[type="module"][src]')!
        await import(entry.src)
      })

      let isDark = () => page.evaluate(() => document.documentElement.classList.contains('dark'))
      assert.equal(await isDark(), dark)
      await page.evaluate(() => Reflect.set(window, '__themeNavigationTest', true))

      await page.getByRole('navigation', { name: 'Main', exact: true }).getByText('Docs').click()
      await page.getByRole('heading', { name: 'Installation', exact: true }).waitFor()
      // Ensure this exercised Remix navigation, not a full document load.
      assert.equal(await page.evaluate(() => Reflect.get(window, '__themeNavigationTest')), true)
      assert.equal(await isDark(), dark)

      await page.goBack()
      await page
        .getByRole('heading', { name: 'Installation', exact: true })
        .waitFor({ state: 'hidden' })
      assert.equal(await isDark(), dark)

      await page.goForward()
      await page.getByRole('heading', { name: 'Installation', exact: true }).waitFor()
      assert.equal(await isDark(), dark)

      await page.reload()
      assert.equal(await isDark(), dark)
    })
  }
})
