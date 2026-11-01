import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import { on, type Handle } from 'remix/component'
import { render } from 'remix/component/test'

import { button } from './button.ts'

function key(target: Element, type: 'keydown' | 'keyup', key: string) {
  let event = new KeyboardEvent(type, { key, bubbles: true, cancelable: true })
  target.dispatchEvent(event)
  return event
}

describe('button', () => {
  it('defaults native buttons to type="button" without extra semantics', (t) => {
    let { $, cleanup } = render(<button mix={button()}>Save</button>)
    t.after(cleanup)

    let host = $('button')!
    assert.equal(host.getAttribute('type'), 'button')
    assert.equal(host.getAttribute('role'), null)
    assert.equal(host.getAttribute('tabindex'), null)
    assert.equal(host.hasAttribute('data-disabled'), false)
    assert.equal(host.hasAttribute('aria-disabled'), false)
  })

  it('lets an explicit type win', (t) => {
    let { $, cleanup } = render(
      <button type="submit" mix={button()}>
        Save
      </button>,
    )
    t.after(cleanup)

    assert.equal($('button')!.getAttribute('type'), 'submit')
  })

  it('uses the native disabled attribute by default', (t) => {
    let { $, cleanup } = render(<button mix={button({ disabled: true })}>Save</button>)
    t.after(cleanup)

    let host = $('button') as HTMLButtonElement
    assert.equal(host.disabled, true)
    assert.equal(host.getAttribute('data-disabled'), '')
    assert.equal(host.hasAttribute('aria-disabled'), false)
  })

  it('reads data-disabled from the host disabled prop', (t) => {
    let { $, cleanup } = render(
      <button disabled mix={button()}>
        Save
      </button>,
    )
    t.after(cleanup)

    assert.equal($('button')!.getAttribute('data-disabled'), '')
  })

  it('keeps disabled buttons focusable with focusableWhenDisabled and blocks activation', async (t) => {
    let clicks = 0
    let { $, act, cleanup } = render(
      <button
        mix={[
          button({ disabled: true, focusableWhenDisabled: true }),
          on('click', () => {
            clicks++
          }),
        ]}
      >
        Save
      </button>,
    )
    t.after(cleanup)

    let host = $('button') as HTMLButtonElement
    assert.equal(host.disabled, false)
    assert.equal(host.getAttribute('aria-disabled'), 'true')
    assert.equal(host.getAttribute('data-disabled'), '')

    host.focus()
    assert.equal(document.activeElement, host)

    await act(() => host.click())
    assert.equal(clicks, 0)

    assert.equal(key(host, 'keydown', 'Enter').defaultPrevented, true)
    assert.equal(key(host, 'keydown', ' ').defaultPrevented, true)
  })

  it('blocks form submission from a focusable disabled submit button', async (t) => {
    let submits = 0
    let { $, act, cleanup } = render(
      <form
        mix={on('submit', (event) => {
          event.preventDefault()
          submits++
        })}
      >
        <button type="submit" mix={button({ disabled: true, focusableWhenDisabled: true })}>
          Submit
        </button>
      </form>,
    )
    t.after(cleanup)

    await act(() => $('button')!.click())
    assert.equal(submits, 0)
  })

  it('gives non-native hosts button semantics', (t) => {
    let { $, cleanup } = render(<div mix={button()}>Save</div>)
    t.after(cleanup)

    let host = $('div')!
    assert.equal(host.getAttribute('role'), 'button')
    assert.equal(host.getAttribute('tabindex'), '0')
    assert.equal(host.getAttribute('type'), null)
  })

  it('activates non-native hosts with Enter (keydown) and Space (keyup)', async (t) => {
    let clicks = 0
    let { $, act, cleanup } = render(
      <div
        mix={[
          button(),
          on('click', () => {
            clicks++
          }),
        ]}
      >
        Save
      </div>,
    )
    t.after(cleanup)

    let host = $('div')!
    await act(() => {
      assert.equal(key(host, 'keydown', 'Enter').defaultPrevented, true)
    })
    assert.equal(clicks, 1)

    await act(() => {
      // Space keydown only prevents scrolling; activation happens on keyup.
      assert.equal(key(host, 'keydown', ' ').defaultPrevented, true)
    })
    assert.equal(clicks, 1)
    await act(() => key(host, 'keyup', ' '))
    assert.equal(clicks, 2)
  })

  it('ignores keys from descendants of non-native hosts', async (t) => {
    let clicks = 0
    let { $, act, cleanup } = render(
      <div
        mix={[
          button(),
          on('click', () => {
            clicks++
          }),
        ]}
      >
        <input />
      </div>,
    )
    t.after(cleanup)

    await act(() => key($('input')!, 'keydown', 'Enter'))
    assert.equal(clicks, 0)
  })

  it('disables non-native hosts', async (t) => {
    let clicks = 0
    let { $, act, cleanup } = render(
      <div
        mix={[
          button({ disabled: true }),
          on('click', () => {
            clicks++
          }),
        ]}
      >
        Save
      </div>,
    )
    t.after(cleanup)

    let host = $('div')!
    assert.equal(host.getAttribute('aria-disabled'), 'true')
    assert.equal(host.getAttribute('tabindex'), '-1')
    assert.equal(host.getAttribute('data-disabled'), '')

    await act(() => {
      host.click()
      key(host, 'keydown', 'Enter')
      key(host, 'keyup', ' ')
    })
    assert.equal(clicks, 0)
  })

  it('keeps disabled non-native hosts in the tab order with focusableWhenDisabled', (t) => {
    let { $, cleanup } = render(
      <span mix={button({ disabled: true, focusableWhenDisabled: true })}>Save</span>,
    )
    t.after(cleanup)

    assert.equal($('span')!.getAttribute('tabindex'), '0')
    assert.equal($('span')!.getAttribute('aria-disabled'), 'true')
  })

  it('honors nativeButton={false} on a <button> host', (t) => {
    let { $, cleanup } = render(<button mix={button({ nativeButton: false })}>Save</button>)
    t.after(cleanup)

    assert.equal($('button')!.getAttribute('role'), 'button')
  })

  it('re-enables after the disabled option changes', async (t) => {
    let clicks = 0
    let setDisabled!: (value: boolean) => void

    function Harness(handle: Handle) {
      let disabled = true
      setDisabled = (value) => {
        disabled = value
        void handle.update()
      }
      return () => (
        <button
          mix={[
            button({ disabled, focusableWhenDisabled: true }),
            on('click', () => {
              clicks++
            }),
          ]}
        >
          Save
        </button>
      )
    }

    let { $, act, cleanup } = render(<Harness />)
    t.after(cleanup)

    let host = $('button')!
    await act(() => host.click())
    assert.equal(clicks, 0)

    await act(() => setDisabled(false))
    assert.equal(host.hasAttribute('aria-disabled'), false)
    assert.equal(host.hasAttribute('data-disabled'), false)

    await act(() => host.click())
    assert.equal(clicks, 1)
  })
})
