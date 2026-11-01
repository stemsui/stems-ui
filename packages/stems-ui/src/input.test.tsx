import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import { renderToString } from 'remix/component/server'

import { input } from './input.ts'

describe('input (server)', () => {
  it('renders filled state from defaultValue', async () => {
    let html = await renderToString(
      <input aria-label="Name" mix={input({ defaultValue: 'Ada' })} />,
    )
    assert.match(html, /value="Ada"/)
    assert.match(html, /data-filled=""/)
    assert.doesNotMatch(html, /data-(dirty|touched|focused)/)
  })

  it('renders filled state from a controlled value', async () => {
    let html = await renderToString(<input aria-label="Name" mix={input({ value: 'Ada' })} />)
    assert.match(html, /value="Ada"/)
    assert.match(html, /data-filled=""/)
  })

  it('renders an empty, enabled input without state attributes', async () => {
    let html = await renderToString(<input aria-label="Name" mix={input()} />)
    assert.doesNotMatch(html, /data-/)
  })

  it('renders the disabled state', async () => {
    let html = await renderToString(<input aria-label="Name" mix={input({ disabled: true })} />)
    assert.match(html, /\sdisabled(\s|>|=|\/)/)
    assert.match(html, /data-disabled=""/)
  })
})
