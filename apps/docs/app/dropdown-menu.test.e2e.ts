import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import { describe, it } from 'remix/test'
import type { TestContext } from 'remix/test'

import { router } from './router.ts'
import { routes } from './routes.ts'

async function openDemo(t: TestContext) {
  let page = await t.serve(await createTestServer(router.fetch))
  await page.goto(routes.component.href({ name: 'dropdown-menu' }))
  await page.getByRole('button', { name: 'Open menu' }).waitFor()
  // Wait for the client entry to hydrate before interacting (the trigger gets its id on render,
  // the press handler on hydration).
  await page.waitForFunction(() =>
    document.querySelector('[data-slot="dropdown-menu-trigger"]')?.hasAttribute('aria-controls'),
  )
  await page.waitForTimeout(100)
  return page
}

describe('dropdown menu demo', () => {
  it('opens, navigates by keyboard, and selects an item', async (t) => {
    let page = await openDemo(t)
    let trigger = page.getByRole('button', { name: 'Open menu' })

    assert.equal(await trigger.getAttribute('aria-expanded'), 'false')

    await trigger.click()
    let menu = page.getByRole('menu').first()
    await menu.waitFor({ state: 'visible' })
    assert.equal(await trigger.getAttribute('aria-expanded'), 'true')
    assert.equal(await trigger.getAttribute('data-popup-open'), '')

    // Base styles from the registry are applied (Tailwind compiled the registry sources).
    let surface = page.locator('[data-slot="dropdown-menu-content"]')
    let radius = await surface.evaluate(
      (node: Element) => getComputedStyle(node).borderTopLeftRadius,
    )
    assert.notEqual(radius, '0px')

    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowDown')
    let highlighted = page.locator('[data-slot="dropdown-menu-content"] [data-highlighted]')
    assert.equal((await highlighted.textContent())?.startsWith('Billing'), true)
    assert.equal(
      await page.evaluate(() => document.activeElement?.textContent?.startsWith('Billing')),
      true,
    )

    await page.keyboard.press('Enter')
    await menu.waitFor({ state: 'hidden' })
    await page.getByTestId('menu-result').getByText('billing').waitFor()

    // Focus returns to the trigger after selection.
    await page.waitForFunction(
      () => document.activeElement?.getAttribute('data-slot') === 'dropdown-menu-trigger',
      undefined,
      { timeout: 2000 },
    )
  })

  it('toggles a checkbox item and keeps the menu open', async (t) => {
    let page = await openDemo(t)

    await page.getByRole('button', { name: 'Open menu' }).click()
    let item = page.getByRole('menuitemcheckbox', { name: 'Status bar' })
    assert.equal(await item.getAttribute('aria-checked'), 'true')
    await item.click()
    await page.getByTestId('menu-result').getByText('Status bar off').waitFor()
    assert.equal(await item.getAttribute('aria-checked'), 'false')
    assert.equal(await page.getByRole('menu').first().isVisible(), true)
  })

  it('selects a radio item', async (t) => {
    let page = await openDemo(t)

    await page.getByRole('button', { name: 'Open menu' }).click()
    let right = page.getByRole('menuitemradio', { name: 'Right' })
    assert.equal(await right.getAttribute('aria-checked'), 'false')
    await right.click()
    await page.getByTestId('menu-result').getByText('Panel right').waitFor()
    assert.equal(await right.getAttribute('aria-checked'), 'true')
    assert.equal(
      await page.getByRole('menuitemradio', { name: 'Bottom' }).getAttribute('aria-checked'),
      'false',
    )
  })

  it('opens a submenu with the keyboard and selects from it', async (t) => {
    let page = await openDemo(t)

    await page.getByRole('button', { name: 'Open menu' }).focus()
    await page.keyboard.press('Enter')
    await page.getByRole('menu').first().waitFor({ state: 'visible' })
    await page.keyboard.type('i')
    let subTrigger = page.getByRole('menuitem', { name: 'Invite users' })
    await page.waitForFunction(() => document.activeElement?.textContent === 'Invite users')
    await page.keyboard.press('ArrowRight')
    assert.equal(await subTrigger.getAttribute('aria-expanded'), 'true')
    let email = page.getByRole('menuitem', { name: 'Email' })
    await email.waitFor({ state: 'visible' })
    await page.waitForFunction(() => document.activeElement?.textContent === 'Email')

    await page.keyboard.press('ArrowLeft')
    await page.waitForFunction(() => document.activeElement?.textContent === 'Invite users')
    assert.equal(await subTrigger.getAttribute('aria-expanded'), 'false')

    await page.keyboard.press('ArrowRight')
    await page.waitForFunction(() => document.activeElement?.textContent === 'Email')
    await page.keyboard.press('Enter')
    await page.getByTestId('menu-result').getByText('invite-email').waitFor()
    await page.getByRole('menu').first().waitFor({ state: 'hidden' })
  })
})
