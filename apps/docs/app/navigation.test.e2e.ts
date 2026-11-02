import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import { describe, it } from 'remix/test'

import { router } from './router.ts'
import { routes } from './routes.ts'

describe('docs GitHub links', () => {
  it('shows an accessible repository icon in the header', async (t) => {
    let page = await t.serve(await createTestServer(router.fetch))
    await page.goto(routes.home.href())

    let link = page.getByRole('banner').getByRole('link', { name: 'GitHub repository' })
    assert.equal(await link.isVisible(), true)
    assert.equal(await link.getAttribute('href'), 'https://github.com/stemsui/stems-ui')
    assert.equal(await link.getAttribute('target'), '_blank')
    assert.equal(await link.getAttribute('rel'), 'noreferrer')
    assert.equal(await link.locator('svg').getAttribute('aria-hidden'), 'true')
    await link.focus()
    assert.equal(await link.evaluate((node) => node === document.activeElement), true)
  })

  it('shows a labelled repository link in the mobile menu', async (t) => {
    let page = await t.serve(await createTestServer(router.fetch))
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(routes.guide.href({ slug: 'installation' }))
    assert.equal(
      await page.getByRole('navigation', { name: 'Mobile', exact: true }).isVisible(),
      false,
    )

    await page.getByText('Menu', { exact: true }).click()
    let menu = page.getByRole('navigation', { name: 'Mobile', exact: true })
    let link = menu.getByRole('link', { name: 'GitHub', exact: true })
    assert.equal(await link.isVisible(), true)
    assert.equal(await link.getAttribute('href'), 'https://github.com/stemsui/stems-ui')
    assert.equal(await link.getAttribute('target'), '_blank')
    assert.equal(await link.getAttribute('rel'), 'noreferrer')
    assert.equal(await link.locator('svg').count(), 1)
    assert.equal(
      await page.getByRole('banner').getByRole('link', { name: 'GitHub repository' }).isVisible(),
      true,
    )
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    )
  })
})
