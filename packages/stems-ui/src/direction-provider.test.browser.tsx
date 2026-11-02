import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import type { Handle } from 'remix/component'
import { render } from 'remix/component/test'

import { DirectionProvider, getDirection, getDirectionFromContext } from './direction-provider.ts'
import * as tabs from './tabs.ts'

function key(target: Element, value: string) {
  target.dispatchEvent(
    new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true }),
  )
}

let setDirection: (direction: 'ltr' | 'rtl') => void = () => {}

function App(handle: Handle) {
  let direction: 'ltr' | 'rtl' = 'rtl'
  setDirection = (next) => {
    direction = next
    void handle.update()
  }
  return () => (
    <DirectionProvider direction={direction}>
      <tabs.Context defaultValue="a">
        <div mix={tabs.root()}>
          <div mix={tabs.list()}>
            <button mix={tabs.tab({ value: 'a' })}>A</button>
            <button mix={tabs.tab({ value: 'b' })}>B</button>
            <button mix={tabs.tab({ value: 'c' })}>C</button>
          </div>
        </div>
      </tabs.Context>
    </DirectionProvider>
  )
}

describe('DirectionProvider', () => {
  it('sets the direction for getDirection and CSS without a layout box', (t) => {
    let { container, cleanup } = render(
      <div style={{ display: 'flex' }}>
        <DirectionProvider direction="rtl">
          <span id="item" style={{ flex: '1' }}>
            Item
          </span>
        </DirectionProvider>
      </div>,
    )
    t.after(cleanup)

    let item = container.querySelector('#item')!
    let provider = item.parentElement!
    assert.equal(provider.getAttribute('dir'), 'rtl')
    assert.equal(getComputedStyle(provider).display, 'contents')
    assert.equal(getComputedStyle(item).direction, 'rtl')
    assert.equal(getDirection(item), 'rtl')
    // The child is still a flex item of the outer flex container.
    assert.equal(item.getBoundingClientRect().width, provider.parentElement!.clientWidth)
  })

  it('flips arrow keys in existing widgets and follows prop changes', async (t) => {
    let { container, act, cleanup } = render(<App />)
    t.after(cleanup)

    let [a, b] = container.querySelectorAll<HTMLElement>('[role="tab"]')
    a.focus()
    key(a, 'ArrowLeft')
    assert.equal(document.activeElement, b)

    await act(() => setDirection('ltr'))
    assert.equal(container.querySelector('[dir]')!.getAttribute('dir'), 'ltr')
    key(b, 'ArrowLeft')
    assert.equal(document.activeElement, a)
  })

  it('exposes the direction to components', (t) => {
    let seen: Array<string | undefined> = []
    function Probe(handle: Handle) {
      return () => {
        seen.push(getDirectionFromContext(handle))
        return null
      }
    }
    let { cleanup } = render(
      <div>
        <Probe />
        <DirectionProvider direction="rtl">
          <Probe />
        </DirectionProvider>
      </div>,
    )
    t.after(cleanup)
    assert.deepEqual(seen, [undefined, 'rtl'])
  })
})
