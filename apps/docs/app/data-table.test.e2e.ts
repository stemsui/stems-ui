import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import { describe, it, type TestContext } from 'remix/test'

import { router } from './router.ts'
import { routes } from './routes.ts'

async function openDemo(t: TestContext) {
  let page = await t.serve(await createTestServer(router.fetch))
  let errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto(routes.component.href({ name: 'data-table' }))
  await page.waitForFunction(() =>
    document
      .querySelector('[data-slot="data-table-view-options"] button')
      ?.hasAttribute('aria-controls'),
  )
  await page.waitForTimeout(100)
  return { page, errors, demo: page.getByTestId('demo') }
}

describe('data table demo', () => {
  it('hydrates, sorts through the keyboard menu, and runs a row action', async (t) => {
    let { page, demo, errors } = await openDemo(t)
    await demo.getByRole('button', { name: 'Email column options' }).focus()
    await page.keyboard.press('Enter')
    let ascending = demo.getByRole('menuitem', { name: 'Ascending', exact: true })
    await ascending.waitFor({ state: 'visible' })
    await ascending.focus()
    await page.keyboard.press('Enter')
    await page.waitForFunction(() =>
      document.querySelector('thead th[aria-sort="ascending"]')?.textContent?.includes('Email'),
    )
    assert.match((await demo.locator('tbody tr').first().textContent()) ?? '', /abe45@example.com/)
    await demo.getByRole('button', { name: 'Actions for abe45@example.com' }).click()
    await demo.getByRole('menuitem', { name: 'View payment details' }).click()
    await demo.getByTestId('payment-action').getByText('Viewing pay_02').waitFor()
    assert.deepEqual(errors, [])
  })

  it('filters records and shows a correctly sized empty state', async (t) => {
    let { demo, errors } = await openDemo(t)
    await demo.getByRole('textbox', { name: 'Filter emails' }).fill('carmella')
    await demo.getByText('carmella@example.com', { exact: true }).waitFor()
    assert.equal(await demo.locator('tbody tr').count(), 1)
    await demo.getByRole('textbox', { name: 'Filter emails' }).fill('no-such-payment')
    await demo.getByRole('status').getByText('No results.').waitFor()
    assert.equal(await demo.locator('tbody td').getAttribute('colspan'), '5')
    assert.equal(await demo.getByRole('button', { name: 'Go to next page' }).isDisabled(), true)
    assert.deepEqual(errors, [])
  })

  it('selects the current page and preserves selection on other pages', async (t) => {
    let { demo, errors } = await openDemo(t)
    await demo.getByRole('checkbox', { name: 'Select ken99@example.com' }).click()
    assert.equal(
      await demo
        .getByRole('checkbox', { name: 'Select all rows on this page' })
        .getAttribute('aria-checked'),
      'mixed',
    )
    await demo.getByRole('checkbox', { name: 'Select all rows on this page' }).click()
    await demo.getByText('5 of 12 loaded row(s) selected.').waitFor()
    await demo.getByRole('button', { name: 'Go to next page' }).click()
    await demo.getByText('Page 2 of 3').waitFor()
    assert.equal(
      await demo
        .getByRole('checkbox', { name: 'Select all rows on this page' })
        .getAttribute('aria-checked'),
      'false',
    )
    await demo.getByRole('button', { name: 'Go to first page' }).click()
    await demo.getByText('Page 1 of 3').waitFor()
    assert.equal(await demo.locator('tbody tr[data-selected]').count(), 5)
    assert.deepEqual(errors, [])
  })

  it('toggles visibility and changes page size with the styled select', async (t) => {
    let { page, demo, errors } = await openDemo(t)
    await demo.getByRole('button', { name: 'Columns', exact: true }).click()
    await demo.getByRole('menuitemcheckbox', { name: 'Amount', exact: true }).click()
    assert.equal(await demo.locator('tbody tr').first().locator('td').count(), 4)
    await page.keyboard.press('Escape')
    await demo.getByRole('combobox', { name: 'Rows per page' }).click()
    await demo.getByRole('option', { name: '10', exact: true }).click()
    await demo.getByText('Page 1 of 2').waitFor()
    assert.equal(await demo.locator('tbody tr').count(), 10)
    assert.deepEqual(errors, [])
  })
})
