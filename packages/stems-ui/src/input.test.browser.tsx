import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import type { Handle } from 'remix/component'
import { render } from 'remix/component/test'

import { input, onInputChange } from './input.ts'

function type(element: HTMLInputElement, value: string) {
  element.value = value
  element.dispatchEvent(new Event('input', { bubbles: true }))
}

describe('input', () => {
  it('renders without state attributes when empty and idle', (t) => {
    let { $, cleanup } = render(<input aria-label="Name" mix={input()} />)
    t.after(cleanup)

    let host = $('input')!
    for (let name of ['disabled', 'focused', 'touched', 'dirty', 'filled']) {
      assert.equal(host.hasAttribute(`data-${name}`), false, `data-${name}`)
    }
  })

  it('marks disabled inputs', (t) => {
    let { $, cleanup } = render(<input aria-label="Name" mix={input({ disabled: true })} />)
    t.after(cleanup)

    let host = $('input')! as HTMLInputElement
    assert.equal(host.disabled, true)
    assert.equal(host.getAttribute('data-disabled'), '')
  })

  it('reads data-disabled from the host disabled prop', (t) => {
    let { $, cleanup } = render(<input aria-label="Name" disabled mix={input()} />)
    t.after(cleanup)

    assert.equal($('input')!.getAttribute('data-disabled'), '')
  })

  it('tracks uncontrolled value, filled and dirty state', async (t) => {
    let changes: string[] = []
    let events: string[] = []
    let { $, act, cleanup } = render(
      <input
        aria-label="Name"
        mix={[
          input({ defaultValue: 'Ada', onValueChange: (value) => changes.push(value) }),
          onInputChange((event) => {
            events.push(event.value)
          }),
        ]}
      />,
    )
    t.after(cleanup)

    let host = $('input')! as HTMLInputElement
    assert.equal(host.value, 'Ada')
    assert.equal(host.getAttribute('data-filled'), '')
    assert.equal(host.hasAttribute('data-dirty'), false)

    await act(() => type(host, 'Grace'))
    assert.deepEqual(changes, ['Grace'])
    assert.deepEqual(events, ['Grace'])
    assert.equal(host.getAttribute('data-dirty'), '')

    await act(() => type(host, ''))
    assert.equal(host.hasAttribute('data-filled'), false)

    await act(() => type(host, 'Ada'))
    assert.equal(host.hasAttribute('data-dirty'), false)
  })

  it('tracks focus and touched state', async (t) => {
    let { $, act, cleanup } = render(
      <div>
        <input aria-label="Name" mix={input()} />
        <button type="button">Other</button>
      </div>,
    )
    t.after(cleanup)

    let host = $('input')! as HTMLInputElement
    await act(() => host.focus())
    assert.equal(host.getAttribute('data-focused'), '')
    assert.equal(host.hasAttribute('data-touched'), false)

    await act(() => ($('button') as HTMLButtonElement).focus())
    assert.equal(host.hasAttribute('data-focused'), false)
    assert.equal(host.getAttribute('data-touched'), '')
  })

  it('supports controlled values', async (t) => {
    function Harness(handle: Handle) {
      let value = 'Ada'
      return () => (
        <div>
          <input
            aria-label="Name"
            mix={input({
              value,
              onValueChange(next) {
                value = next.toUpperCase()
                void handle.update()
              },
            })}
          />
          <output>{value}</output>
        </div>
      )
    }

    let { $, act, cleanup } = render(<Harness />)
    t.after(cleanup)

    let host = $('input')! as HTMLInputElement
    assert.equal(host.value, 'Ada')

    await act(() => type(host, 'grace'))
    assert.equal($('output')!.textContent, 'GRACE')
    assert.equal(host.value, 'GRACE')
    assert.equal(host.getAttribute('data-dirty'), '', 'dirty ' + host.outerHTML)
    assert.equal(host.getAttribute('data-filled'), '', 'filled ' + host.outerHTML)
  })

  it('keeps the controlled value through focus changes after the owner re-renders', async (t) => {
    function Harness(handle: Handle) {
      let value = 'Ada'
      return () => (
        <div>
          <input
            aria-label="Name"
            mix={input({
              value,
              onValueChange(next) {
                value = next
                void handle.update()
              },
            })}
          />
          <button type="button">Other</button>
        </div>
      )
    }

    let { $, act, cleanup } = render(<Harness />)
    t.after(cleanup)

    let host = $('input') as HTMLInputElement
    await act(() => type(host, 'Grace'))
    await act(() => host.focus())
    await act(() => ($('button') as HTMLButtonElement).focus())
    assert.equal(host.value, 'Grace')
    assert.equal(host.getAttribute('data-touched'), '')
    assert.equal(host.getAttribute('data-dirty'), '')
  })

  it('lets an explicit host value win', (t) => {
    let { $, cleanup } = render(
      <input aria-label="Name" value="host" mix={input({ value: 'mixin' })} />,
    )
    t.after(cleanup)

    assert.equal(($('input') as HTMLInputElement).value, 'host')
  })
})
