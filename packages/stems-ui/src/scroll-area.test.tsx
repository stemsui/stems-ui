import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import { renderToString } from 'remix/component/server'

import * as scrollArea from './scroll-area.ts'

function tag(html: string, marker: string): string {
  let match = html.match(new RegExp(`<div[^>]*data-part="${marker}"[^>]*>`))
  assert.ok(match, `${marker} not found in ${html}`)
  return match[0]
}

function ScrollArea() {
  return () => (
    <scrollArea.Context>
      <div data-part="root" mix={scrollArea.root()}>
        <div data-part="viewport" mix={scrollArea.viewport()}>
          <div data-part="content" mix={scrollArea.content()}>
            Content
          </div>
        </div>
        <div data-part="scrollbar-y" mix={scrollArea.scrollbar()}>
          <div data-part="thumb-y" mix={scrollArea.thumb()} />
        </div>
        <div data-part="scrollbar-x" mix={scrollArea.scrollbar({ orientation: 'horizontal' })}>
          <div data-part="thumb-x" mix={scrollArea.thumb({ orientation: 'horizontal' })} />
        </div>
        <div data-part="corner" mix={scrollArea.corner()} />
      </div>
    </scrollArea.Context>
  )
}

describe('scroll-area (server)', () => {
  it('renders unmeasured markup', async () => {
    let html = await renderToString(<ScrollArea />)

    let root = tag(html, 'root')
    assert.match(root, /role="presentation"/)
    assert.match(root, /position: relative/)
    assert.match(root, /--scroll-area-corner-height: 0px/)
    assert.match(root, /--scroll-area-corner-width: 0px/)
    assert.doesNotMatch(root, /data-has-overflow|data-overflow-|data-scrolling/)

    let viewport = tag(html, 'viewport')
    assert.match(viewport, /overflow: scroll/)
    assert.match(viewport, /scrollbar-width: none/)
    assert.match(viewport, /tabindex="-1"/)
    // Measured values only exist after hydration.
    assert.doesNotMatch(viewport, /--scroll-area-overflow/)
    assert.doesNotMatch(viewport, /data-has-overflow/)

    let content = tag(html, 'content')
    assert.match(content, /role="presentation"/)
    assert.match(content, /min-width: fit-content/)
  })

  it('hides scrollbars and corner until overflow is measured', async () => {
    let html = await renderToString(<ScrollArea />)

    let scrollbarY = tag(html, 'scrollbar-y')
    assert.match(scrollbarY, /\shidden(\s|>|=)/)
    assert.match(scrollbarY, /aria-hidden="true"/)
    assert.match(scrollbarY, /data-orientation="vertical"/)
    assert.match(scrollbarY, /position: absolute/)
    assert.match(scrollbarY, /bottom: var\(--scroll-area-corner-height\)/)
    assert.match(scrollbarY, /--scroll-area-thumb-height: 0px/)
    assert.doesNotMatch(scrollbarY, /data-hovering|data-scrolling/)

    let scrollbarX = tag(html, 'scrollbar-x')
    assert.match(scrollbarX, /data-orientation="horizontal"/)
    assert.match(scrollbarX, /inset-inline-end: var\(--scroll-area-corner-width\)/)
    assert.match(scrollbarX, /--scroll-area-thumb-width: 0px/)

    let thumbY = tag(html, 'thumb-y')
    assert.match(thumbY, /data-orientation="vertical"/)
    assert.match(thumbY, /height: var\(--scroll-area-thumb-height\)/)
    assert.match(thumbY, /visibility: hidden/)

    let thumbX = tag(html, 'thumb-x')
    assert.match(thumbX, /data-orientation="horizontal"/)
    assert.match(thumbX, /width: var\(--scroll-area-thumb-width\)/)

    let corner = tag(html, 'corner')
    assert.match(corner, /\shidden(\s|>|=)/)
    assert.match(corner, /aria-hidden="true"/)
  })

  it('keeps a keepMounted scrollbar visible', async () => {
    let html = await renderToString(
      <scrollArea.Context>
        <div mix={scrollArea.root()}>
          <div mix={scrollArea.viewport()} />
          <div data-part="bar" mix={scrollArea.scrollbar({ keepMounted: true })}>
            <div mix={scrollArea.thumb()} />
          </div>
        </div>
      </scrollArea.Context>,
    )
    assert.doesNotMatch(tag(html, 'bar'), /\shidden/)
  })

  it('lets host props win', async () => {
    let html = await renderToString(
      <scrollArea.Context>
        <div data-part="root" style={{ position: 'absolute' }} mix={scrollArea.root()}>
          <div
            data-part="viewport"
            tabIndex={0}
            style="overflow: auto"
            mix={scrollArea.viewport()}
          />
        </div>
      </scrollArea.Context>,
    )
    assert.match(tag(html, 'root'), /position: absolute/)
    let viewport = tag(html, 'viewport')
    assert.match(viewport, /tabindex="0"/)
    assert.match(viewport, /overflow: auto/)
  })
})
