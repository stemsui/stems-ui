import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import { renderToString } from 'remix/component/server'

import * as progress from './progress.ts'

function openingTag(html: string, part: string): string {
  let match = html.match(new RegExp(`<[a-z]+\\s[^>]*data-part="${part}"[^>]*>`))
  assert.ok(match, `${part} not found in ${html}`)
  return match[0]
}

function Bar(props: { value: number | null }) {
  return (
    <progress.Context value={props.value}>
      <div data-part="root" mix={progress.root()}>
        <span data-part="label" mix={progress.label()}>
          Export
        </span>
        <span data-part="value" mix={progress.value()}>
          <progress.ValueText />
        </span>
        <div data-part="track" mix={progress.track()}>
          <div data-part="indicator" mix={progress.indicator()} />
        </div>
      </div>
    </progress.Context>
  )
}

describe('progress (server)', () => {
  it('renders progressbar attributes, label wiring, width, and value text', async () => {
    let html = await renderToString(Bar({ value: 40 }))
    let root = openingTag(html, 'root')
    assert.match(root, /role="progressbar"/)
    assert.match(root, /aria-valuenow="40"/)
    assert.match(root, /aria-valuemin="0"/)
    assert.match(root, /aria-valuemax="100"/)
    assert.match(root, /aria-valuetext="40%"/)
    assert.match(root, /data-progressing=""/)

    let labelId = openingTag(html, 'label').match(/id="([^"]+)"/)?.[1]
    assert.ok(labelId)
    assert.match(root, new RegExp(`aria-labelledby="${labelId}"`))

    assert.match(openingTag(html, 'indicator'), /width:\s*40%/)
    assert.match(openingTag(html, 'value'), /aria-hidden="true"/)
    assert.match(html, /data-part="value"[^>]*>40%<\/span>/)
  })

  it('renders the indeterminate state', async () => {
    let html = await renderToString(Bar({ value: null }))
    let root = openingTag(html, 'root')
    assert.doesNotMatch(root, /aria-valuenow/)
    assert.match(root, /aria-valuetext="indeterminate progress"/)
    for (let part of ['root', 'label', 'value', 'track', 'indicator']) {
      assert.match(openingTag(html, part), /data-indeterminate=""/, part)
    }
    assert.doesNotMatch(openingTag(html, 'indicator'), /width/)
  })

  it('renders the complete state', async () => {
    let html = await renderToString(Bar({ value: 100 }))
    assert.match(openingTag(html, 'root'), /data-complete=""/)
  })
})
