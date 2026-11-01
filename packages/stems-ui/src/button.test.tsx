import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import { renderToString } from 'remix/component/server'

import { button } from './button.ts'

describe('button (server)', () => {
  it('renders native button defaults', async () => {
    let html = await renderToString(<button mix={button()}>Save</button>)
    assert.equal(html, '<button type="button">Save</button>')
  })

  it('renders the disabled state', async () => {
    let html = await renderToString(<button mix={button({ disabled: true })}>Save</button>)
    assert.match(html, /\sdisabled(\s|>|=)/)
    assert.match(html, /data-disabled=""/)
    assert.doesNotMatch(html, /aria-disabled/)
  })

  it('renders focusableWhenDisabled with aria-disabled instead of disabled', async () => {
    let html = await renderToString(
      <button mix={button({ disabled: true, focusableWhenDisabled: true })}>Save</button>,
    )
    assert.match(html, /aria-disabled="true"/)
    assert.match(html, /data-disabled=""/)
    assert.doesNotMatch(html, /\sdisabled(\s|>|=)/)
  })

  it('renders non-native button semantics', async () => {
    let html = await renderToString(<div mix={button()}>Save</div>)
    assert.match(html, /role="button"/)
    assert.match(html, /tabindex="0"/i)
  })
})
