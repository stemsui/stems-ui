// Adapted from @remix-run/ui 0.13.0 (packages/ui/src/accordion.test.tsx).
// https://github.com/remix-run/remix - Copyright (c) 2025 Shopify Inc. MIT License.

import { expect } from 'remix/assert'
import { describe, it } from 'remix/test'
import type { Handle, RemixNode } from 'remix/component'
import { render } from 'remix/component/test'

import * as accordion from './accordion.tsx'
import { AccordionChangeEvent, onAccordionChange } from './accordion.tsx'

type T = { after(fn: () => void): void }

function nextFrame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
}

async function waitFor(condition: () => boolean, timeout = 1000) {
  let start = performance.now()
  while (!condition()) {
    if (performance.now() - start > timeout) throw new Error('waitFor timed out')
    await nextFrame()
  }
}

function addStyle(t: T, css: string) {
  let style = document.createElement('style')
  style.textContent = css
  document.head.append(style)
  t.after(() => style.remove())
}

function TestAccordion(handle: Handle<accordion.AccordionContextProps>) {
  return () => {
    let { children, ...props } = handle.props
    return (
      <accordion.Context {...props}>
        <div class="root" mix={accordion.root()}>
          {children}
        </div>
      </accordion.Context>
    )
  }
}

function TestItem(
  handle: Handle<accordion.AccordionItemContextProps & { title: string; text?: string }>,
) {
  return () => {
    let { title, text, children: _children, ...props } = handle.props
    return (
      <accordion.ItemContext {...props}>
        <div class="item" mix={accordion.item()}>
          <h3 mix={accordion.header()}>
            <button mix={accordion.trigger()}>{title}</button>
          </h3>
          <div class="panel" mix={accordion.panel()}>
            <div style={{ height: '40px' }}>{text ?? `${title} content`}</div>
          </div>
        </div>
      </accordion.ItemContext>
    )
  }
}

function example(props: accordion.AccordionContextProps = {}) {
  return (
    <TestAccordion {...props}>
      <TestItem value="account" title="Account" />
      <TestItem value="security" title="Security" disabled />
      <TestItem value="billing" title="Billing" />
    </TestAccordion>
  )
}

function setup(t: T, node: RemixNode) {
  let result = render(node)
  t.after(result.cleanup)
  let buttons = () => [...result.$$('button')] as HTMLButtonElement[]
  let panels = () => [...result.$$('.panel')] as HTMLDivElement[]
  let expanded = () => buttons().map((button) => button.getAttribute('aria-expanded'))
  return { ...result, buttons, panels, expanded }
}

function key(node: HTMLElement, key: string) {
  node.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key }))
}

