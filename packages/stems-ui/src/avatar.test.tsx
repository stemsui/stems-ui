import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import { renderToString } from 'remix/component/server'

import * as avatar from './avatar.ts'

function openingTag(html: string, tag: string): string {
  let match = html.match(new RegExp(`<${tag}(\\s[^>]*)?>`))
  assert.ok(match, `<${tag}> not found in ${html}`)
  return match[0]
}

describe('avatar (server)', () => {
  it('renders the fallback visible and the image hidden while loading', async () => {
    let html = await renderToString(
      <avatar.Context>
        <span mix={avatar.root()}>
          <img alt="Ada" src="/ada.png" mix={avatar.image()} />
          <b mix={avatar.fallback()}>AL</b>
        </span>
      </avatar.Context>,
    )

    let image = openingTag(html, 'img')
    assert.match(image, /\shidden(\s|>|=|\/)/)
    assert.match(image, /data-loading=""/)
    assert.match(image, /aria-hidden="true"/)
    assert.doesNotMatch(openingTag(html, 'b'), /hidden/)
  })

  it('hides a delayed fallback initially', async () => {
    let html = await renderToString(
      <avatar.Context>
        <img alt="Ada" src="/ada.png" mix={avatar.image()} />
        <b mix={avatar.fallback({ delay: 500 })}>AL</b>
      </avatar.Context>,
    )
    assert.match(openingTag(html, 'b'), /\shidden/)
  })

  it('keeps the image visible with keepMounted', async () => {
    let html = await renderToString(
      <avatar.Context>
        <img alt="Ada" src="/ada.png" mix={avatar.image({ keepMounted: true })} />
      </avatar.Context>,
    )
    let image = openingTag(html, 'img')
    assert.doesNotMatch(image, /\shidden/)
    assert.match(image, /data-loading=""/)
  })

  it('renders an idle image without src', async () => {
    let html = await renderToString(
      <avatar.Context>
        <img alt="Ada" mix={avatar.image()} />
      </avatar.Context>,
    )
    assert.doesNotMatch(openingTag(html, 'img'), /data-loading/)
  })
})
