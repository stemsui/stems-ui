import { expect } from 'remix/assert'
import { describe, it } from 'remix/test'
import { renderToString } from 'remix/component/server'

import * as navigationMenu from './navigation-menu.tsx'

function renderMenu(props: navigationMenu.NavigationMenuContextProps = {}, noArgs = false) {
  return renderToString(
    <navigationMenu.Context {...props}>
      <nav class="root" mix={navigationMenu.root()}>
        <ul class="list" mix={navigationMenu.list()}>
          <navigationMenu.ItemContext value="docs">
            <li>
              <button
                class="trigger-docs"
                mix={
                  noArgs ? navigationMenu.trigger() : navigationMenu.trigger({ disabled: false })
                }
              >
                Docs
                <span class="icon-docs" mix={navigationMenu.icon()} />
              </button>
              <navigationMenu.Content class="content-docs">
                <a
                  href="/docs/intro"
                  class="link-intro"
                  mix={noArgs ? navigationMenu.link() : navigationMenu.link({ active: true })}
                >
                  Intro
                </a>
              </navigationMenu.Content>
            </li>
          </navigationMenu.ItemContext>
          <navigationMenu.ItemContext value="blog">
            <li>
              <button class="trigger-blog" mix={navigationMenu.trigger({ disabled: true })}>
                Blog
              </button>
              <navigationMenu.Content class="content-blog" id="custom-blog">
                <a href="/blog" class="link-blog">
                  Blog home
                </a>
              </navigationMenu.Content>
            </li>
          </navigationMenu.ItemContext>
          <li>
            <a href="/about" class="link-about" mix={navigationMenu.link()}>
              About
            </a>
          </li>
        </ul>
        <div class="backdrop" mix={navigationMenu.backdrop()} />
        <div
          class="popup"
          mix={
            noArgs
              ? navigationMenu.popup()
              : navigationMenu.popup({ side: 'bottom', align: 'start' })
          }
        >
          <span class="arrow" mix={navigationMenu.arrow()} />
          <navigationMenu.Viewport class="viewport" />
        </div>
      </nav>
    </navigationMenu.Context>,
  )
}

function getTag(html: string, pattern: RegExp) {
  let match = html.match(pattern)
  expect(match).not.toBe(null)
  return match![0]
}

const HIDDEN = /\shidden(=""|\s|>)/

