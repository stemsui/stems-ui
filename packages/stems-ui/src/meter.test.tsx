import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import { renderToString } from 'remix/component/server'

import * as meter from './meter.ts'

function openingTag(html: string, part: string): string {
  let match = html.match(new RegExp(`<[a-z]+\\s[^>]*data-part="${part}"[^>]*>`))
  assert.ok(match, `${part} not found in ${html}`)
  return match[0]
}

describe('meter (server)', () => {
  it('renders meter attributes, label wiring, width, and value text', async () => {
    let html = await renderToString(
      <meter.Context value={24}>
        <div data-part="root" mix={meter.root()}>
          <span data-part="label" mix={meter.label()}>
            Storage
          </span>
          <span data-part="value" mix={meter.value()}>
            <meter.ValueText />
          </span>
          <div data-part="track" mix={meter.track()}>
            <div data-part="indicator" mix={meter.indicator()} />
          </div>
        </div>
      </meter.Context>,
    )

    let root = openingTag(html, 'root')
    assert.match(root, /role="meter"/)
    assert.match(root, /aria-valuenow="24"/)
    assert.match(root, /aria-valuemin="0"/)
    assert.match(root, /aria-valuemax="100"/)
    assert.match(root, /aria-valuetext="24%"/)
    assert.doesNotMatch(root, /data-(complete|progressing|indeterminate)/)

    let labelId = openingTag(html, 'label').match(/id="([^"]+)"/)?.[1]
    assert.ok(labelId)
    assert.match(root, new RegExp(`aria-labelledby="${labelId}"`))
    assert.match(openingTag(html, 'indicator'), /width:\s*24%/)
    assert.match(html, /data-part="value"[^>]*>24%<\/span>/)
  })
})
