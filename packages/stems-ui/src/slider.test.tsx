import { expect } from 'remix/assert'
import { describe, it } from 'remix/test'
import { renderToString } from 'remix/component/server'

import * as slider from './slider.ts'

function getTags(html: string, pattern: RegExp) {
  return html.match(pattern) ?? []
}

describe('slider (server render)', () => {
  it('renders thumb semantics, positions, indicator, value text, and hidden inputs', async () => {
    let html = await renderToString(
      <slider.Context defaultValue={[20, 60]} name="price" format={{ style: 'decimal' }}>
        <div mix={slider.root()}>
          <span mix={slider.label()}>Price</span>
          <output mix={slider.value()}>
            <slider.ValueText />
          </output>
          <div mix={slider.control()}>
            <div mix={slider.track()}>
              <div mix={slider.indicator()} />
            </div>
            <span mix={slider.thumb({ index: 0 })} />
            <span mix={slider.thumb({ index: 1 })} />
          </div>
        </div>
      </slider.Context>,
    )

    let thumbs = getTags(html, /<span[^>]*role="slider"[^>]*>/g)
    expect(thumbs.length).toBe(2)
    expect(thumbs[0]).toContain('aria-valuenow="20"')
    expect(thumbs[0]).toContain('aria-valuemin="0"')
    expect(thumbs[0]).toContain('aria-valuemax="100"')
    expect(thumbs[0]).toContain('aria-valuetext="20 start range"')
    expect(thumbs[0]).toContain('aria-orientation="horizontal"')
    expect(thumbs[0]).toContain('data-index="0"')
    expect(thumbs[0]).toContain('tabindex="0"')
    expect(thumbs[0]).toMatch(/inset-inline-start:\s*20%/)
    expect(thumbs[0]).toContain('aria-labelledby=')
    expect(thumbs[1]).toContain('aria-valuetext="60 end range"')
    expect(thumbs[1]).toMatch(/inset-inline-start:\s*60%/)

    let indicator = html.match(/<div[^>]*width:\s*40%[^>]*>/)
    expect(indicator).not.toBe(null)
    expect(indicator![0]).toMatch(/inset-inline-start:\s*20%/)

    expect(html).toMatch(/<output[^>]*>20 – 60<\/output>/)

    let inputs = getTags(html, /<input[^>]*type="hidden"[^>]*>/g)
    expect(inputs.length).toBe(2)
    expect(inputs[0]).toContain('name="price"')
    expect(inputs[0]).toContain('value="20"')
    expect(inputs[1]).toContain('value="60"')
  })

  it('renders disabled and vertical state attributes', async () => {
    let html = await renderToString(
      <slider.Context defaultValue={30} disabled orientation="vertical">
        <div mix={slider.root()}>
          <div mix={slider.control()}>
            <span aria-label="Level" mix={slider.thumb()} />
          </div>
        </div>
      </slider.Context>,
    )
    let root = html.match(/<div[^>]*role="group"[^>]*>/)![0]
    expect(root).toContain('data-orientation="vertical"')
    expect(root).toContain('data-disabled=""')
    expect(root).not.toContain('data-dragging')
    let thumb = html.match(/<span[^>]*role="slider"[^>]*>/)![0]
    expect(thumb).toContain('aria-disabled="true"')
    expect(thumb).toContain('tabindex="-1"')
    expect(thumb).toContain('aria-orientation="vertical"')
    expect(thumb).toMatch(/bottom:\s*30%/)
    expect(thumb).not.toContain('aria-valuetext')
  })
})
