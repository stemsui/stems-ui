// Adapted from @remix-run/ui 0.13.0 (packages/ui/src/tabs.test.tsx).
// https://github.com/remix-run/remix - Copyright (c) 2025 Shopify Inc. MIT License.

import { expect } from 'remix/assert'
import { describe, it } from 'remix/test'
import type { Handle, RemixNode } from 'remix/component'
import { render } from 'remix/component/test'

import * as tabs from './tabs.ts'
import { TabsChangeEvent, onTabsChange, type TabsContextProps } from './tabs.ts'

type ExampleProps = TabsContextProps & {
  listOptions?: tabs.TabsListOptions
  dir?: 'ltr' | 'rtl'
  indicator?: boolean
}

function ExampleTabs(handle: Handle<ExampleProps>) {
  return () => {
    let { listOptions, dir, indicator, children, ...contextProps } = handle.props
    return (
      <div dir={dir}>
        <tabs.Context {...contextProps}>
          <div mix={tabs.root()}>{children}</div>
        </tabs.Context>
      </div>
    )
  }
}

function TestTab(handle: Handle<{ children?: RemixNode; disabled?: boolean; value: string }>) {
  return () => {
    let { children, disabled, value } = handle.props
    return <button mix={tabs.tab({ disabled, value })}>{children}</button>
  }
}

function TestPanel(handle: Handle<{ children?: RemixNode; value: string }>) {
  return () => <div mix={tabs.panel({ value: handle.props.value })}>{handle.props.children}</div>
}

function threeTabs(props: ExampleProps = {}) {
  let { listOptions, ...rest } = props
  return (
    <ExampleTabs {...rest}>
      <div mix={tabs.list(listOptions)}>
        <TestTab value="overview">Overview</TestTab>
        <TestTab value="activity">Activity</TestTab>
        <TestTab disabled value="settings">
          Settings
        </TestTab>
      </div>
      <TestPanel value="overview">Project summary.</TestPanel>
      <TestPanel value="activity">Recent changes.</TestPanel>
      <TestPanel value="settings">Private controls.</TestPanel>
    </ExampleTabs>
  )
}

function fourTabs(props: ExampleProps = {}) {
  let { listOptions, ...rest } = props
  return (
    <ExampleTabs {...rest}>
      <div mix={tabs.list(listOptions)}>
        <TestTab value="a">A</TestTab>
        <TestTab disabled value="b">
          B
        </TestTab>
        <TestTab value="c">C</TestTab>
        <TestTab value="d">D</TestTab>
      </div>
      <TestPanel value="a">Panel A</TestPanel>
      <TestPanel value="b">Panel B</TestPanel>
      <TestPanel value="c">Panel C</TestPanel>
      <TestPanel value="d">Panel D</TestPanel>
    </ExampleTabs>
  )
}

function getTabs(container: ParentNode) {
  return [...container.querySelectorAll('[role="tab"]')] as HTMLButtonElement[]
}

function getPanels(container: ParentNode) {
  return [...container.querySelectorAll('[role="tabpanel"]')] as HTMLDivElement[]
}

function selected(container: ParentNode) {
  return getTabs(container)
    .filter((tab) => tab.getAttribute('aria-selected') === 'true')
    .map((tab) => tab.textContent)
}

function press(target: Element, key: string) {
  target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key }))
}

function nextFrame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
}