describe('accordion', () => {
  it('supports single uncontrolled mode', async (t) => {
    let { act, buttons, expanded } = setup(t, example({ defaultValue: ['account'] }))

    expect(expanded()).toEqual(['true', 'false', 'false'])

    await act(() => buttons()[2].click())
    expect(expanded()).toEqual(['false', 'false', 'true'])
  })

  it('lets a single open item collapse', async (t) => {
    let { act, buttons, expanded } = setup(t, example({ defaultValue: ['account'] }))

    await act(() => buttons()[0].click())
    expect(expanded()).toEqual(['false', 'false', 'false'])
  })

  it('supports single controlled mode', async (t) => {
    let changes: string[][] = []

    function App(handle: Handle) {
      let value = ['account']
      return () =>
        example({
          value,
          onValueChange(next) {
            changes.push(next)
            value = next
            void handle.update()
          },
        })
    }

    let { act, buttons, expanded } = setup(t, <App />)

    await act(() => buttons()[2].click())
    expect(changes).toEqual([['billing']])
    expect(expanded()).toEqual(['false', 'false', 'true'])

    await act(() => buttons()[2].click())
    expect(changes).toEqual([['billing'], []])
    expect(expanded()).toEqual(['false', 'false', 'false'])
  })

  it('does not change controlled state on its own', async (t) => {
    let changes: string[][] = []
    let { act, buttons, expanded } = setup(
      t,
      example({ value: [], onValueChange: (value) => changes.push(value) }),
    )

    await act(() => buttons()[0].click())
    expect(changes).toEqual([['account']])
    expect(expanded()).toEqual(['false', 'false', 'false'])
  })

  it('supports multiple uncontrolled mode', async (t) => {
    let { act, buttons, expanded } = setup(
      t,
      example({ multiple: true, defaultValue: ['account'] }),
    )

    await act(() => buttons()[2].click())
    expect(expanded()).toEqual(['true', 'false', 'true'])

    await act(() => buttons()[0].click())
    expect(expanded()).toEqual(['false', 'false', 'true'])
  })

  it('supports multiple controlled mode', async (t) => {
    let changes: string[][] = []

    function App(handle: Handle) {
      let value = ['account']
      return () =>
        example({
          multiple: true,
          value,
          onValueChange(next) {
            changes.push(next)
            value = next
            void handle.update()
          },
        })
    }

    let { act, buttons, expanded } = setup(t, <App />)

    await act(() => buttons()[2].click())
    expect(changes).toEqual([['account', 'billing']])
    expect(expanded()).toEqual(['true', 'false', 'true'])
  })

  it('calls the item onOpenChange before the root onValueChange', async (t) => {
    let calls: string[] = []
    let { act, buttons } = setup(
      t,
      <TestAccordion onValueChange={(value) => calls.push(`root:${value.join(',')}`)}>
        <TestItem
          value="a"
          title="A"
          onOpenChange={(open, event) => {
            calls.push(`item:${open}`)
            expect(event).toBeInstanceOf(MouseEvent)
          }}
        />
      </TestAccordion>,
    )

    await act(() => buttons()[0].click())
    await act(() => buttons()[0].click())
    expect(calls).toEqual(['item:true', 'root:a', 'item:false', 'root:'])
  })

  it('supports disabled root and disabled items', async (t) => {
    let { buttons, $, panels } = setup(t, example({ disabled: true }))

    expect(buttons().map((button) => button.disabled)).toEqual([true, true, true])
    expect($('.root')?.getAttribute('data-disabled')).toBe('')
    expect(buttons()[0].getAttribute('data-disabled')).toBe('')
    expect(panels()[0].getAttribute('data-disabled')).toBe('')
  })

  it('disables single items', async (t) => {
    let { buttons, $$, expanded, act } = setup(t, example())

    expect(buttons().map((button) => button.disabled)).toEqual([false, true, false])
    expect($$('.item')[1].getAttribute('data-disabled')).toBe('')
    expect($$('.item')[0].hasAttribute('data-disabled')).toBe(false)

    await act(() =>
      buttons()[1].dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })),
    )
    expect(expanded()).toEqual(['false', 'false', 'false'])
  })

  it('links triggers and panels with ARIA attributes', (t) => {
    let { buttons, panels } = setup(t, example())

    buttons().forEach((button, index) => {
      let panel = panels()[index]
      expect(button.getAttribute('type')).toBe('button')
      expect(button.id).not.toBe('')
      expect(button.getAttribute('aria-controls')).toBe(panel.id)
      expect(panel.getAttribute('role')).toBe('region')
      expect(panel.getAttribute('aria-labelledby')).toBe(button.id)
    })
  })

  it('labels the panel with an explicit trigger id', (t) => {
    let { buttons, panels } = setup(
      t,
      <accordion.Context>
        <accordion.ItemContext value="a">
          <button id="custom-trigger" mix={accordion.trigger()}>
            A
          </button>
          <div class="panel" mix={accordion.panel()}>
            A content
          </div>
        </accordion.ItemContext>
      </accordion.Context>,
    )

    expect(buttons()[0].id).toBe('custom-trigger')
    expect(panels()[0].getAttribute('aria-labelledby')).toBe('custom-trigger')
  })

  it('sets state data attributes on every part', async (t) => {
    let { act, buttons, panels, $, $$ } = setup(t, example({ defaultValue: ['billing'] }))

    let root = $('.root')!
    expect(root.getAttribute('data-orientation')).toBe('vertical')

    let items = [...$$('.item')]
    let headers = [...$$('h3')]
    expect(items.map((item) => item.getAttribute('data-index'))).toEqual(['0', '1', '2'])
    expect(headers.map((header) => header.getAttribute('data-index'))).toEqual(['0', '1', '2'])
    expect(buttons().map((button) => button.getAttribute('data-index'))).toEqual(['0', '1', '2'])
    expect(panels().map((panel) => panel.getAttribute('data-index'))).toEqual(['0', '1', '2'])

    expect(items[2].getAttribute('data-open')).toBe('')
    expect(headers[2].getAttribute('data-open')).toBe('')
    expect(buttons()[2].getAttribute('data-panel-open')).toBe('')
    expect(panels()[2].getAttribute('data-open')).toBe('')
    expect(panels()[2].getAttribute('data-orientation')).toBe('vertical')
    expect(panels()[2].hasAttribute('hidden')).toBe(false)

    expect(items[0].hasAttribute('data-open')).toBe(false)
    expect(buttons()[0].hasAttribute('data-panel-open')).toBe(false)
    expect(panels()[0].getAttribute('data-closed')).toBe('')
    expect(panels()[0].hasAttribute('hidden')).toBe(true)

    await act(() => buttons()[0].click())
    expect(items[0].getAttribute('data-open')).toBe('')
    expect(items[2].hasAttribute('data-open')).toBe(false)
    expect(panels()[2].getAttribute('data-closed')).toBe('')
    await waitFor(() => panels()[2].hasAttribute('hidden'))
  })

  it('supports arrow, Home, and End keyboard navigation', (t) => {
    let { buttons } = setup(t, example())
    let [account, , billing] = buttons()

    account.focus()
    key(account, 'ArrowDown')
    expect(document.activeElement).toBe(billing)

    key(billing, 'ArrowDown')
    expect(document.activeElement).toBe(account)

    key(account, 'ArrowUp')
    expect(document.activeElement).toBe(billing)

    key(billing, 'Home')
    expect(document.activeElement).toBe(account)

    key(account, 'End')
    expect(document.activeElement).toBe(billing)

    // Horizontal arrows do nothing in a vertical accordion.
    key(billing, 'ArrowRight')
    expect(document.activeElement).toBe(billing)
  })

  it('stops at the ends when loopFocus is false', (t) => {
    let { buttons } = setup(t, example({ loopFocus: false }))
    let [account, , billing] = buttons()

    billing.focus()
    key(billing, 'ArrowDown')
    expect(document.activeElement).toBe(billing)

    key(billing, 'ArrowUp')
    expect(document.activeElement).toBe(account)
    key(account, 'ArrowUp')
    expect(document.activeElement).toBe(account)
  })

  it('uses Left/Right in horizontal orientation, respecting RTL', (t) => {
    let { buttons, $, panels } = setup(t, example({ orientation: 'horizontal' }))
    let [account, , billing] = buttons()

    expect($('.root')?.getAttribute('data-orientation')).toBe('horizontal')
    expect(panels()[0].getAttribute('data-orientation')).toBe('horizontal')

    account.focus()
    key(account, 'ArrowDown')
    expect(document.activeElement).toBe(account)

    key(account, 'ArrowRight')
    expect(document.activeElement).toBe(billing)
    key(billing, 'ArrowLeft')
    expect(document.activeElement).toBe(account)

    $('.root')!.setAttribute('dir', 'rtl')
    key(account, 'ArrowLeft')
    expect(document.activeElement).toBe(billing)
  })

  it('dispatches a bubbling change event from the root', async (t) => {
    let events: AccordionChangeEvent[] = []
    let { act, buttons, $ } = setup(
      t,
      <div
        mix={onAccordionChange((event) => {
          events.push(event as AccordionChangeEvent)
        })}
      >
        {example({ multiple: true })}
      </div>,
    )

    await act(() => buttons()[2].click())
    await act(() => buttons()[0].click())
    await act(() => buttons()[2].click())

    expect(events.length).toBe(3)
    expect(events[0]).toBeInstanceOf(AccordionChangeEvent)
    expect(events[0].type).toBe('stems:accordion-change')
    expect(events[0].target).toBe($('.root'))
    expect(events.map((event) => [event.itemValue, event.open, event.value])).toEqual([
      ['billing', true, ['billing']],
      ['account', true, ['billing', 'account']],
      ['billing', false, ['account']],
    ])
  })

  it('generates item values when none is given', async (t) => {
    let values: string[][] = []
    let { act, buttons } = setup(
      t,
      <TestAccordion onValueChange={(value) => values.push(value)}>
        <TestItem title="A" />
      </TestAccordion>,
    )

    await act(() => buttons()[0].click())
    expect(values.length).toBe(1)
    expect(values[0].length).toBe(1)
    expect(typeof values[0][0]).toBe('string')
    expect(buttons()[0].getAttribute('aria-expanded')).toBe('true')
  })

  it('animates panels with starting/ending styles and CSS variables', async (t) => {
    addStyle(
      t,
      `.panel { height: var(--accordion-panel-height); overflow: hidden; transition: height 60ms linear; }
       .panel[data-starting-style], .panel[data-ending-style] { height: 0; }`,
    )
    let { act, buttons, panels } = setup(t, example({ defaultValue: ['account'] }))
    let [account, billing] = [panels()[0], panels()[2]]

    expect(account.style.getPropertyValue('--accordion-panel-height')).toBe('auto')

    await act(() => buttons()[2].click())
    expect(billing.getAttribute('data-starting-style')).toBe('')
    expect(billing.style.getPropertyValue('--accordion-panel-height')).toBe('40px')
    expect(billing.style.getPropertyValue('--accordion-panel-width')).toMatch(/^\d+px$/)
    expect(account.getAttribute('data-ending-style')).toBe('')
    expect(account.style.getPropertyValue('--accordion-panel-height')).toBe('40px')
    expect(account.hasAttribute('hidden')).toBe(false)

    await waitFor(() => !billing.hasAttribute('data-starting-style'))
    await waitFor(() => account.hasAttribute('hidden'))
    expect(account.hasAttribute('data-ending-style')).toBe(false)
    await waitFor(() => billing.style.getPropertyValue('--accordion-panel-height') === 'auto')
  })

  it('opens hidden-until-found panels on beforematch', async (t) => {
    let changes: string[][] = []
    let { act, panels, expanded } = setup(
      t,
      example({ hiddenUntilFound: true, onValueChange: (value) => changes.push(value) }),
    )

    expect(panels().map((panel) => panel.getAttribute('hidden'))).toEqual([
      'until-found',
      'until-found',
      'until-found',
    ])

    await act(() => {
      panels()[2].removeAttribute('hidden')
      panels()[2].dispatchEvent(new Event('beforematch', { bubbles: true }))
    })

    expect(changes).toEqual([['billing']])
    expect(expanded()).toEqual(['false', 'false', 'true'])
    expect(panels()[2].hasAttribute('data-starting-style')).toBe(false)
  })

  it('lets panel options override the root hiddenUntilFound', (t) => {
    let { panels } = setup(
      t,
      <accordion.Context hiddenUntilFound>
        <accordion.ItemContext value="a">
          <button mix={accordion.trigger()}>A</button>
          <div class="panel" mix={accordion.panel({ hiddenUntilFound: false })}>
            A content
          </div>
        </accordion.ItemContext>
      </accordion.Context>,
    )

    expect(panels()[0].getAttribute('hidden')).toBe('')
  })
  it('collapses a closed until-found panel when another item opens', async (t) => {
    // Regression: the closed panel kept its last measured height because `hidden="until-found"`
    // only applies content-visibility (the box stays laid out).
    addStyle(
      t,
      `.panel { height: var(--accordion-panel-height); overflow: hidden; transition: height 40ms linear; }
       .panel[data-starting-style], .panel[data-ending-style] { height: 0; }`,
    )
    let { act, buttons, panels } = setup(
      t,
      example({ defaultValue: ['account'], hiddenUntilFound: true }),
    )
    await waitFor(() => panels()[0].getBoundingClientRect().height === 40)

    await act(() => buttons()[2].click())
    await waitFor(() => panels()[0].getAttribute('hidden') === 'until-found')
    await waitFor(() => panels()[2].style.getPropertyValue('--accordion-panel-height') === 'auto')

    expect(panels()[0].getBoundingClientRect().height).toBe(0)
    expect(panels()[2].getBoundingClientRect().height).toBe(40)
  })
})