describe('navigation-menu (server render)', () => {
  it('renders a closed menu with every content inside the viewport', async () => {
    let html = await renderMenu()

    let root = getTag(html, /<nav[^>]*class="root"[^>]*>/)
    expect(root).toContain('data-orientation="horizontal"')
    expect(root).not.toContain('data-nested')

    let list = getTag(html, /<ul[^>]*class="list"[^>]*>/)
    expect(list).toContain('data-orientation="horizontal"')

    let trigger = getTag(html, /<button[^>]*class="trigger-docs"[^>]*>/)
    expect(trigger).toContain('type="button"')
    expect(trigger).toContain('aria-expanded="false"')
    expect(trigger).not.toContain('aria-haspopup')
    expect(trigger).not.toContain('data-popup-open')
    expect(trigger).not.toContain('role=')

    let icon = getTag(html, /<span[^>]*class="icon-docs"[^>]*>/)
    expect(icon).toContain('aria-hidden="true"')
    expect(icon).not.toContain('data-popup-open')

    // Contents render inside the viewport, not inside their items.
    let viewportStart = html.indexOf('class="viewport"')
    let listEnd = html.indexOf('</ul>')
    expect(viewportStart).toBeGreaterThan(listEnd)
    expect(html.indexOf('class="content-docs"')).toBeGreaterThan(viewportStart)
    expect(html.indexOf('class="content-blog"')).toBeGreaterThan(viewportStart)

    let content = getTag(html, /<div[^>]*class="content-docs"[^>]*>/)
    expect(content).toMatch(HIDDEN)
    expect(content).toContain('data-closed=""')
    expect(content).not.toContain('data-open')
    expect(content).not.toContain('data-activation-direction')
    let contentId = content.match(/\sid="([^"]+)"/)?.[1]
    expect(contentId).toBeTruthy()
    expect(trigger).toContain(`aria-controls="${contentId}"`)

    // Every link is in the HTML (crawlers), even while closed.
    expect(html).toContain('href="/docs/intro"')
    expect(html).toContain('href="/blog"')

    let popup = getTag(html, /<div[^>]*class="popup"[^>]*>/)
    expect(popup).toContain('popover="manual"')
    expect(popup).toMatch(HIDDEN)
    expect(popup).toContain('data-closed=""')
    expect(popup).toContain('data-side="bottom"')
    expect(popup).toContain('data-align="start"')
    expect(popup).not.toContain('role=')

    let arrow = getTag(html, /<span[^>]*class="arrow"[^>]*>/)
    expect(arrow).toContain('aria-hidden="true"')
    expect(arrow).toContain('data-closed=""')

    let backdrop = getTag(html, /<div[^>]*class="backdrop"[^>]*>/)
    expect(backdrop).toContain('popover="manual"')
    expect(backdrop).toMatch(HIDDEN)
  })

  it('renders links and disabled triggers', async () => {
    let html = await renderMenu()

    let intro = getTag(html, /<a[^>]*class="link-intro"[^>]*>/)
    expect(intro).toContain('aria-current="page"')
    expect(intro).toContain('data-active=""')

    let about = getTag(html, /<a[^>]*class="link-about"[^>]*>/)
    expect(about).not.toContain('aria-current')
    expect(about).not.toContain('data-active')

    let blog = getTag(html, /<button[^>]*class="trigger-blog"[^>]*>/)
    expect(blog).toContain('aria-disabled="true"')
    expect(blog).toContain('data-disabled=""')
    expect(blog).not.toMatch(/\sdisabled(=""|\s|>)/)
  })

  it('uses a custom content id for aria-controls', async () => {
    let html = await renderMenu()
    let content = getTag(html, /<div[^>]*class="content-blog"[^>]*>/)
    expect(content).toContain('id="custom-blog"')
  })

  it('renders the open state from defaultValue', async () => {
    let html = await renderMenu({ defaultValue: 'docs' })

    let trigger = getTag(html, /<button[^>]*class="trigger-docs"[^>]*>/)
    expect(trigger).toContain('aria-expanded="true"')
    expect(trigger).toContain('data-popup-open=""')
    expect(trigger).toContain('data-pressed=""')

    let icon = getTag(html, /<span[^>]*class="icon-docs"[^>]*>/)
    expect(icon).toContain('data-popup-open=""')

    let other = getTag(html, /<button[^>]*class="trigger-blog"[^>]*>/)
    expect(other).toContain('aria-expanded="false"')

    let content = getTag(html, /<div[^>]*class="content-docs"[^>]*>/)
    expect(content).not.toMatch(HIDDEN)
    expect(content).toContain('data-open=""')
    expect(content).not.toContain('data-starting-style')

    let blog = getTag(html, /<div[^>]*class="content-blog"[^>]*>/)
    expect(blog).toMatch(HIDDEN)

    let popup = getTag(html, /<div[^>]*class="popup"[^>]*>/)
    expect(popup).toContain('data-open=""')
    expect(popup).not.toMatch(HIDDEN)
  })

  it('renders the controlled value', async () => {
    let html = await renderMenu({ value: 'docs', defaultValue: null })
    expect(getTag(html, /<button[^>]*class="trigger-docs"[^>]*>/)).toContain('aria-expanded="true"')
    html = await renderMenu({ value: null, defaultValue: 'docs' })
    expect(getTag(html, /<button[^>]*class="trigger-docs"[^>]*>/)).toContain(
      'aria-expanded="false"',
    )
  })

  it('accepts vertical orientation', async () => {
    let html = await renderMenu({ orientation: 'vertical' })
    expect(getTag(html, /<nav[^>]*class="root"[^>]*>/)).toContain('data-orientation="vertical"')
  })

  it('supports calling every mixin with no arguments', async () => {
    let html = await renderMenu({}, true)
    expect(getTag(html, /<button[^>]*class="trigger-docs"[^>]*>/)).toContain(
      'aria-expanded="false"',
    )
    expect(getTag(html, /<a[^>]*class="link-intro"[^>]*>/)).not.toContain('aria-current')
    expect(getTag(html, /<div[^>]*class="popup"[^>]*>/)).toContain('data-side="bottom"')
  })

  it('marks nested menus', async () => {
    let html = await renderToString(
      <navigationMenu.Context defaultValue="a">
        <nav mix={navigationMenu.root()}>
          <ul mix={navigationMenu.list()}>
            <navigationMenu.ItemContext value="a">
              <li>
                <button mix={navigationMenu.trigger()}>A</button>
                <navigationMenu.Content>
                  <navigationMenu.Context orientation="vertical" defaultValue="x">
                    <div class="nested" mix={navigationMenu.root()}>
                      <ul mix={navigationMenu.list()}>
                        <navigationMenu.ItemContext value="x">
                          <li>
                            <button class="nested-trigger" mix={navigationMenu.trigger()}>
                              X
                            </button>
                            <navigationMenu.Content class="nested-content">
                              Nested
                            </navigationMenu.Content>
                          </li>
                        </navigationMenu.ItemContext>
                      </ul>
                      <navigationMenu.Viewport class="nested-viewport" />
                    </div>
                  </navigationMenu.Context>
                </navigationMenu.Content>
              </li>
            </navigationMenu.ItemContext>
          </ul>
          <div mix={navigationMenu.popup()}>
            <navigationMenu.Viewport />
          </div>
        </nav>
      </navigationMenu.Context>,
    )
    let nested = getTag(html, /<div[^>]*class="nested"[^>]*>/)
    expect(nested).toContain('data-nested=""')
    expect(nested).toContain('data-orientation="vertical"')
    let content = getTag(html, /<div[^>]*class="nested-content"[^>]*>/)
    expect(content).toContain('data-open=""')
    expect(html.indexOf('class="nested-content"')).toBeGreaterThan(
      html.indexOf('class="nested-viewport"'),
    )
  })
})
