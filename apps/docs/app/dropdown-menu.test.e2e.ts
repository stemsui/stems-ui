import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import { describe, it } from 'remix/test'

import { router } from './router.ts'
import { routes } from './routes.ts'

describe('dropdown menu demo', () => {
  it('opens, navigates by keyboard, and selects an item', async (t) => {
    let page = await t.serve(await createTestServer(router.fetch))
    await page.goto(routes.home.href())

    let trigger = page.getByRole('button', { name: 'Open menu' })
    await trigger.waitFor()
    // Wait for the client entry to hydrate before interacting.
    await page.waitForFunction(() =>
      document.querySelector('[data-slot="dropdown-menu-trigger"]')?.hasAttribute('aria-haspopup'),
    )

    assert.equal(await trigger.getAttribute('aria-expanded'), 'false')

    await trigger.click()
    let menu = page.getByRole('menu')
    await menu.waitFor({ state: 'visible' })
    assert.equal(await trigger.getAttribute('aria-expanded'), 'true')

    // Base styles from the registry are applied (Tailwind compiled the registry sources).
    let surface = page.locator('[data-slot="dropdown-menu-content"]')
    let radius = await surface.evaluate((node) => getComputedStyle(node).borderTopLeftRadius)
    assert.notEqual(radius, '0px')

    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowDown')
    let highlighted = page.locator('[data-highlighted="true"]')
    assert.equal((await highlighted.textContent())?.startsWith('Billing'), true)

    await page.keyboard.press('Enter')
    await menu.waitFor({ state: 'hidden' })
    await page.getByTestId('menu-result').getByText('billing').waitFor()

    // Focus returns to the trigger after selection (Remix restores it once the close finishes).
    await page.waitForFunction(
      () => document.activeElement?.getAttribute('data-slot') === 'dropdown-menu-trigger',
      undefined,
      { timeout: 2000 },
    )
  })

  it('toggles a checkbox item', async (t) => {
    let page = await t.serve(await createTestServer(router.fetch))
    await page.goto(routes.home.href())
    await page.waitForFunction(() =>
      document.querySelector('[data-slot="dropdown-menu-trigger"]')?.hasAttribute('aria-haspopup'),
    )

    await page.getByRole('button', { name: 'Open menu' }).click()
    let item = page.getByRole('menuitemcheckbox', { name: 'Status bar' })
    assert.equal(await item.getAttribute('aria-checked'), 'true')
    await item.click()
    await page.getByTestId('menu-result').getByText('Status bar off').waitFor()
  })
})
