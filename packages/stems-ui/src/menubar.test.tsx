import { expect } from 'remix/assert'
import { describe, it } from 'remix/test'
import { renderToString } from 'remix/component/server'

import * as menu from './menu.ts'
import * as menubar from './menubar.ts'

function getTag(html: string, pattern: RegExp) {
  let match = html.match(pattern)
  expect(match).not.toBe(null)
  return match![0]
}

describe('menubar (server render)', () => {
  it('renders menubar attributes and the triggers as menubar items', async () => {
    let html = await renderToString(
      <menubar.Context orientation="vertical" modal={false}>
        <div aria-label="App" mix={menubar.root()}>
          {['file', 'edit'].map((name) => (
            <menu.Context>
              <button data-name={name} mix={menu.trigger()}>
                {name}
              </button>
              <div data-popup={name} mix={menu.popup()}>
                <div mix={menu.item()}>Item</div>
              </div>
            </menu.Context>
          ))}
        </div>
      </menubar.Context>,
    )

    let root = getTag(html, /<div[^>]*role="menubar"[^>]*>/)
    expect(root).toContain('aria-orientation="vertical"')
    expect(root).toContain('data-orientation="vertical"')
    expect(root).not.toContain('data-modal')
    expect(root).not.toContain('data-has-submenu-open')

    let file = getTag(html, /<button[^>]*data-name="file"[^>]*>/)
    let edit = getTag(html, /<button[^>]*data-name="edit"[^>]*>/)
    expect(file).toContain('role="menuitem"')
    expect(file).toContain('aria-haspopup="menu"')
    expect(file).toContain('aria-expanded="false"')
    expect(file).toContain('tabindex="0"')
    expect(edit).toContain('role="menuitem"')
    expect(edit).toContain('tabindex="-1"')

    // Vertical menubars open their menus to the side.
    expect(getTag(html, /<div[^>]*data-popup="file"[^>]*>/)).toContain('data-side="inline-end"')
  })

  it('renders an open menu and a disabled menubar', async () => {
    let html = await renderToString(
      <menubar.Context disabled>
        <div mix={menubar.root()}>
          <menu.Context defaultOpen>
            <button data-name="file" mix={menu.trigger()}>
              File
            </button>
            <div data-popup="file" mix={menu.popup()} />
          </menu.Context>
        </div>
      </menubar.Context>,
    )

    let root = getTag(html, /<div[^>]*role="menubar"[^>]*>/)
    expect(root).toContain('data-modal=""')
    // The root renders before its menus, so an initially open menu only shows up in
    // `data-has-submenu-open` after hydration (documented in the README).
    expect(root).not.toContain('data-has-submenu-open')
    expect(getTag(html, /<div[^>]*data-popup="file"[^>]*>/)).toContain('data-open=""')
    let file = getTag(html, /<button[^>]*data-name="file"[^>]*>/)
    expect(file).toMatch(/\sdisabled/)
    expect(file).toContain('data-disabled=""')
    expect(getTag(html, /<div[^>]*data-popup="file"[^>]*>/)).toContain('data-side="bottom"')
  })
})
