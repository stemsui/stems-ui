import { expect } from 'remix/assert'
import { describe, it } from 'remix/test'
import type { Handle } from 'remix/component'
import { renderToString } from 'remix/component/server'

import * as toast from './toast.ts'

function List(handle: Handle) {
  let ctx = handle.context.get(toast.Context)
  return () => (
    <div class="viewport" mix={toast.viewport()}>
      {ctx.toasts.map((item) => (
        <div key={item.id} class="toast" mix={toast.root({ toast: item })}>
          <div class="content" mix={toast.content({ toast: item })}>
            <h2 class="title" mix={toast.title({ toast: item })}>
              {item.title}
            </h2>
            <p class="description" mix={toast.description({ toast: item })}>
              {item.description}
            </p>
            <button class="close" aria-label="Close" mix={toast.close({ toast: item })}>
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

function getTags(html: string, pattern: RegExp) {
  return [...html.matchAll(pattern)].map((match) => match[0])
}

describe('toast (server render)', () => {
  it('renders the viewport landmark', async () => {
    let html = await renderToString(
      <toast.Context>
        <List />
      </toast.Context>,
    )
    let [viewport] = getTags(html, /<div[^>]*class="viewport"[^>]*>/g)
    expect(viewport).toContain('role="region"')
    expect(viewport).toContain('aria-label="Notifications"')
    expect(viewport).toContain('tabindex="-1"')
    expect(viewport).not.toContain('data-expanded')
  })

  it('renders queued toasts with their state attributes', async () => {
    let manager = toast.createToastManager()
    let first = manager.add({ title: 'Saved', description: 'Done', type: 'success' })
    manager.add({ title: 'Second', priority: 'high' })
    manager.add({ title: 'Third' })

    let html = await renderToString(
      <toast.Context toastManager={manager} limit={2}>
        <List />
      </toast.Context>,
    )
    let roots = getTags(html, /<div[^>]*class="toast"[^>]*>/g)
    expect(roots.length).toBe(3)
    let [third, second, saved] = roots

    expect(third).toContain('role="dialog"')
    expect(third).toContain('aria-modal="false"')
    expect(second).toContain('role="alertdialog"')
    expect(saved).toContain('data-type="success"')
    expect(saved).toContain(`aria-labelledby="${first}-title"`)
    expect(saved).toContain(`aria-describedby="${first}-description"`)
    expect(saved).toContain('data-limited=""')
    expect(saved).toMatch(/\sinert(=""|\s|>)/)
    expect(third).not.toContain('data-limited')
    expect(html).toContain(`id="${first}-title"`)
    expect(html).toContain(`id="${first}-description"`)

    let contents = getTags(html, /<div[^>]*class="content"[^>]*>/g)
    expect(contents[0]).not.toContain('data-behind')
    expect(contents[1]).toContain('data-behind=""')

    let close = getTags(html, /<button[^>]*class="close"[^>]*>/g)[0]
    expect(close).toContain('type="button"')
  })

  it('supports no-argument mixin calls', async () => {
    let html = await renderToString(
      <toast.Context>
        <div class="viewport" mix={toast.viewport()}>
          <div class="toast" mix={toast.root()}>
            <span mix={toast.title()} />
            <span mix={toast.description()} />
            <div mix={toast.content()} />
            <button mix={toast.action()} />
            <button mix={toast.close()} />
          </div>
        </div>
      </toast.Context>,
    )
    expect(html).toContain('role="dialog"')
    expect(html).toContain('type="button"')
  })
})
