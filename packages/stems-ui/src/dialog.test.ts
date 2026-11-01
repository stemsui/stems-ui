import { expect } from 'remix/assert'
import { describe, it } from 'remix/test'
import { createElement } from 'remix/component'
import { renderToString } from 'remix/component/server'

import * as dialog from './dialog.ts'

function renderDialog(props: dialog.DialogContextProps, nested?: dialog.DialogContextProps) {
  return renderToString(
    createElement(
      dialog.Context,
      props,
      createElement('button', { class: 'trigger', mix: dialog.trigger() }, 'Open'),
      createElement('div', { class: 'backdrop', mix: dialog.backdrop() }),
      createElement(
        'dialog',
        { class: 'popup', mix: dialog.popup() },
        createElement('h2', { mix: dialog.title() }, 'Title'),
        createElement('p', { mix: dialog.description() }, 'Description'),
        nested &&
          createElement(
            dialog.Context,
            nested,
            createElement('dialog', { class: 'inner', mix: dialog.popup() }, 'Inner'),
          ),
        createElement('button', { class: 'close', mix: dialog.close() }, 'Close'),
      ),
    ),
  )
}

function getTag(html: string, pattern: RegExp) {
  let match = html.match(pattern)
  expect(match).not.toBe(null)
  return match![0]
}

describe('dialog (server render)', () => {
  it('renders a closed dialog with linked ids', async () => {
    let html = await renderDialog({})

    let trigger = getTag(html, /<button[^>]*class="trigger"[^>]*>/)
    expect(trigger).toContain('type="button"')
    expect(trigger).toContain('aria-haspopup="dialog"')
    expect(trigger).toContain('aria-expanded="false"')
    expect(trigger).not.toContain('data-popup-open')

    let popup = getTag(html, /<dialog[^>]*class="popup"[^>]*>/)
    let id = popup.match(/id="([^"]+)"/)?.[1]
    expect(id).toBeTruthy()
    expect(trigger).toContain(`aria-controls="${id}"`)
    expect(popup).toContain('data-closed=""')
    expect(popup).toContain('aria-modal="true"')
    expect(popup).toContain('--nested-dialogs: 0')
    expect(popup).not.toContain('data-open')
    expect(popup).not.toMatch(/\sopen(=|\s|>)/)

    let titleId = getTag(html, /<h2[^>]*>/).match(/id="([^"]+)"/)?.[1]
    let descriptionId = getTag(html, /<p[^>]*>/).match(/id="([^"]+)"/)?.[1]
    expect(popup).toContain(`aria-labelledby="${titleId}"`)
    expect(popup).toContain(`aria-describedby="${descriptionId}"`)

    let backdrop = getTag(html, /<div[^>]*class="backdrop"[^>]*>/)
    expect(backdrop).toMatch(/\shidden(=""|\s|>)/)
    expect(backdrop).toContain('data-closed=""')

    expect(getTag(html, /<button[^>]*class="close"[^>]*>/)).toContain('type="button"')
  })

  it('renders open state attributes', async () => {
    let html = await renderDialog({ defaultOpen: true })

    let trigger = getTag(html, /<button[^>]*class="trigger"[^>]*>/)
    expect(trigger).toContain('aria-expanded="true"')
    expect(trigger).toContain('data-popup-open=""')

    let popup = getTag(html, /<dialog[^>]*class="popup"[^>]*>/)
    expect(popup).toContain('data-open=""')
    expect(popup).not.toContain('data-closed')
    expect(popup).not.toContain('data-starting-style')

    let backdrop = getTag(html, /<div[^>]*class="backdrop"[^>]*>/)
    expect(backdrop).not.toContain('hidden')
    expect(backdrop).toContain('data-open=""')
  })

  it('renders controlled state and modal options', async () => {
    let html = await renderDialog({ open: true, defaultOpen: false, modal: false })
    let popup = getTag(html, /<dialog[^>]*class="popup"[^>]*>/)
    expect(popup).toContain('data-open=""')
    expect(popup).not.toContain('aria-modal')
  })

  it('marks nested dialogs', async () => {
    let html = await renderDialog({}, {})
    expect(getTag(html, /<dialog[^>]*class="inner"[^>]*>/)).toContain('data-nested=""')
    expect(getTag(html, /<dialog[^>]*class="popup"[^>]*>/)).not.toContain('data-nested=')
  })
})