describe('tabs', () => {
  describe('ported from @remix-run/ui', () => {
    it('supports uncontrolled mode with a default value', async (t) => {
      let changes: string[] = []
      let { container, act, cleanup } = render(
        threeTabs({ defaultValue: 'activity', onValueChange: (value) => changes.push(value) }),
      )
      t.after(cleanup)

      let tabButtons = getTabs(container)
      let panels = getPanels(container)
      expect(tabButtons[0].getAttribute('aria-selected')).toBe('false')
      expect(tabButtons[1].getAttribute('aria-selected')).toBe('true')
      expect(tabButtons[1].hasAttribute('data-active')).toBe(true)
      expect(panels[0].hidden).toBe(true)
      expect(panels[1].hidden).toBe(false)

      await act(() => tabButtons[0].click())

      expect(changes).toEqual(['overview'])
      expect(tabButtons[0].getAttribute('aria-selected')).toBe('true')
      expect(tabButtons[1].getAttribute('aria-selected')).toBe('false')
      expect(panels[0].hidden).toBe(false)
      expect(panels[1].hidden).toBe(true)
    })

    it('uses the first enabled tab when no default value is provided', (t) => {
      let { container, cleanup } = render(
        <ExampleTabs>
          <div mix={tabs.list()}>
            <TestTab disabled value="disabled">
              Disabled
            </TestTab>
            <TestTab value="first-enabled">First enabled</TestTab>
          </div>
          <TestPanel value="disabled">Disabled content.</TestPanel>
          <TestPanel value="first-enabled">Enabled content.</TestPanel>
        </ExampleTabs>,
      )
      t.after(cleanup)

      let tabButtons = getTabs(container)
      let panels = getPanels(container)
      expect(tabButtons[0].getAttribute('aria-selected')).toBe('false')
      expect(tabButtons[1].getAttribute('aria-selected')).toBe('true')
      expect(panels[0].hidden).toBe(true)
      expect(panels[1].hidden).toBe(false)
    })

    it('supports controlled mode', async (t) => {
      let changes: string[] = []

      function App(handle: Handle) {
        let value = 'overview'
        return () =>
          threeTabs({
            value,
            onValueChange(next) {
              changes.push(next)
              value = next
              void handle.update()
            },
          })
      }

      let { container, act, cleanup } = render(<App />)
      t.after(cleanup)

      await act(() => getTabs(container)[1].click())

      expect(changes).toEqual(['activity'])
      expect(selected(container)).toEqual(['Activity'])
    })

    it('dispatches a bubbling change event', async (t) => {
      let captured: TabsChangeEvent | null = null
      let { container, act, cleanup } = render(
        <div
          mix={onTabsChange((event) => {
            captured = event
          })}
        >
          {threeTabs({ defaultValue: 'overview' })}
        </div>,
      )
      t.after(cleanup)

      await act(() => getTabs(container)[1].click())

      let event = captured as TabsChangeEvent | null
      expect(event).toBeInstanceOf(TabsChangeEvent)
      expect(event?.type).toBe('stems:tabs-change')
      expect(event?.bubbles).toBe(true)
      expect(event?.value).toBe('activity')
      expect(event?.previousValue).toBe('overview')
      expect(event?.activationDirection).toBe('right')
      expect(event?.target).toBe(getTabs(container)[1])
    })

    it('uses Home and End to move to the first and last enabled tabs', async (t) => {
      let { container, act, cleanup } = render(
        threeTabs({ defaultValue: 'overview', listOptions: { activateOnFocus: true } }),
      )
      t.after(cleanup)

      let tabButtons = getTabs(container)
      tabButtons[0].focus()
      await act(() => press(tabButtons[0], 'End'))
      expect(document.activeElement).toBe(tabButtons[1])
      expect(selected(container)).toEqual(['Activity'])

      await act(() => press(tabButtons[1], 'Home'))
      expect(document.activeElement).toBe(tabButtons[0])
      expect(selected(container)).toEqual(['Overview'])
    })

    it('supports Enter and Space activation', async (t) => {
      let { container, act, cleanup } = render(threeTabs({ defaultValue: 'overview' }))
      t.after(cleanup)

      let tabButtons = getTabs(container)
      tabButtons[1].focus()
      await act(() => press(tabButtons[1], 'Enter'))
      expect(selected(container)).toEqual(['Activity'])

      tabButtons[0].focus()
      await act(() => press(tabButtons[0], ' '))
      expect(selected(container)).toEqual(['Overview'])
    })

    it('does not activate disabled tabs', async (t) => {
      let changes: string[] = []
      let { container, act, cleanup } = render(
        threeTabs({ defaultValue: 'overview', onValueChange: (value) => changes.push(value) }),
      )
      t.after(cleanup)

      let tabButtons = getTabs(container)
      await act(() => tabButtons[2].click())

      expect(changes).toEqual([])
      expect(selected(container)).toEqual(['Overview'])
      expect(tabButtons[2].disabled).toBe(true)
      expect(tabButtons[2].hasAttribute('data-disabled')).toBe(true)
    })
  })

  describe('ARIA', () => {
    it('wires roles, ids, and roving tabindex', (t) => {
      let { container, cleanup } = render(threeTabs({ defaultValue: 'activity' }))
      t.after(cleanup)

      let list = container.querySelector('[role="tablist"]')
      expect(list).toBeTruthy()
      expect(list?.hasAttribute('aria-orientation')).toBe(false)

      let tabButtons = getTabs(container)
      let panels = getPanels(container)
      tabButtons.forEach((tab, i) => {
        expect(tab.type).toBe('button')
        expect(tab.getAttribute('aria-controls')).toBe(panels[i].id)
        expect(panels[i].getAttribute('aria-labelledby')).toBe(tab.id)
      })
      expect(tabButtons.map((tab) => tab.tabIndex)).toEqual([-1, 0, -1])
      expect(panels.map((panel) => panel.tabIndex)).toEqual([-1, 0, -1])
      expect(panels[0].inert).toBe(true)
      expect(panels[1].inert).toBe(false)
    })

    it('uses aria-disabled for non-button hosts', (t) => {
      let { container, cleanup } = render(
        <ExampleTabs defaultValue="a">
          <div mix={tabs.list()}>
            <span mix={tabs.tab({ value: 'a' })}>A</span>
            <span mix={tabs.tab({ value: 'b', disabled: true })}>B</span>
          </div>
        </ExampleTabs>,
      )
      t.after(cleanup)

      let [a, b] = getTabs(container)
      expect(a.hasAttribute('type')).toBe(false)
      expect(b.getAttribute('aria-disabled')).toBe('true')
      expect(b.hasAttribute('disabled')).toBe(false)
    })

    it('lets explicit host props win', (t) => {
      let { container, cleanup } = render(
        <ExampleTabs defaultValue="a">
          <div mix={tabs.list()}>
            <button id="custom-id" mix={tabs.tab({ value: 'a' })}>
              A
            </button>
          </div>
        </ExampleTabs>,
      )
      t.after(cleanup)

      expect(getTabs(container)[0].id).toBe('custom-id')
    })
  })

  describe('activation', () => {
    it('moves focus without activating by default (manual activation)', async (t) => {
      let changes: string[] = []
      let { container, act, cleanup } = render(
        threeTabs({ defaultValue: 'overview', onValueChange: (value) => changes.push(value) }),
      )
      t.after(cleanup)

      let tabButtons = getTabs(container)
      tabButtons[0].focus()
      await act(() => press(tabButtons[0], 'ArrowRight'))

      expect(document.activeElement).toBe(tabButtons[1])
      expect(selected(container)).toEqual(['Overview'])
      expect(changes).toEqual([])
      // The active tab stays the tab stop.
      expect(tabButtons[0].tabIndex).toBe(0)

      await act(() => press(tabButtons[1], 'Enter'))
      expect(selected(container)).toEqual(['Activity'])
      expect(changes).toEqual(['activity'])
    })

    it('activates on arrow focus with activateOnFocus', async (t) => {
      let { container, act, cleanup } = render(
        threeTabs({ defaultValue: 'overview', listOptions: { activateOnFocus: true } }),
      )
      t.after(cleanup)

      let tabButtons = getTabs(container)
      let panels = getPanels(container)
      tabButtons[0].focus()
      await act(() => press(tabButtons[0], 'ArrowRight'))

      expect(document.activeElement).toBe(tabButtons[1])
      expect(selected(container)).toEqual(['Activity'])
      expect(panels[0].hidden).toBe(true)
      expect(panels[1].hidden).toBe(false)

      // Wraps past the disabled tab back to the first.
      await act(() => press(tabButtons[1], 'ArrowRight'))
      expect(document.activeElement).toBe(tabButtons[0])
      expect(selected(container)).toEqual(['Overview'])
    })

    it('supports no active tab with a null value', async (t) => {
      let { container, act, cleanup } = render(threeTabs({ defaultValue: null }))
      t.after(cleanup)

      expect(selected(container)).toEqual([])
      expect(getPanels(container).every((panel) => panel.hidden)).toBe(true)
      // The first enabled tab is the tab stop.
      expect(getTabs(container).map((tab) => tab.tabIndex)).toEqual([0, -1, -1])

      await act(() => getTabs(container)[1].click())
      expect(selected(container)).toEqual(['Activity'])
    })

    it('does not change state in controlled mode until the value prop changes', async (t) => {
      let changes: string[] = []
      let { container, act, cleanup } = render(
        threeTabs({ value: 'overview', onValueChange: (value) => changes.push(value) }),
      )
      t.after(cleanup)

      await act(() => getTabs(container)[1].click())

      expect(changes).toEqual(['activity'])
      expect(selected(container)).toEqual(['Overview'])
    })

    it('exposes state and activate() through the context', async (t) => {
      let api: tabs.TabsContextValue | null = null

      function Probe(handle: Handle) {
        return () => {
          api = handle.context.get(tabs.Context)
          return <output>{api.value}</output>
        }
      }

      let { container, act, cleanup } = render(
        <ExampleTabs defaultValue="a">
          <div mix={tabs.list()}>
            <TestTab value="a">A</TestTab>
            <TestTab value="b">B</TestTab>
          </div>
          <Probe />
        </ExampleTabs>,
      )
      t.after(cleanup)

      expect(container.querySelector('output')?.textContent).toBe('a')
      await act(() => (api as tabs.TabsContextValue | null)?.activate('b'))
      expect(container.querySelector('output')?.textContent).toBe('b')
      expect(selected(container)).toEqual(['B'])
    })
  })

  describe('mixins without arguments', () => {
    it('uses list defaults and never reads host props as options', async (t) => {
      // `list()` gets the host props in its first render slot; a stray host prop named like an
      // option must not switch on automatic activation or turn off looping.
      let hostProps = { activateOnFocus: true, loopFocus: false } as Record<string, unknown>
      let { container, act, cleanup } = render(
        <ExampleTabs defaultValue="a">
          <div {...hostProps} mix={tabs.list()}>
            <TestTab value="a">A</TestTab>
            <TestTab value="b">B</TestTab>
            <span mix={tabs.indicator()} />
          </div>
        </ExampleTabs>,
      )
      t.after(cleanup)

      let [a, b] = getTabs(container)
      a.focus()
      await act(() => press(a, 'ArrowRight'))
      expect(document.activeElement).toBe(b)
      expect(selected(container)).toEqual(['A'])

      await act(() => press(b, 'ArrowRight'))
      expect(document.activeElement).toBe(a)
    })
  })

  describe('keyboard', () => {
    it('skips disabled tabs', async (t) => {
      let { container, act, cleanup } = render(fourTabs({ defaultValue: 'a' }))
      t.after(cleanup)

      let tabButtons = getTabs(container)
      tabButtons[0].focus()
      await act(() => press(tabButtons[0], 'ArrowRight'))
      expect(document.activeElement).toBe(tabButtons[2])

      await act(() => press(tabButtons[2], 'ArrowLeft'))
      expect(document.activeElement).toBe(tabButtons[0])
    })

    it('loops focus by default', async (t) => {
      let { container, act, cleanup } = render(fourTabs({ defaultValue: 'a' }))
      t.after(cleanup)

      let tabButtons = getTabs(container)
      tabButtons[0].focus()
      await act(() => press(tabButtons[0], 'ArrowLeft'))
      expect(document.activeElement).toBe(tabButtons[3])
      await act(() => press(tabButtons[3], 'ArrowRight'))
      expect(document.activeElement).toBe(tabButtons[0])
    })

    it('stops at the ends with loopFocus: false', async (t) => {
      let { container, act, cleanup } = render(
        fourTabs({ defaultValue: 'a', listOptions: { loopFocus: false } }),
      )
      t.after(cleanup)

      let tabButtons = getTabs(container)
      tabButtons[0].focus()
      await act(() => press(tabButtons[0], 'ArrowLeft'))
      expect(document.activeElement).toBe(tabButtons[0])

      tabButtons[3].focus()
      await act(() => press(tabButtons[3], 'ArrowRight'))
      expect(document.activeElement).toBe(tabButtons[3])

      // Home/End still work.
      await act(() => press(tabButtons[3], 'Home'))
      expect(document.activeElement).toBe(tabButtons[0])
    })

    it('reverses horizontal arrows in RTL', async (t) => {
      let { container, act, cleanup } = render(fourTabs({ defaultValue: 'a', dir: 'rtl' }))
      t.after(cleanup)

      let tabButtons = getTabs(container)
      tabButtons[0].focus()
      await act(() => press(tabButtons[0], 'ArrowLeft'))
      expect(document.activeElement).toBe(tabButtons[2])
      await act(() => press(tabButtons[2], 'ArrowRight'))
      expect(document.activeElement).toBe(tabButtons[0])
    })

    it('uses Up/Down for vertical tabs and ignores Left/Right', async (t) => {
      let { container, act, cleanup } = render(
        fourTabs({ defaultValue: 'a', orientation: 'vertical' }),
      )
      t.after(cleanup)

      let list = container.querySelector('[role="tablist"]')
      expect(list?.getAttribute('aria-orientation')).toBe('vertical')
      expect(list?.getAttribute('data-orientation')).toBe('vertical')

      let tabButtons = getTabs(container)
      tabButtons[0].focus()
      await act(() => press(tabButtons[0], 'ArrowRight'))
      expect(document.activeElement).toBe(tabButtons[0])

      await act(() => press(tabButtons[0], 'ArrowDown'))
      expect(document.activeElement).toBe(tabButtons[2])
      await act(() => press(tabButtons[2], 'ArrowUp'))
      expect(document.activeElement).toBe(tabButtons[0])
    })

    it('ignores Up/Down for horizontal tabs', async (t) => {
      let { container, act, cleanup } = render(fourTabs({ defaultValue: 'a' }))
      t.after(cleanup)

      let tabButtons = getTabs(container)
      tabButtons[0].focus()
      let event = new KeyboardEvent('keydown', {
        bubbles: true,
        cancelable: true,
        key: 'ArrowDown',
      })
      await act(() => tabButtons[0].dispatchEvent(event))
      expect(document.activeElement).toBe(tabButtons[0])
      expect(event.defaultPrevented).toBe(false)
    })
  })

  describe('data attributes', () => {
    it('sets orientation and activation direction on every part', async (t) => {
      let { container, act, cleanup } = render(
        <ExampleTabs defaultValue="a">
          <div mix={tabs.list()} style={{ display: 'flex' }}>
            <TestTab value="a">A</TestTab>
            <TestTab value="b">B</TestTab>
            <span mix={tabs.indicator()} />
          </div>
          <TestPanel value="a">Panel A</TestPanel>
          <TestPanel value="b">Panel B</TestPanel>
        </ExampleTabs>,
      )
      t.after(cleanup)

      let parts = () => [
        container.querySelector('[data-orientation]:not([role])')!,
        container.querySelector('[role="tablist"]')!,
        ...getTabs(container),
        container.querySelector('[role="presentation"]')!,
        ...getPanels(container),
      ]
      expect(parts()).toHaveLength(7)
      for (let part of parts()) {
        expect(part.getAttribute('data-orientation')).toBe('horizontal')
        expect(part.getAttribute('data-activation-direction')).toBe('none')
      }

      await act(() => getTabs(container)[1].click())
      for (let part of parts()) {
        expect(part.getAttribute('data-activation-direction')).toBe('right')
      }

      await act(() => getTabs(container)[0].click())
      expect(getTabs(container)[0].getAttribute('data-activation-direction')).toBe('left')
    })

    it('reports up/down activation direction for vertical tabs', async (t) => {
      let { container, act, cleanup } = render(
        <ExampleTabs defaultValue="a" orientation="vertical">
          <div mix={tabs.list()} style={{ display: 'flex', flexDirection: 'column' }}>
            <TestTab value="a">A</TestTab>
            <TestTab value="b">B</TestTab>
          </div>
        </ExampleTabs>,
      )
      t.after(cleanup)

      await act(() => getTabs(container)[1].click())
      expect(getTabs(container)[1].getAttribute('data-activation-direction')).toBe('down')
      await act(() => getTabs(container)[0].click())
      expect(getTabs(container)[1].getAttribute('data-activation-direction')).toBe('up')
    })

    it('computes activation direction for controlled value changes', async (t) => {
      let setValue: (value: string) => void = () => {}

      function App(handle: Handle) {
        let value = 'a'
        setValue = (next) => {
          value = next
          void handle.update()
        }
        return () => (
          <ExampleTabs value={value}>
            <div mix={tabs.list()} style={{ display: 'flex' }}>
              <TestTab value="a">A</TestTab>
              <TestTab value="b">B</TestTab>
            </div>
          </ExampleTabs>
        )
      }

      let { container, act, cleanup } = render(<App />)
      t.after(cleanup)

      await act(() => setValue('b'))
      expect(getTabs(container)[0].getAttribute('data-activation-direction')).toBe('right')
    })

    it('marks active, disabled, and hidden parts with present/absent attributes', (t) => {
      let { container, cleanup } = render(threeTabs({ defaultValue: 'overview' }))
      t.after(cleanup)

      let [overview, activity, settings] = getTabs(container)
      expect(overview.getAttribute('data-active')).toBe('')
      expect(activity.hasAttribute('data-active')).toBe(false)
      expect(settings.getAttribute('data-disabled')).toBe('')
      expect(overview.hasAttribute('data-disabled')).toBe(false)

      let panels = getPanels(container)
      expect(panels[0].hasAttribute('data-hidden')).toBe(false)
      expect(panels[1].getAttribute('data-hidden')).toBe('')
      expect(panels.map((panel) => panel.getAttribute('data-index'))).toEqual(['0', '1', '2'])
    })
  })

  describe('indicator', () => {
    function IndicatorExample(handle: Handle<{ defaultValue?: string | null }>) {
      return () => (
        <ExampleTabs defaultValue={handle.props.defaultValue}>
          <div
            mix={tabs.list()}
            style={{ display: 'flex', position: 'relative', padding: '4px', width: '400px' }}
          >
            <button mix={tabs.tab({ value: 'a' })} style={{ width: '50px', height: '20px' }}>
              A
            </button>
            <button mix={tabs.tab({ value: 'b' })} style={{ width: '80px', height: '20px' }}>
              B
            </button>
            <span mix={tabs.indicator()} data-testid="indicator" />
          </div>
        </ExampleTabs>
      )
    }

    function vars(node: HTMLElement) {
      let read = (name: string) => node.style.getPropertyValue(name)
      return {
        left: read('--active-tab-left'),
        right: read('--active-tab-right'),
        top: read('--active-tab-top'),
        bottom: read('--active-tab-bottom'),
        width: read('--active-tab-width'),
        height: read('--active-tab-height'),
      }
    }

    it('sets CSS variables for the active tab and updates them on change', async (t) => {
      let { $, container, act, cleanup } = render(<IndicatorExample defaultValue="a" />)
      t.after(cleanup)
      await act(() => {})

      let indicator = $('[data-testid="indicator"]') as HTMLElement
      expect(indicator.hidden).toBe(false)
      expect(indicator.getAttribute('role')).toBe('presentation')
      expect(vars(indicator)).toEqual({
        left: '4px',
        right: '354px',
        top: '4px',
        bottom: '4px',
        width: '50px',
        height: '20px',
      })

      await act(() => getTabs(container)[1].click())
      expect(vars(indicator).left).toBe('54px')
      expect(vars(indicator).width).toBe('80px')
      expect(vars(indicator).right).toBe('274px')
    })

    it('updates CSS variables when the active tab resizes', async (t) => {
      let { $, container, act, cleanup } = render(<IndicatorExample defaultValue="a" />)
      t.after(cleanup)
      await act(() => {})

      let indicator = $('[data-testid="indicator"]') as HTMLElement
      getTabs(container)[0].style.width = '70px'
      await nextFrame()
      await nextFrame()
      await act(() => {})

      expect(vars(indicator).width).toBe('70px')
    })

    it('stays hidden without an active tab', async (t) => {
      let { $, act, cleanup } = render(<IndicatorExample defaultValue={null} />)
      t.after(cleanup)
      await act(() => {})

      let indicator = $('[data-testid="indicator"]') as HTMLElement
      expect(indicator.hidden).toBe(true)
      expect(indicator.style.getPropertyValue('--active-tab-width')).toBe('')
    })
  })
})
