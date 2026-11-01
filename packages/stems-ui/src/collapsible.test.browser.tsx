import { expect } from 'remix/assert'
import { describe, it } from 'remix/test'
import type { Handle } from 'remix/component'
import { render } from 'remix/component/test'

import * as collapsible from './collapsible.ts'
import { CollapsibleChangeEvent, onCollapsibleChange } from './collapsible.ts'

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

function addStyle(t: { after(fn: () => void): void }, css: string) {
  let style = document.createElement('style')
  style.textContent = css
  document.head.append(style)
  t.after(() => style.remove())
}

type ExampleProps = collapsible.CollapsibleContextProps & {
  panel?: collapsible.CollapsiblePanelOptions
}

function Example(handle: Handle<ExampleProps>) {
  return () => {
    let { panel, children: _children, ...props } = handle.props
    return (
      <collapsible.Context {...props}>
        <div mix={collapsible.root()}>
          <button mix={collapsible.trigger()}>Recovery keys</button>
          <div class="panel" mix={collapsible.panel(panel)}>
            <div style={{ height: '80px' }}>alien-bean-pasta</div>
          </div>
        </div>
      </collapsible.Context>
    )
  }
}

function setup(t: { after(fn: () => void): void }, props: ExampleProps = {}) {
  let result = render(<Example {...props} />)
  t.after(result.cleanup)
  let trigger = result.$('button') as HTMLButtonElement
  let panel = result.$('.panel') as HTMLDivElement
  let root = result.container.firstElementChild as HTMLDivElement
  return { ...result, trigger, panel, root }
}

