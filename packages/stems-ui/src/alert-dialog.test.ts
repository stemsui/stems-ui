import { expect } from 'remix/assert'
import { describe, it } from 'remix/test'
import { createElement } from 'remix/component'
import { renderToString } from 'remix/component/server'

import * as alertDialog from './alert-dialog.ts'

function renderAlertDialog(props: alertDialog.AlertDialogContextProps) {
  return renderToString(
    createElement(
      alertDialog.Context,
      props,
      createElement('button', { class: 'trigger', mix: alertDialog.trigger() }, 'Delete'),
      createElement(
        'dialog',
        { class: 'popup', mix: alertDialog.popup() },
        createElement('h2', { mix: alertDialog.title() }, 'Are you sure?'),
        createElement('p', { mix: alertDialog.description() }, 'This cannot be undone.'),
        createElement('button', { class: 'close', mix: alertDialog.close() }, 'Cancel'),
      ),
    ),
  )
}

function getTag(html: string, pattern: RegExp) {
  let match = html.match(pattern)
  expect(match).not.toBe(null)
  return match![0]
}

describe('alert dialog (server render)', () => {
  it('renders role="alertdialog" and modal attributes', async () => {
    let html = await renderAlertDialog({})

    let popup = getTag(html, /<dialog[^>]*>/)
    expect(popup).toContain('role="alertdialog"')
    expect(popup).toContain('aria-modal="true"')
    expect(popup).toContain('data-closed=""')
    expect(popup).toMatch(/aria-labelledby="[^"]+"/)
    expect(popup).toMatch(/aria-describedby="[^"]+"/)

    let trigger = getTag(html, /<button[^>]*class="trigger"[^>]*>/)
    expect(trigger).toContain('aria-haspopup="dialog"')
    expect(trigger).toContain('aria-expanded="false"')
  })

  it('renders open state', async () => {
    let html = await renderAlertDialog({ defaultOpen: true })
    expect(getTag(html, /<dialog[^>]*>/)).toContain('data-open=""')
    expect(getTag(html, /<button[^>]*class="trigger"[^>]*>/)).toContain('aria-expanded="true"')
  })
})
