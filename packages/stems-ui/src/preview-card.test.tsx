import { expect } from 'remix/assert'
import { describe, it } from 'remix/test'
import { renderToString } from 'remix/component/server'

import * as previewCard from './preview-card.ts'

function getTag(html: string, pattern: RegExp) {
  let match = html.match(pattern)
  expect(match).not.toBe(null)
  return match![0]
}

function renderCard(props: previewCard.PreviewCardContextProps = {}, noArgs = false) {
  return renderToString(
    <previewCard.Context {...props}>
      <a href="/remix" mix={noArgs ? previewCard.trigger() : previewCard.trigger({ delay: 100 })}>
        Remix
      </a>
      <div class="backdrop" mix={previewCard.backdrop()} />
      <div
        class="popup"
        mix={noArgs ? previewCard.popup() : previewCard.popup({ side: 'right', align: 'end' })}
      >
        <span class="arrow" mix={previewCard.arrow()} />
        Card
      </div>
    </previewCard.Context>,
  )
}

describe('preview-card (server render)', () => {
  it('renders a closed card with a hidden manual popup', async () => {
    let html = await renderCard()

    let trigger = getTag(html, /<a[^>]*>/)
    expect(trigger).toContain('href="/remix"')
    expect(trigger).not.toContain('role=')
    expect(trigger).not.toContain('aria-')
    expect(trigger).not.toContain('data-popup-open')

    let popup = getTag(html, /<div[^>]*class="popup"[^>]*>/)
    expect(popup).not.toContain('role=')
    expect(popup).toContain('popover="manual"')
    expect(popup).toMatch(/\shidden(=""|\s|>)/)
    expect(popup).toContain('data-closed=""')
    expect(popup).toContain('data-side="right"')
    expect(popup).toContain('data-align="end"')

    let backdrop = getTag(html, /<div[^>]*class="backdrop"[^>]*>/)
    expect(backdrop).toContain('role="presentation"')
    expect(backdrop).toMatch(/\shidden(=""|\s|>)/)

    let arrow = getTag(html, /<span[^>]*class="arrow"[^>]*>/)
    expect(arrow).toContain('data-side="right"')
  })

  it('renders the open state with defaultOpen', async () => {
    let html = await renderCard({ defaultOpen: true })
    expect(getTag(html, /<a[^>]*>/)).toContain('data-popup-open=""')
    let popup = getTag(html, /<div[^>]*class="popup"[^>]*>/)
    expect(popup).toContain('data-open=""')
    expect(popup).not.toMatch(/\shidden(=""|\s|>)/)
  })

  it('works with no-argument mixin calls', async () => {
    let html = await renderCard({}, true)
    let popup = getTag(html, /<div[^>]*class="popup"[^>]*>/)
    expect(popup).toContain('data-side="bottom"')
    expect(popup).toContain('data-align="center"')
  })
})