describe('collapsible', () => {
  it('links the trigger and the panel', (t) => {
    let { trigger, panel } = setup(t)

    expect(trigger.getAttribute('type')).toBe('button')
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(panel.id).not.toBe('')
    expect(trigger.getAttribute('aria-controls')).toBe(panel.id)
    expect(trigger.hasAttribute('data-panel-open')).toBe(false)
    expect(panel.hasAttribute('hidden')).toBe(true)
    expect(panel.getAttribute('data-closed')).toBe('')
    expect(panel.hasAttribute('data-open')).toBe(false)
  })

  it('renders initially open with defaultOpen', (t) => {
    let { trigger, panel, root } = setup(t, { defaultOpen: true })

    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(trigger.getAttribute('data-panel-open')).toBe('')
    expect(panel.hasAttribute('hidden')).toBe(false)
    expect(panel.getAttribute('data-open')).toBe('')
    expect(panel.hasAttribute('data-closed')).toBe(false)
    expect(panel.hasAttribute('data-starting-style')).toBe(false)
    expect(root.getAttribute('data-open')).toBe('')
    expect(panel.style.getPropertyValue('--collapsible-panel-height')).toBe('auto')
  })

  it('toggles uncontrolled state', async (t) => {
    let { act, trigger, panel, root } = setup(t)

    await act(() => trigger.click())
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(trigger.getAttribute('data-panel-open')).toBe('')
    expect(panel.hasAttribute('hidden')).toBe(false)
    expect(panel.getAttribute('data-open')).toBe('')
    expect(root.getAttribute('data-open')).toBe('')

    await act(() => trigger.click())
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(trigger.hasAttribute('data-panel-open')).toBe(false)
    expect(panel.getAttribute('data-closed')).toBe('')
    expect(root.getAttribute('data-closed')).toBe('')

    await waitFor(() => panel.hasAttribute('hidden'))
    expect(panel.hasAttribute('data-ending-style')).toBe(false)
  })

  it('supports controlled state', async (t) => {
    let changes: boolean[] = []
    let open = false
    let owner: Handle | undefined

    function App(handle: Handle) {
      owner = handle
      return () => (
        <Example
          open={open}
          onOpenChange={(next, event) => {
            changes.push(next)
            expect(event).toBeInstanceOf(MouseEvent)
          }}
        />
      )
    }

    let result = render(<App />)
    t.after(result.cleanup)
    let trigger = result.$('button') as HTMLButtonElement

    await result.act(() => trigger.click())
    expect(changes).toEqual([true])
    // The owner has not updated `open` yet.
    expect(trigger.getAttribute('aria-expanded')).toBe('false')

    open = true
    await result.act(() => owner!.update())
    expect(trigger.getAttribute('aria-expanded')).toBe('true')

    await result.act(() => trigger.click())
    expect(changes).toEqual([true, false])
  })

  it('ignores interaction when disabled', async (t) => {
    let changes: boolean[] = []
    let { act, trigger, root } = setup(t, {
      disabled: true,
      onOpenChange: (open) => changes.push(open),
    })

    expect(trigger.disabled).toBe(true)
    expect(trigger.getAttribute('data-disabled')).toBe('')
    expect(root.getAttribute('data-disabled')).toBe('')

    await act(() => trigger.dispatchEvent(new MouseEvent('click', { bubbles: true })))
    expect(changes).toEqual([])
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
  })

  it('dispatches a bubbling change event from the root', async (t) => {
    let events: CollapsibleChangeEvent[] = []
    let result = render(
      <div
        mix={onCollapsibleChange((event) => {
          events.push(event as CollapsibleChangeEvent)
        })}
      >
        <Example />
      </div>,
    )
    t.after(result.cleanup)
    let trigger = result.$('button') as HTMLButtonElement

    await result.act(() => trigger.click())
    expect(events.length).toBe(1)
    expect(events[0]).toBeInstanceOf(CollapsibleChangeEvent)
    expect(events[0].type).toBe('stems:collapsible-change')
    expect(events[0].open).toBe(true)
    expect(events[0].target).toBe(result.container.querySelector('[data-open]'))

    await result.act(() => trigger.click())
    expect(events.map((event) => event.open)).toEqual([true, false])
  })

  it('dispatches from the trigger when there is no root element', async (t) => {
    let events: CollapsibleChangeEvent[] = []
    let result = render(
      <div
        mix={onCollapsibleChange((event) => {
          events.push(event as CollapsibleChangeEvent)
        })}
      >
        <collapsible.Context>
          <button mix={collapsible.trigger()}>Toggle</button>
          <div mix={collapsible.panel()}>Content</div>
        </collapsible.Context>
      </div>,
    )
    t.after(result.cleanup)
    let trigger = result.$('button') as HTMLButtonElement

    await result.act(() => trigger.click())
    expect(events.length).toBe(1)
    expect(events[0].target).toBe(trigger)
  })

  it('sets starting and ending styles around transitions', async (t) => {
    addStyle(
      t,
      `.panel { height: var(--collapsible-panel-height); overflow: hidden; transition: height 80ms linear; }
       .panel[data-starting-style], .panel[data-ending-style] { height: 0; }`,
    )
    let { act, trigger, panel } = setup(t)

    await act(() => trigger.click())
    expect(panel.hasAttribute('hidden')).toBe(false)
    expect(panel.getAttribute('data-starting-style')).toBe('')
    expect(panel.style.getPropertyValue('--collapsible-panel-height')).toBe('80px')

    await waitFor(() => !panel.hasAttribute('data-starting-style'))
    // Animating from 0 to the measured height.
    expect(panel.getAnimations().length).toBe(1)
    expect(panel.style.getPropertyValue('--collapsible-panel-height')).toBe('80px')

    await waitFor(() => panel.style.getPropertyValue('--collapsible-panel-height') === 'auto')
    expect(panel.getBoundingClientRect().height).toBe(80)

    await act(() => trigger.click())
    expect(panel.getAttribute('data-ending-style')).toBe('')
    expect(panel.getAttribute('data-closed')).toBe('')
    expect(panel.hasAttribute('hidden')).toBe(false)
    expect(panel.style.getPropertyValue('--collapsible-panel-height')).toBe('80px')

    await nextFrame()
    await nextFrame()
    // Still animating out.
    expect(panel.hasAttribute('hidden')).toBe(false)
    expect(panel.getAttribute('data-ending-style')).toBe('')

    await waitFor(() => panel.hasAttribute('hidden'))
    expect(panel.hasAttribute('data-ending-style')).toBe(false)
  })

  it('reverses a closing panel without hiding it', async (t) => {
    addStyle(
      t,
      `.panel { height: var(--collapsible-panel-height); overflow: hidden; transition: height 200ms linear; }
       .panel[data-starting-style], .panel[data-ending-style] { height: 0; }`,
    )
    let { act, trigger, panel } = setup(t, { defaultOpen: true })

    await act(() => trigger.click())
    expect(panel.getAttribute('data-ending-style')).toBe('')
    await nextFrame()
    await nextFrame()

    await act(() => trigger.click())
    expect(panel.hasAttribute('data-ending-style')).toBe(false)
    expect(panel.hasAttribute('data-starting-style')).toBe(false)
    expect(panel.getAttribute('data-open')).toBe('')

    await waitFor(() => panel.style.getPropertyValue('--collapsible-panel-height') === 'auto')
    expect(panel.hasAttribute('hidden')).toBe(false)
  })

  it('hides closed panels until found and opens them on beforematch', async (t) => {
    let changes: boolean[] = []
    let { act, trigger, panel } = setup(t, {
      panel: { hiddenUntilFound: true },
      onOpenChange: (open) => changes.push(open),
    })

    expect(panel.getAttribute('hidden')).toBe('until-found')

    await act(() => {
      // The browser removes `hidden` before firing `beforematch`.
      panel.removeAttribute('hidden')
      panel.dispatchEvent(new Event('beforematch', { bubbles: true }))
    })

    expect(changes).toEqual([true])
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(panel.hasAttribute('hidden')).toBe(false)
    expect(panel.hasAttribute('data-starting-style')).toBe(false)

    await act(() => trigger.click())
    await waitFor(() => panel.hasAttribute('hidden'))
    expect(panel.getAttribute('hidden')).toBe('until-found')
  })

  it('collapses an until-found panel to zero height after closing', async (t) => {
    // `hidden="until-found"` uses content-visibility, not display: none, so the panel keeps the
    // height its CSS gives it. The size variables must not keep the last measured height.
    addStyle(
      t,
      `.panel { height: var(--collapsible-panel-height); overflow: hidden; transition: height 40ms linear; }
       .panel[data-starting-style], .panel[data-ending-style] { height: 0; }`,
    )
    let { act, trigger, panel } = setup(t, { defaultOpen: true, panel: { hiddenUntilFound: true } })
    expect(panel.getBoundingClientRect().height).toBe(80)

    await act(() => trigger.click())
    await waitFor(() => panel.getAttribute('hidden') === 'until-found')
    expect(panel.getBoundingClientRect().height).toBe(0)

    // Find-in-page reveals it at full height again.
    await act(() => {
      panel.removeAttribute('hidden')
      panel.dispatchEvent(new Event('beforematch', { bubbles: true }))
    })
    expect(panel.getBoundingClientRect().height).toBe(80)
  })

  it('restores hidden="until-found" when a controlled owner stays closed', async (t) => {
    let { act, panel } = setup(t, { open: false, panel: { hiddenUntilFound: true } })

    await act(() => {
      panel.removeAttribute('hidden')
      panel.dispatchEvent(new Event('beforematch', { bubbles: true }))
    })
    await waitFor(() => panel.getAttribute('hidden') === 'until-found')
  })

  it('uses the latest panel options when a transition finishes', async (t) => {
    let hiddenUntilFound = false
    let owner: Handle | undefined
    function App(handle: Handle) {
      owner = handle
      return () => <Example defaultOpen panel={{ hiddenUntilFound }} />
    }
    let result = render(<App />)
    t.after(result.cleanup)
    let trigger = result.$('button') as HTMLButtonElement
    let panel = result.$('.panel') as HTMLDivElement

    await result.act(() => trigger.click())
    hiddenUntilFound = true
    await result.act(() => owner!.update())

    await waitFor(() => panel.hasAttribute('hidden'))
    expect(panel.getAttribute('hidden')).toBe('until-found')
  })

  it('wires non-button triggers for keyboard use', async (t) => {
    let result = render(
      <collapsible.Context>
        <div mix={collapsible.trigger()}>Toggle</div>
        <div class="panel" mix={collapsible.panel()}>
          Content
        </div>
      </collapsible.Context>,
    )
    t.after(result.cleanup)
    let trigger = result.$('[role="button"]') as HTMLDivElement

    expect(trigger.tabIndex).toBe(0)
    expect(trigger.hasAttribute('type')).toBe(false)

    await result.act(() =>
      trigger.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' })),
    )
    expect(trigger.getAttribute('aria-expanded')).toBe('true')

    await result.act(() =>
      trigger.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: ' ' })),
    )
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
  })

  it('lets explicit host props win', (t) => {
    let result = render(
      <collapsible.Context>
        <button type="submit" aria-controls="custom" mix={collapsible.trigger()}>
          Toggle
        </button>
        <div mix={collapsible.panel()}>Content</div>
      </collapsible.Context>,
    )
    t.after(result.cleanup)
    let trigger = result.$('button') as HTMLButtonElement

    expect(trigger.getAttribute('type')).toBe('submit')
    expect(trigger.getAttribute('aria-controls')).toBe('custom')
  })
})
