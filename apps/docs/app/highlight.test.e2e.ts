import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import { describe, it } from 'remix/test'

import { readDemoSource } from './content.ts'
import { router } from './router.ts'
import { routes } from './routes.ts'

describe('docs syntax highlighting', () => {
  it('highlights demo source, preserves copy text, and changes colors with the theme', async (t) => {
    let page = await t.serve(await createTestServer(router.fetch))
    await page.emulateMedia({ colorScheme: 'light' })
    await page.addInitScript(() => localStorage.setItem('theme', 'light'))
    await page.goto(routes.component.href({ name: 'button' }))
    await page.locator('#code summary').click()

    let source = page.locator('#demo-source')
    assert.equal(await source.textContent(), await readDemoSource('button'))
    let keyword = source.locator('.th-keyword').first()
    let color = () => keyword.evaluate((node) => getComputedStyle(node).color)
    let lightColor = await color()
    assert.notEqual(lightColor, await source.evaluate((node) => getComputedStyle(node).color))

    await page.evaluate(() => document.documentElement.classList.add('dark'))
    assert.notEqual(await color(), lightColor)
    assert.equal(await source.textContent(), await readDemoSource('button'))

    await page.evaluate(() => document.documentElement.classList.remove('dark'))
    assert.equal(await color(), lightColor)
  })

  it('highlights fenced code in guides and API references', async (t) => {
    let page = await t.serve(await createTestServer(router.fetch))
    for (let href of [
      routes.guide.href({ slug: 'installation' }),
      routes.api.href({ module: 'anchor' }),
    ]) {
      await page.goto(href)
      assert.ok((await page.locator('.prose-docs pre.th-code .th-token').count()) > 0)
      assert.equal(await page.locator('.prose-docs pre pre').count(), 0)
    }
  })
})
