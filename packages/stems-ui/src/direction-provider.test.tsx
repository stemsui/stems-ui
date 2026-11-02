import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import type { Handle } from 'remix/component'
import { renderToString } from 'remix/component/server'

import { DirectionProvider, getDirectionFromContext } from './direction-provider.ts'

function ReadDirection(handle: Handle) {
  return () => <span>{getDirectionFromContext(handle) ?? 'none'}</span>
}

describe('direction-provider (server)', () => {
  it('renders a display: contents element with dir', async () => {
    let html = await renderToString(
      <DirectionProvider direction="rtl">
        <p>Hello</p>
      </DirectionProvider>,
    )
    assert.match(html, /^<div[^>]*\sdir="rtl"/)
    assert.match(html, /style="display: contents;?"/)
    assert.match(html, /<p>Hello<\/p><\/div>$/)
  })

  it('defaults to ltr', async () => {
    let html = await renderToString(<DirectionProvider />)
    assert.match(html, /dir="ltr"/)
  })

  it('provides the direction during render', async () => {
    let html = await renderToString(
      <div>
        <ReadDirection />
        <DirectionProvider direction="rtl">
          <ReadDirection />
          <DirectionProvider direction="ltr">
            <ReadDirection />
          </DirectionProvider>
        </DirectionProvider>
      </div>,
    )
    let values = [...html.matchAll(/<span>(\w+)<\/span>/g)].map((match) => match[1])
    assert.deepEqual(values, ['none', 'rtl', 'ltr'])
  })
})
